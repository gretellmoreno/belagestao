-- Migração para remover referências ao campo text_label que está causando erros
-- Data: 01/07/2024

-- Verificando se existem triggers ou funções que referenciam o campo text_label
DO $$
DECLARE
    func_record RECORD;
    trigger_record RECORD;
    func_body TEXT;
BEGIN
    RAISE NOTICE 'Iniciando remoção de referências ao campo text_label...';
    
    -- Verificar todas as funções de gatilho (triggers) para appointments
    FOR func_record IN 
        SELECT 
            p.proname AS function_name,
            pg_get_functiondef(p.oid) AS function_body
        FROM 
            pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE 
            n.nspname = 'public'
            AND p.proname LIKE '%appointment%'
    LOOP
        func_body := func_record.function_body;
        
        -- Se a função contém referência a NEW.text_label
        IF func_body LIKE '%NEW.text_label%' THEN
            RAISE NOTICE 'Encontrada referência a text_label na função: %', func_record.function_name;
            
            -- Atualizamos a função para remover a referência
            -- Esta é uma aproximação genérica - pode precisar ser ajustada para casos específicos
            EXECUTE 'CREATE OR REPLACE ' || 
                    regexp_replace(func_body, 'NEW\.text_label\s*[:=][^;]+;', '', 'g');
            
            RAISE NOTICE 'Referência a text_label removida da função: %', func_record.function_name;
        END IF;
    END LOOP;
    
    -- Verificar se a coluna existe na tabela appointments
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'appointments' 
        AND column_name = 'text_label'
    ) THEN
        -- Comentar a coluna como obsoleta - não removemos para evitar quebrar código existente
        COMMENT ON COLUMN appointments.text_label IS 'DEPRECATED: Campo obsoleto que não deve mais ser usado. Será removido em futuras versões.';
        
        RAISE NOTICE 'Coluna text_label foi marcada como DEPRECATED na tabela appointments';
    END IF;
    
    RAISE NOTICE 'Remoção de referências ao campo text_label concluída com sucesso!';
END;
$$;

-- Recria o trigger de atualização de valores usando apenas os campos válidos
DROP TRIGGER IF EXISTS before_appointment_insert_update ON appointments;

CREATE OR REPLACE FUNCTION update_appointment_total() 
RETURNS TRIGGER AS $$
BEGIN
    -- Calcular o total baseado nos dados de serviços e produtos
    -- Sem usar text_label em nenhum lugar
    NEW.total_value := calculate_appointment_total(
        NEW.services_data,
        NEW.products_data,
        NEW.custom_prices
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_appointment_insert_update
    BEFORE INSERT OR UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION update_appointment_total();

COMMENT ON FUNCTION update_appointment_total() IS 'Calcula e atualiza o valor total do agendamento baseado nos serviços e produtos. Versão corrigida sem referências a text_label.'; 