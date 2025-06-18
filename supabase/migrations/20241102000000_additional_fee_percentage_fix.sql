-- Migração para corrigir especificamente o erro relacionado a fee_percentage
-- Data: 2024-11-02

-- Esta migração verifica se existem funções com problemas e as corrige

DO $$
DECLARE
    func_record RECORD;
    view_record RECORD;
    func_def TEXT;
    updated_def TEXT;
    trigger_record RECORD;
    trigger_def TEXT;
BEGIN
    RAISE NOTICE 'Iniciando verificação de referências a fee_percentage...';

    -- 1. Primeiro verificar se a coluna fee_percentage existe na tabela payment_methods
    -- Se existir, migrá-la para a coluna fee e eliminá-la
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'payment_methods' 
        AND column_name = 'fee_percentage'
    ) THEN
        RAISE NOTICE 'A coluna fee_percentage ainda existe na tabela payment_methods. Migrando dados...';
        
        -- Migrar dados de fee_percentage para fee, se fee for NULL
        UPDATE payment_methods 
        SET fee = fee_percentage 
        WHERE fee IS NULL AND fee_percentage IS NOT NULL;
        
        -- Remover a coluna fee_percentage
        ALTER TABLE payment_methods DROP COLUMN IF EXISTS fee_percentage;
        
        RAISE NOTICE 'Migração da coluna fee_percentage para fee concluída.';
    ELSE
        RAISE NOTICE 'A coluna fee_percentage não existe na tabela payment_methods. Ignorando este passo.';
    END IF;

    -- 2. Verificar e atualizar todas as funções que possam referenciar fee_percentage
    FOR func_record IN
        SELECT p.proname as func_name, n.nspname as schema_name, p.oid
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
    LOOP
        -- Obter a definição da função
        func_def := pg_get_functiondef(func_record.oid);
        
        -- Verificar se a definição contém fee_percentage
        IF func_def LIKE '%fee_percentage%' THEN
            RAISE NOTICE 'Encontrada referência a fee_percentage na função %.%', 
                          func_record.schema_name, func_record.func_name;
            
            -- Substituir fee_percentage por fee na definição da função
            updated_def := REPLACE(func_def, 'fee_percentage', 'fee');
            
            -- Executar o comando para recriar a função
            EXECUTE updated_def;
            
            RAISE NOTICE 'Função %.% atualizada com sucesso.', 
                          func_record.schema_name, func_record.func_name;
        END IF;
    END LOOP;

    -- 3. Verificar e atualizar todas as views que possam referenciar fee_percentage
    FOR view_record IN
        SELECT viewname, schemaname
        FROM pg_views
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
    LOOP
        BEGIN
            -- Verificar se a view referencia fee_percentage
            EXECUTE format('
                SELECT 1 
                FROM pg_get_viewdef(''%I.%I'', true) AS view_def 
                WHERE view_def LIKE ''%%fee_percentage%%''
            ', view_record.schemaname, view_record.viewname) INTO func_record;
            
            IF FOUND THEN
                RAISE NOTICE 'Encontrada referência a fee_percentage na view %.%. Tentando atualizar.', 
                              view_record.schemaname, view_record.viewname;
                
                -- Obter a definição da view
                EXECUTE format('SELECT pg_get_viewdef(''%I.%I'', true)', 
                               view_record.schemaname, view_record.viewname) INTO func_def;
                
                -- Substituir fee_percentage por fee na definição da view
                updated_def := REPLACE(func_def, 'fee_percentage', 'fee');
                
                -- Recriar a view com a nova definição
                EXECUTE format('CREATE OR REPLACE VIEW %I.%I AS %s', 
                               view_record.schemaname, view_record.viewname, updated_def);
                
                RAISE NOTICE 'View %.% atualizada com sucesso.', 
                              view_record.schemaname, view_record.viewname;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Erro ao processar view %.%: %', 
                         view_record.schemaname, view_record.viewname, SQLERRM;
        END;
    END LOOP;

    -- 4. Verificar e atualizar todos os triggers que possam referenciar fee_percentage
    FOR trigger_record IN
        SELECT 
            tgname AS trigger_name,
            relname AS table_name,
            n.nspname AS schema_name,
            p.proname AS function_name,
            p.oid AS function_oid
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        JOIN pg_proc p ON t.tgfoid = p.oid
        WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
    LOOP
        -- Obter a definição da função do trigger
        func_def := pg_get_functiondef(trigger_record.function_oid);
        
        -- Verificar se a definição contém fee_percentage
        IF func_def LIKE '%fee_percentage%' THEN
            RAISE NOTICE 'Encontrada referência a fee_percentage no trigger % da tabela %.%', 
                         trigger_record.trigger_name, trigger_record.schema_name, trigger_record.table_name;
            
            -- Substituir fee_percentage por fee na definição da função
            updated_def := REPLACE(func_def, 'fee_percentage', 'fee');
            
            -- Executar o comando para recriar a função
            EXECUTE updated_def;
            
            RAISE NOTICE 'Função do trigger % atualizada com sucesso.', 
                         trigger_record.trigger_name;
        END IF;
    END LOOP;

    RAISE NOTICE 'Verificação e correção de referências a fee_percentage concluída.';
END $$; 