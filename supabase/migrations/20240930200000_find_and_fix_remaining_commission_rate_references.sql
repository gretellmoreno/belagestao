-- Script para identificar e corrigir todas as referências remanescentes a p.commission_rate
-- Este script verifica todas as funções, views e triggers no banco de dados
-- e corrige qualquer referência a p.commission_rate ou professionals.commission_rate

DO $$
DECLARE
    func_record RECORD;
    func_def TEXT;
    updated_def TEXT;
    view_record RECORD;
    view_def TEXT;
    updated_view_def TEXT;
    found_references BOOLEAN := FALSE;
BEGIN
    -- 1. VERIFICAR E CORRIGIR FUNÇÕES
    RAISE NOTICE '----- VERIFICANDO FUNÇÕES NO BANCO DE DADOS -----';
    
    FOR func_record IN
        SELECT n.nspname AS schema_name, p.proname AS function_name, p.oid AS function_id
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
    LOOP
        -- Obter a definição da função
        func_def := pg_get_functiondef(func_record.function_id);
        
        -- Verificar se a definição contém alguma referência a p.commission_rate ou professionals.commission_rate
        IF 
            func_def LIKE '%p.commission_rate%' OR 
            func_def LIKE '%professionals.commission_rate%' OR
            func_def LIKE '%\"commission_rate\"%professionals%'
        THEN
            found_references := TRUE;
            RAISE NOTICE 'Encontrada referência a commission_rate na função %.%', 
                func_record.schema_name, func_record.function_name;
            
            -- Substituir todas as ocorrências por s.commission_rate
            -- 1. Substituir p.commission_rate por s.commission_rate
            updated_def := REPLACE(func_def, 'p.commission_rate', 's.commission_rate');
            
            -- 2. Substituir professionals.commission_rate por s.commission_rate
            updated_def := REPLACE(updated_def, 'professionals.commission_rate', 's.commission_rate');
            
            -- 3. Substituir "p"."commission_rate" por "s"."commission_rate"
            updated_def := REPLACE(updated_def, '"p"."commission_rate"', '"s"."commission_rate"');
            
            -- 4. Substituir "professionals"."commission_rate" por "s"."commission_rate"
            updated_def := REPLACE(updated_def, '"professionals"."commission_rate"', '"s"."commission_rate"');
            
            -- 5. Substituir COALESCE(professionals.commission_rate, X) por COALESCE(s.commission_rate, X)
            updated_def := REGEXP_REPLACE(updated_def, 'COALESCE\s*\(\s*professionals\.commission_rate', 'COALESCE(s.commission_rate', 'g');
            updated_def := REGEXP_REPLACE(updated_def, 'COALESCE\s*\(\s*p\.commission_rate', 'COALESCE(s.commission_rate', 'g');
            
            -- Verificar se a função faz JOIN com a tabela services
            IF func_def NOT LIKE '%JOIN%services%' AND func_def LIKE '%FROM%appointment_services%' THEN
                -- Se a função usa appointment_services mas não faz JOIN com services, adicionar o JOIN
                updated_def := REGEXP_REPLACE(
                    updated_def,
                    'LEFT JOIN professionals (.*?) ON (.*?)(\s+WHERE|\s+GROUP BY|\s+ORDER BY|\s+LIMIT|\s+RETURNING|\s+\))',
                    'LEFT JOIN professionals \1 ON \2
            LEFT JOIN services s ON appointment_services.service_id = s.id\3',
                    'g'
                );
            END IF;
            
            -- Se a função usar appointment_services AS as_update, modificar o JOIN para incluir services
            IF func_def LIKE '%appointment_services AS as_update%' AND func_def NOT LIKE '%JOIN%services s ON as_update.service_id%' THEN
                updated_def := REGEXP_REPLACE(
                    updated_def,
                    'LEFT JOIN professionals (.*?) ON (.*?)(\s+WHERE|\s+GROUP BY|\s+ORDER BY|\s+LIMIT|\s+RETURNING|\s+\))',
                    'LEFT JOIN professionals \1 ON \2
            LEFT JOIN services s ON as_update.service_id = s.id\3',
                    'g'
                );
            END IF;
            
            -- Tentar executar a definição atualizada da função
            BEGIN
                EXECUTE updated_def;
                RAISE NOTICE 'Função %.% atualizada com sucesso.', func_record.schema_name, func_record.function_name;
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Erro ao atualizar função %.%: %', func_record.schema_name, func_record.function_name, SQLERRM;
            END;
        END IF;
    END LOOP;
    
    -- 2. VERIFICAR E CORRIGIR VIEWS
    RAISE NOTICE '----- VERIFICANDO VIEWS NO BANCO DE DADOS -----';
    
    FOR view_record IN
        SELECT n.nspname AS schema_name, c.relname AS view_name, c.oid AS view_id
        FROM pg_class c
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE c.relkind = 'v' AND n.nspname = 'public'
    LOOP
        -- Obter a definição da view
        SELECT pg_get_viewdef(view_record.view_id) INTO view_def;
        
        -- Verificar se a definição contém alguma referência a p.commission_rate ou professionals.commission_rate
        IF 
            view_def LIKE '%p.commission_rate%' OR 
            view_def LIKE '%professionals.commission_rate%' OR
            view_def LIKE '%\"commission_rate\"%professionals%'
        THEN
            found_references := TRUE;
            RAISE NOTICE 'Encontrada referência a commission_rate na view %.%', 
                view_record.schema_name, view_record.view_name;
            
            -- Substituir todas as ocorrências por s.commission_rate
            -- 1. Substituir p.commission_rate por s.commission_rate
            updated_view_def := REPLACE(view_def, 'p.commission_rate', 's.commission_rate');
            
            -- 2. Substituir professionals.commission_rate por s.commission_rate
            updated_view_def := REPLACE(updated_view_def, 'professionals.commission_rate', 's.commission_rate');
            
            -- Adicionar JOIN com services se necessário
            IF view_def NOT LIKE '%JOIN%services%' AND view_def LIKE '%FROM%appointment_services%' THEN
                updated_view_def := REGEXP_REPLACE(
                    updated_view_def,
                    'LEFT JOIN professionals (.*?) ON (.*?)(\s+WHERE|\s+GROUP BY|\s+ORDER BY|\s+LIMIT|\s+\))',
                    'LEFT JOIN professionals \1 ON \2
            LEFT JOIN services s ON appointment_services.service_id = s.id\3',
                    'g'
                );
            END IF;
            
            -- Recriar a view com a definição atualizada
            BEGIN
                EXECUTE 'CREATE OR REPLACE VIEW ' || view_record.schema_name || '.' || view_record.view_name || ' AS ' || updated_view_def;
                RAISE NOTICE 'View %.% atualizada com sucesso.', view_record.schema_name, view_record.view_name;
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Erro ao atualizar view %.%: %', view_record.schema_name, view_record.view_name, SQLERRM;
            END;
        END IF;
    END LOOP;
    
    -- 3. Verificar e corrigir qualquer ocorrência de professionals.commission_rate em finalize_appointment
    RAISE NOTICE '----- VERIFICANDO E ATUALIZANDO finalize_appointment -----';
    
    -- Garantir que a função finalize_appointment use s.commission_rate
    EXECUTE '
    CREATE OR REPLACE FUNCTION finalize_appointment(_appointment_id UUID)
    RETURNS JSON
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
        result JSON;
        appointment_record RECORD;
    BEGIN
        -- Verificar se o agendamento existe
        SELECT * INTO appointment_record FROM appointments 
        WHERE id = finalize_appointment._appointment_id;
        
        IF NOT FOUND THEN
            RETURN json_build_object(''success'', false, ''message'', ''Agendamento não encontrado'');
        END IF;
        
        -- 1. Atualizar o status do agendamento para "finalizado"
        UPDATE appointments 
        SET 
            status = ''finalizado'',
            updated_at = NOW()
        WHERE id = finalize_appointment._appointment_id;
        
        -- 2. Para cada serviço no agendamento, calcular os valores financeiros
        WITH updated_services AS (
            UPDATE appointment_services AS as_update
            SET 
                -- Calcular valores financeiros para cada serviço
                net_service_value = CASE 
                    WHEN as_update.payment_method_id IS NOT NULL AND pm.fee > 0 
                    THEN as_update.custom_price - (as_update.custom_price * pm.fee / 100)
                    ELSE as_update.custom_price
                END,
                
                -- Taxa de pagamento aplicada a este serviço
                payment_fee = CASE 
                    WHEN as_update.payment_method_id IS NOT NULL AND pm.fee > 0 
                    THEN as_update.custom_price * pm.fee / 100
                    ELSE 0
                END,
                
                -- Comissão do profissional (usando a taxa de comissão do serviço)
                commission_amount = CASE 
                    WHEN as_update.payment_method_id IS NOT NULL AND pm.fee > 0 AND as_update.discount_payment_fee = true
                    THEN (as_update.custom_price - (as_update.custom_price * pm.fee / 100)) * COALESCE(s.commission_rate, 40) / 100
                    ELSE as_update.custom_price * COALESCE(s.commission_rate, 40) / 100
                END,
                
                -- Registrar a taxa de comissão usada
                commission_rate = COALESCE(s.commission_rate, 40),
                
                -- Lucro do salão = Valor líquido - Comissão do profissional
                salon_profit = CASE 
                    WHEN as_update.payment_method_id IS NOT NULL AND pm.fee > 0 AND as_update.discount_payment_fee = true
                    THEN (as_update.custom_price - (as_update.custom_price * pm.fee / 100)) - 
                         ((as_update.custom_price - (as_update.custom_price * pm.fee / 100)) * COALESCE(s.commission_rate, 40) / 100)
                    ELSE as_update.custom_price - (as_update.custom_price * COALESCE(s.commission_rate, 40) / 100)
                END,
                
                -- Marcar como concluído
                status = ''finalizado'',
                updated_at = NOW()
            FROM 
                appointments a
                LEFT JOIN professionals ON a.professional_id = professionals.id
                LEFT JOIN payment_methods pm ON as_update.payment_method_id = pm.id
                LEFT JOIN services s ON as_update.service_id = s.id
            WHERE 
                as_update.appointment_id = finalize_appointment._appointment_id
                AND a.id = finalize_appointment._appointment_id
            RETURNING 
                as_update.*
        )
        
        -- 3. Retornar informações sobre a atualização
        SELECT 
            json_build_object(
                ''success'', true,
                ''appointment_id'', finalize_appointment._appointment_id,
                ''status'', ''finalizado'',
                ''message'', ''Agendamento finalizado com sucesso'',
                ''updated_services'', COALESCE(json_agg(updated_services), ''[]''::json)
            ) INTO result
        FROM 
            updated_services;
        
        -- Se não houver serviços atualizados, ainda assim retornar sucesso
        IF result IS NULL THEN
            result := json_build_object(
                ''success'', true,
                ''appointment_id'', finalize_appointment._appointment_id,
                ''status'', ''finalizado'',
                ''message'', ''Agendamento finalizado com sucesso, mas nenhum serviço foi encontrado'',
                ''updated_services'', ''[]''::json
            );
        END IF;
        
        RETURN result;
    END;
    $$;
    ';
    
    -- 4. VERIFICAR QUALQUER OUTRA REFERÊNCIA DIRETA
    RAISE NOTICE '----- VERIFICANDO REFERÊNCIAS DIRETAS EM TODAS AS FUNÇÕES -----';
    
    FOR func_record IN
        SELECT n.nspname AS schema_name, p.proname AS function_name, p.oid AS function_id
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
    LOOP
        -- Obter a definição da função
        func_def := pg_get_functiondef(func_record.function_id);
        
        -- Verificar se a definição contém "professionals" e "commission_rate" próximos
        IF func_def ~* '.*professionals.*commission_rate.*' OR func_def ~* '.*commission_rate.*professionals.*' THEN
            RAISE NOTICE 'Possível referência a commission_rate relacionada a professionals em %.%', 
                func_record.schema_name, func_record.function_name;
        END IF;
    END LOOP;
    
    -- 5. VERIFICAR REFERÊNCIAS EM procedure_commission
    RAISE NOTICE '----- VERIFICANDO procedure_commission -----';
    
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'procedure_commission' 
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        EXECUTE '
        CREATE OR REPLACE FUNCTION procedure_commission(
            _service_id UUID,
            _professional_id UUID,
            _custom_price DECIMAL DEFAULT NULL
        )
        RETURNS DECIMAL
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        DECLARE
            service_commission_rate DECIMAL;
            commission_amount DECIMAL;
            price_value DECIMAL;
        BEGIN
            -- Obter a taxa de comissão do serviço
            SELECT commission_rate INTO service_commission_rate
            FROM services
            WHERE id = _service_id;
            
            -- Se não encontrar serviço ou taxa de comissão, usar valor padrão de 40%
            IF service_commission_rate IS NULL THEN
                service_commission_rate := 40;
            END IF;
            
            -- Determinar o preço a ser usado
            IF _custom_price IS NOT NULL AND _custom_price > 0 THEN
                price_value := _custom_price;
            ELSE
                -- Obter o preço padrão do serviço
                SELECT price INTO price_value
                FROM services
                WHERE id = _service_id;
                
                -- Se não encontrar preço, retornar zero
                IF price_value IS NULL THEN
                    RETURN 0;
                END IF;
            END IF;
            
            -- Calcular a comissão
            commission_amount := price_value * service_commission_rate / 100;
            
            RETURN commission_amount;
        END;
        $$;
        ';
        
        RAISE NOTICE 'Função procedure_commission atualizada com sucesso.';
    END IF;

    IF NOT found_references THEN
        RAISE NOTICE 'Nenhuma referência a p.commission_rate ou professionals.commission_rate foi encontrada.';
    END IF;
    
    RAISE NOTICE 'Verificação e atualização concluídas com sucesso!';
END;
$$; 