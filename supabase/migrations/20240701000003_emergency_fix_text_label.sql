-- EMERGÊNCIA: Script de correção para problema persistente com text_label
-- Data: 01/07/2024

DO $$
DECLARE
    trigger_record RECORD;
    function_record RECORD;
BEGIN
    RAISE NOTICE 'INICIANDO CORREÇÃO DE EMERGÊNCIA PARA O PROBLEMA DO TEXT_LABEL';

    -- Primeiro, desabilitar todos os triggers na tabela appointments
    ALTER TABLE appointments DISABLE TRIGGER ALL;
    RAISE NOTICE 'Todos os triggers da tabela appointments foram desabilitados';

    -- 1. Remover todos os triggers da tabela appointments
    FOR trigger_record IN
        SELECT tgname 
        FROM pg_trigger 
        WHERE tgrelid = 'appointments'::regclass
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || trigger_record.tgname || ' ON appointments';
        RAISE NOTICE 'Removido trigger: %', trigger_record.tgname;
    END LOOP;

    -- 2. Remover todas as funções de trigger que tenham 'text_label'
    FOR function_record IN
        SELECT proname, oid
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND pg_get_functiondef(p.oid) LIKE '%text_label%'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || function_record.proname || ' CASCADE';
        RAISE NOTICE 'Removida função: %', function_record.proname;
    END LOOP;

    -- 3. Recriar a função de timestamp mínima
    CREATE OR REPLACE FUNCTION update_appointment_timestamp()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- 4. Recriar o trigger de timestamp
    CREATE TRIGGER set_timestamp
        BEFORE UPDATE ON appointments
        FOR EACH ROW
        EXECUTE FUNCTION update_appointment_timestamp();

    -- 5. Verificar se a função calculate_appointment_total existe e recriá-la sem text_label
    DROP FUNCTION IF EXISTS calculate_appointment_total CASCADE;
    
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

    -- 6. Criar um novo trigger simples para calcular o total
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

    -- 7. Criar o trigger para atualizar o total
    CREATE TRIGGER before_appointment_insert_update
        BEFORE INSERT OR UPDATE ON appointments
        FOR EACH ROW
        EXECUTE FUNCTION update_appointment_total();

    RAISE NOTICE 'CORREÇÃO DE EMERGÊNCIA CONCLUÍDA COM SUCESSO';
END;
$$; 