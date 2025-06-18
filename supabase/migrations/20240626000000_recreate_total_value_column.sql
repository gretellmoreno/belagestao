-- Adiciona a coluna total_value na tabela appointments
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS total_value DECIMAL(10,2) DEFAULT 0.00;

-- Adiciona um comentário explicativo na coluna
COMMENT ON COLUMN appointments.total_value IS 'Valor total do atendimento incluindo todos os serviços';

-- Cria índice para melhorar performance de consultas se não existir
CREATE INDEX IF NOT EXISTS idx_appointments_total_value ON appointments(total_value);

-- Recria função para calcular o valor total do atendimento 
-- Esta função será usada para atualizar os valores existentes e em triggers
CREATE OR REPLACE FUNCTION calculate_appointment_total(
    p_services_data JSONB,
    p_products_data JSONB,
    p_custom_prices JSONB DEFAULT '{}'::JSONB
) RETURNS DECIMAL AS $$
DECLARE
    total DECIMAL := 0;
    service_data JSONB;
    product_data JSONB;
BEGIN
    -- Calcular total dos serviços usando services_data (novo formato)
    IF p_services_data IS NOT NULL AND jsonb_array_length(p_services_data) > 0 THEN
        FOR i IN 0..jsonb_array_length(p_services_data) - 1 LOOP
            service_data := p_services_data->i;
            -- Usar total_value ou final_price do serviço
            IF (service_data->>'total_value') IS NOT NULL THEN
                total := total + COALESCE((service_data->>'total_value')::DECIMAL, 0);
            ELSIF (service_data->>'final_price') IS NOT NULL THEN
                total := total + COALESCE((service_data->>'final_price')::DECIMAL, 0);
            ELSIF (service_data->>'custom_price') IS NOT NULL AND (service_data->>'custom_price')::DECIMAL > 0 THEN
                total := total + COALESCE((service_data->>'custom_price')::DECIMAL, 0);
            END IF;
        END LOOP;
    END IF;

    -- Calcular total dos produtos usando products_data (novo formato)
    IF p_products_data IS NOT NULL AND jsonb_array_length(p_products_data) > 0 THEN
        FOR i IN 0..jsonb_array_length(p_products_data) - 1 LOOP
            product_data := p_products_data->i;
            -- Calcular valor de cada produto (preço * quantidade)
            IF (product_data->>'final_price') IS NOT NULL THEN
                total := total + COALESCE((product_data->>'final_price')::DECIMAL, 0);
            ELSIF (product_data->>'unit_price') IS NOT NULL AND (product_data->>'quantity') IS NOT NULL THEN
                total := total + COALESCE((product_data->>'unit_price')::DECIMAL, 0) * COALESCE((product_data->>'quantity')::INTEGER, 1);
            END IF;
        END LOOP;
    END IF;
    
    RETURN total;
END;
$$ LANGUAGE plpgsql;

-- Cria trigger para atualizar automaticamente o valor total
CREATE OR REPLACE FUNCTION update_appointment_total() RETURNS TRIGGER AS $$
BEGIN
    -- Calcular o total baseado nos dados de serviços e produtos
    NEW.total_value := calculate_appointment_total(
        NEW.services_data,
        NEW.products_data,
        NEW.custom_prices
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Cria o trigger que será executado antes de inserir ou atualizar
DROP TRIGGER IF EXISTS before_appointment_insert_update ON appointments;
CREATE TRIGGER before_appointment_insert_update
    BEFORE INSERT OR UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION update_appointment_total();

-- Atualiza os registros existentes
UPDATE appointments
SET total_value = calculate_appointment_total(
    services_data,
    products_data,
    custom_prices
); 