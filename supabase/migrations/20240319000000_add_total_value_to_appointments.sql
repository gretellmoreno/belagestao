-- Adiciona a coluna total_value na tabela appointments
ALTER TABLE appointments
ADD COLUMN total_value DECIMAL(10,2) DEFAULT 0.00;

-- Adiciona um comentário explicativo na coluna
COMMENT ON COLUMN appointments.total_value IS 'Valor total do atendimento incluindo todos os serviços';

-- Cria função para calcular o valor total do atendimento
CREATE OR REPLACE FUNCTION calculate_appointment_total(
    p_services TEXT[],
    p_custom_prices JSONB
) RETURNS DECIMAL AS $$
DECLARE
    total DECIMAL := 0;
    service_item TEXT;
    custom_price DECIMAL;
    service_price DECIMAL;
BEGIN
    -- Se não houver serviços, retorna 0
    IF p_services IS NULL OR array_length(p_services, 1) IS NULL THEN
        RETURN 0;
    END IF;

    -- Calcula o total para cada serviço
    FOREACH service_item IN ARRAY p_services LOOP
        -- Verifica se existe um preço personalizado
        custom_price := (p_custom_prices ->> service_item)::DECIMAL;
        
        IF custom_price IS NOT NULL AND custom_price > 0 THEN
            total := total + custom_price;
        ELSE
            -- Tenta encontrar o serviço primeiro por UUID, depois por nome
            SELECT price INTO service_price
            FROM services
            WHERE id::text = service_item
               OR name = service_item;

            total := total + COALESCE(service_price, 0);
        END IF;
    END LOOP;
    
    RETURN total;
END;
$$ LANGUAGE plpgsql;

-- Cria trigger para atualizar automaticamente o valor total
CREATE OR REPLACE FUNCTION update_appointment_total() RETURNS TRIGGER AS $$
BEGIN
    -- Calcula o total apenas se houver serviços
    IF NEW.services IS NOT NULL THEN
        NEW.total_value := calculate_appointment_total(
            NEW.services::TEXT[],
            COALESCE(NEW.custom_prices, '{}'::JSONB)
        );
    ELSE
        NEW.total_value := 0;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Cria o trigger que será executado antes de inserir ou atualizar
CREATE TRIGGER before_appointment_insert_update
    BEFORE INSERT OR UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION update_appointment_total();

-- Atualiza os registros existentes
UPDATE appointments
SET total_value = calculate_appointment_total(
    services::TEXT[],
    COALESCE(custom_prices, '{}'::JSONB)
)
WHERE total_value = 0 OR total_value IS NULL;

-- Cria índice para melhorar performance de consultas
CREATE INDEX idx_appointments_total_value ON appointments(total_value); 