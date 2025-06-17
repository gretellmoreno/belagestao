-- Script final para verificar que todas as referências a p.commission_rate
-- ou professionals.commission_rate foram de fato removidas do banco de dados

DO $$
DECLARE
    func_record RECORD;
    func_def TEXT;
    view_record RECORD;
    view_def TEXT;
    issues_found BOOLEAN := FALSE;
BEGIN
    RAISE NOTICE '===== VERIFICAÇÃO FINAL DE REFERÊNCIAS À COMMISSION_RATE DOS PROFISSIONAIS =====';
    
    -- 1. Verificar se a coluna commission_rate ainda existe na tabela professionals
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'professionals' 
        AND column_name = 'commission_rate'
    ) THEN
        RAISE WARNING 'PROBLEMA ENCONTRADO: A coluna commission_rate ainda existe na tabela professionals!';
        RAISE WARNING 'Execute novamente a migração 20240930000000_remove_commission_rate_from_professionals.sql';
        issues_found := TRUE;
    ELSE
        RAISE NOTICE 'OK: A coluna commission_rate foi devidamente removida da tabela professionals.';
    END IF;
    
    -- 2. Verificar se há funções que ainda referenciam p.commission_rate ou professionals.commission_rate
    RAISE NOTICE 'Verificando todas as funções do banco de dados...';
    FOR func_record IN
        SELECT n.nspname AS schema_name, p.proname AS function_name, p.oid AS function_id
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
    LOOP
        -- Obter a definição da função
        func_def := pg_get_functiondef(func_record.function_id);
        
        -- Verificar várias possibilidades de referências à coluna professionals.commission_rate
        IF 
            func_def LIKE '%p.commission_rate%' OR 
            func_def LIKE '%professionals.commission_rate%' OR 
            func_def LIKE '%"p"."commission_rate"%' OR 
            func_def LIKE '%"professionals"."commission_rate"%' OR
            (func_def LIKE '%commission_rate%' AND func_def LIKE '%professional%' AND 
             func_def NOT LIKE '%service%commission_rate%' AND func_def NOT LIKE '%s.commission_rate%')
        THEN
            RAISE WARNING 'PROBLEMA ENCONTRADO: A função %.% ainda contém referências à coluna commission_rate dos profissionais!', 
                func_record.schema_name, func_record.function_name;
            issues_found := TRUE;
        END IF;
    END LOOP;
    
    IF NOT issues_found THEN
        RAISE NOTICE 'OK: Nenhuma função com referências a p.commission_rate ou professionals.commission_rate foi encontrada.';
    END IF;
    
    -- 3. Verificar se há views que ainda referenciam p.commission_rate ou professionals.commission_rate
    RAISE NOTICE 'Verificando todas as views do banco de dados...';
    
    issues_found := FALSE;
    FOR view_record IN
        SELECT n.nspname AS schema_name, c.relname AS view_name, c.oid AS view_id
        FROM pg_class c
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE c.relkind = 'v' AND n.nspname = 'public'
    LOOP
        -- Obter a definição da view
        SELECT pg_get_viewdef(view_record.view_id) INTO view_def;
        
        -- Verificar várias possibilidades de referências à coluna commission_rate
        IF 
            view_def LIKE '%p.commission_rate%' OR 
            view_def LIKE '%professionals.commission_rate%' OR 
            view_def LIKE '%"p"."commission_rate"%' OR 
            view_def LIKE '%"professionals"."commission_rate"%' OR
            (view_def LIKE '%commission_rate%' AND view_def LIKE '%professional%' AND 
             view_def NOT LIKE '%service%commission_rate%' AND view_def NOT LIKE '%s.commission_rate%')
        THEN
            RAISE WARNING 'PROBLEMA ENCONTRADO: A view %.% ainda contém referências à coluna commission_rate dos profissionais!', 
                view_record.schema_name, view_record.view_name;
            issues_found := TRUE;
        END IF;
    END LOOP;
    
    IF NOT issues_found THEN
        RAISE NOTICE 'OK: Nenhuma view com referências a p.commission_rate ou professionals.commission_rate foi encontrada.';
    END IF;
    
    -- 4. Verificar se as funções importantes foram atualizadas corretamente
    RAISE NOTICE 'Verificando funções críticas do sistema...';
    
    -- Verificar calculate_salon_profit
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'calculate_salon_profit' 
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        SELECT pg_get_functiondef(oid) INTO func_def
        FROM pg_proc 
        WHERE proname = 'calculate_salon_profit' 
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
        
        IF func_def LIKE '%professionals.commission_rate%' OR func_def LIKE '%p.commission_rate%' THEN
            RAISE WARNING 'PROBLEMA ENCONTRADO: A função calculate_salon_profit ainda contém referências à coluna commission_rate dos profissionais!';
            issues_found := TRUE;
        ELSE
            RAISE NOTICE 'OK: A função calculate_salon_profit foi corretamente atualizada.';
        END IF;
    END IF;
    
    -- Verificar calculate_commission_values
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'calculate_commission_values' 
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        SELECT pg_get_functiondef(oid) INTO func_def
        FROM pg_proc 
        WHERE proname = 'calculate_commission_values' 
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
        
        IF func_def LIKE '%professionals.commission_rate%' OR func_def LIKE '%p.commission_rate%' THEN
            RAISE WARNING 'PROBLEMA ENCONTRADO: A função calculate_commission_values ainda contém referências à coluna commission_rate dos profissionais!';
            issues_found := TRUE;
        ELSE
            RAISE NOTICE 'OK: A função calculate_commission_values foi corretamente atualizada.';
        END IF;
    END IF;
    
    -- Verificar finalize_appointment
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'finalize_appointment' 
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        SELECT pg_get_functiondef(oid) INTO func_def
        FROM pg_proc 
        WHERE proname = 'finalize_appointment' 
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
        
        IF func_def LIKE '%professionals.commission_rate%' OR func_def LIKE '%p.commission_rate%' THEN
            RAISE WARNING 'PROBLEMA ENCONTRADO: A função finalize_appointment ainda contém referências à coluna commission_rate dos profissionais!';
            issues_found := TRUE;
        ELSE
            RAISE NOTICE 'OK: A função finalize_appointment foi corretamente atualizada.';
        END IF;
    END IF;
    
    -- 5. Conclusão da verificação
    IF issues_found THEN
        RAISE WARNING '===== VERIFICAÇÃO FINAL: AINDA EXISTEM PROBLEMAS A SEREM CORRIGIDOS! =====';
        RAISE WARNING 'Por favor, execute novamente os scripts de migração anteriores ou corrija manualmente os problemas reportados.';
    ELSE
        RAISE NOTICE '===== VERIFICAÇÃO FINAL: TODAS AS REFERÊNCIAS FORAM CORRETAMENTE ATUALIZADAS! =====';
        RAISE NOTICE 'O sistema agora usa exclusivamente services.commission_rate para os cálculos de comissão.';
    END IF;
END;
$$; 