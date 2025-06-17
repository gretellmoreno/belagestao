-- Migração crítica para corrigir problemas com o campo text_label
-- Data: 01/07/2024

-- Abordagem mais direta para encontrar e corrigir todas as funções com referência a text_label
DO $$
DECLARE
    func_record RECORD;
    all_triggers RECORD;
    func_body TEXT;
    func_def TEXT;
    clean_body TEXT;
BEGIN
    RAISE NOTICE 'Iniciando correção crítica para referências ao campo text_label...';

    -- 1. Identificar e corrigir todas as funções com text_label
    FOR func_record IN 
        SELECT 
            p.proname AS function_name,
            p.oid AS function_id,
            pg_get_functiondef(p.oid) AS function_body
        FROM 
            pg_proc p
        WHERE 
            pg_get_functiondef(p.oid) LIKE '%text_label%'
    LOOP
        RAISE NOTICE 'Analisando função: %', func_record.function_name;
        
        -- Substituir todas as ocorrências de NEW.text_label
        clean_body := regexp_replace(func_record.function_body, 'NEW\.text_label\s*[:=][^;]+;', '-- Removed text_label reference', 'g');
        
        -- Se houve mudança
        IF clean_body <> func_record.function_body THEN
            RAISE NOTICE 'Removendo referências a text_label da função: %', func_record.function_name;
            EXECUTE clean_body;
        END IF;
    END LOOP;

    -- 2. Verificar triggers específicos na tabela appointments
    DROP TRIGGER IF EXISTS before_appointment_insert_update ON appointments;
    DROP TRIGGER IF EXISTS appointment_before_update ON appointments;
    DROP TRIGGER IF EXISTS set_timestamp ON appointments;
    
    -- 3. Recriar a função de cálculo de total sem referências a text_label
    CREATE OR REPLACE FUNCTION update_appointment_total() 
    RETURNS TRIGGER AS $$
    BEGIN
        -- Calcular o total baseado nos dados de serviços e produtos
        -- Verificar se a função calculate_appointment_total existe
        IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_appointment_total') THEN
            NEW.total_value := calculate_appointment_total(
                NEW.services_data,
                NEW.products_data,
                NEW.custom_prices
            );
        ELSE
            -- Versão simplificada caso a função não exista
            NEW.total_value := 0;
            
            -- Tentar calcular baseado em services_data
            IF NEW.services_data IS NOT NULL AND jsonb_array_length(NEW.services_data) > 0 THEN
                FOR i IN 0..jsonb_array_length(NEW.services_data) - 1 LOOP
                    IF (NEW.services_data->i->>'final_price') IS NOT NULL THEN
                        NEW.total_value := NEW.total_value + (NEW.services_data->i->>'final_price')::numeric;
                    ELSIF (NEW.services_data->i->>'custom_price') IS NOT NULL THEN
                        NEW.total_value := NEW.total_value + (NEW.services_data->i->>'custom_price')::numeric;
                    END IF;
                END LOOP;
            END IF;
            
            -- Adicionar produtos
            IF NEW.products_data IS NOT NULL AND jsonb_array_length(NEW.products_data) > 0 THEN
                FOR i IN 0..jsonb_array_length(NEW.products_data) - 1 LOOP
                    IF (NEW.products_data->i->>'final_price') IS NOT NULL THEN
                        NEW.total_value := NEW.total_value + (NEW.products_data->i->>'final_price')::numeric;
                    ELSIF (NEW.products_data->i->>'unit_price') IS NOT NULL AND (NEW.products_data->i->>'quantity') IS NOT NULL THEN
                        NEW.total_value := NEW.total_value + 
                            (NEW.products_data->i->>'unit_price')::numeric * (NEW.products_data->i->>'quantity')::numeric;
                    END IF;
                END LOOP;
            END IF;
        END IF;
        
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- 4. Recriar o trigger básico de atualização
    CREATE TRIGGER before_appointment_insert_update
        BEFORE INSERT OR UPDATE ON appointments
        FOR EACH ROW
        EXECUTE FUNCTION update_appointment_total();
    
    -- 5. Recriar o trigger de timestamp se necessário
    CREATE OR REPLACE FUNCTION update_appointment_timestamp()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    
    CREATE TRIGGER set_timestamp
        BEFORE UPDATE ON appointments
        FOR EACH ROW
        EXECUTE FUNCTION update_appointment_timestamp();
    
    RAISE NOTICE 'Correção crítica para text_label concluída com sucesso!';
    
    -- 6. Garantir que a coluna tenha um comentário de deprecation
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'appointments' 
        AND column_name = 'text_label'
    ) THEN
        COMMENT ON COLUMN appointments.text_label IS 'DEPRECATED: Campo obsoleto que será removido. NÃO UTILIZE.';
    END IF;
END;
$$; 