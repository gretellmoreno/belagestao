-- Correção de problema com products_data_json vs products_data
-- Data: 02/07/2024

DO $$
BEGIN
    -- Verificar se a coluna products_data existe
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'appointments' 
        AND column_name = 'products_data'
    ) THEN
        RAISE NOTICE 'Coluna products_data já existe na tabela appointments.';
    ELSE
        -- Se não existir, criar a coluna
        RAISE NOTICE 'Adicionando coluna products_data à tabela appointments...';
        ALTER TABLE appointments ADD COLUMN products_data JSONB DEFAULT '[]'::jsonb;
        COMMENT ON COLUMN appointments.products_data IS 'Dados de produtos vendidos durante o atendimento';
    END IF;

    -- Verificar se a coluna services_data existe
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'appointments' 
        AND column_name = 'services_data'
    ) THEN
        RAISE NOTICE 'Coluna services_data já existe na tabela appointments.';
    ELSE
        -- Se não existir, criar a coluna
        RAISE NOTICE 'Adicionando coluna services_data à tabela appointments...';
        ALTER TABLE appointments ADD COLUMN services_data JSONB DEFAULT '[]'::jsonb;
        COMMENT ON COLUMN appointments.services_data IS 'Dados de serviços realizados durante o atendimento';
    END IF;

    -- Atualizar a função de trigger para usar esses campos
    CREATE OR REPLACE FUNCTION update_appointment_total() 
    RETURNS TRIGGER AS $$
    BEGIN
        -- Verificar se a função calculate_appointment_total existe
        IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_appointment_total') THEN
            -- Calcular o total baseado nos dados de serviços e produtos
            NEW.total_value := calculate_appointment_total(
                NEW.services_data,
                NEW.products_data,
                NEW.custom_prices
            );
        ELSE
            -- Versão simplificada se a função não existir
            NEW.total_value := 0;
            
            -- Serviços
            IF NEW.services_data IS NOT NULL AND jsonb_array_length(NEW.services_data) > 0 THEN
                FOR i IN 0..jsonb_array_length(NEW.services_data) - 1 LOOP
                    IF (NEW.services_data->i->>'final_price') IS NOT NULL THEN
                        NEW.total_value := NEW.total_value + (NEW.services_data->i->>'final_price')::DECIMAL;
                    END IF;
                END LOOP;
            END IF;
            
            -- Produtos
            IF NEW.products_data IS NOT NULL AND jsonb_array_length(NEW.products_data) > 0 THEN
                FOR i IN 0..jsonb_array_length(NEW.products_data) - 1 LOOP
                    IF (NEW.products_data->i->>'final_price') IS NOT NULL THEN
                        NEW.total_value := NEW.total_value + (NEW.products_data->i->>'final_price')::DECIMAL;
                    END IF;
                END LOOP;
            END IF;
        END IF;
        
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    
    -- Atualizar o trigger
    DROP TRIGGER IF EXISTS before_appointment_insert_update ON appointments;
    CREATE TRIGGER before_appointment_insert_update
        BEFORE INSERT OR UPDATE ON appointments
        FOR EACH ROW
        EXECUTE FUNCTION update_appointment_total();
        
    RAISE NOTICE 'Correção de colunas e triggers finalizada com sucesso!';
END;
$$; 