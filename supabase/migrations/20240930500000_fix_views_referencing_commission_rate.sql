-- Script para identificar e corrigir todas as views que possam estar referenciando p.commission_rate
-- ou professionals.commission_rate

DO $$
DECLARE
    view_record RECORD;
    view_def TEXT;
    updated_view_def TEXT;
    found_views_count INTEGER := 0;
BEGIN
    RAISE NOTICE '----- VERIFICANDO VIEWS NO BANCO DE DADOS -----';
    
    FOR view_record IN
        SELECT 
            n.nspname AS schema_name, 
            c.relname AS view_name, 
            c.oid AS view_id
        FROM 
            pg_class c
            JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE 
            c.relkind = 'v' AND 
            n.nspname = 'public'
    LOOP
        -- Obter a definição da view
        SELECT pg_get_viewdef(view_record.view_id) INTO view_def;
        
        -- Verificar várias formas possíveis de referência à coluna commission_rate em professionals
        IF 
            view_def LIKE '%p.commission_rate%' OR 
            view_def LIKE '%professionals.commission_rate%' OR 
            view_def LIKE '%"professionals"."commission_rate"%' OR
            view_def LIKE '%professionals.%commission_rate%' OR
            view_def LIKE '%p.%commission_rate%'
        THEN
            found_views_count := found_views_count + 1;
            
            RAISE NOTICE 'Encontrada referência à commission_rate na view %.%', 
                view_record.schema_name, view_record.view_name;
            
            -- Substituir todas as ocorrências por s.commission_rate
            updated_view_def := view_def;
            
            -- 1. Substituir p.commission_rate por s.commission_rate
            updated_view_def := REPLACE(updated_view_def, 'p.commission_rate', 's.commission_rate');
            
            -- 2. Substituir "p"."commission_rate" por "s"."commission_rate"
            updated_view_def := REPLACE(updated_view_def, '"p"."commission_rate"', '"s"."commission_rate"');
            
            -- 3. Substituir professionals.commission_rate por s.commission_rate
            updated_view_def := REPLACE(updated_view_def, 'professionals.commission_rate', 's.commission_rate');
            
            -- 4. Substituir "professionals"."commission_rate" por "s"."commission_rate"
            updated_view_def := REPLACE(updated_view_def, '"professionals"."commission_rate"', '"s"."commission_rate"');
            
            -- Verificar se a view já faz join com a tabela services
            IF 
                updated_view_def NOT LIKE '%JOIN%services%' AND 
                (updated_view_def LIKE '%FROM%appointment_services%' OR 
                 updated_view_def LIKE '%JOIN%appointment_services%')
            THEN
                -- Se a view usa appointment_services mas não faz join com services, adicionar o join
                IF updated_view_def LIKE '%LEFT JOIN%professionals%ON%' THEN
                    -- Se há um LEFT JOIN com professionals, adicionar services depois
                    updated_view_def := REGEXP_REPLACE(
                        updated_view_def,
                        '(LEFT JOIN professionals.*?ON.*?)(\s+(?:LEFT JOIN|WHERE|GROUP BY|ORDER BY|LIMIT))',
                        E'\\1\n  LEFT JOIN services s ON appointment_services.service_id = s.id\\2',
                        'g'
                    );
                ELSIF updated_view_def LIKE '%JOIN%professionals%ON%' THEN
                    -- Se há um JOIN com professionals, adicionar services depois
                    updated_view_def := REGEXP_REPLACE(
                        updated_view_def,
                        '(JOIN professionals.*?ON.*?)(\s+(?:JOIN|WHERE|GROUP BY|ORDER BY|LIMIT))',
                        E'\\1\n  LEFT JOIN services s ON appointment_services.service_id = s.id\\2',
                        'g'
                    );
                ELSE
                    -- Se não há JOIN com professionals, verificar se há FROM appointment_services
                    updated_view_def := REGEXP_REPLACE(
                        updated_view_def,
                        'FROM\s+appointment_services(\s+(?:AS\s+\w+)?)',
                        E'FROM appointment_services\\1\n  LEFT JOIN services s ON appointment_services.service_id = s.id',
                        'g'
                    );
                END IF;
            END IF;
            
            -- Registrar a definição final da view para verificação
            RAISE NOTICE 'Nova definição da view %:', view_record.view_name;
            RAISE NOTICE '%', updated_view_def;
            
            -- Tentar recriar a view com a definição atualizada
            BEGIN
                EXECUTE 'CREATE OR REPLACE VIEW ' || 
                    quote_ident(view_record.schema_name) || '.' || 
                    quote_ident(view_record.view_name) || 
                    ' AS ' || updated_view_def;
                    
                RAISE NOTICE 'View %.% atualizada com sucesso.', 
                    view_record.schema_name, view_record.view_name;
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'Erro ao atualizar view %.%: %', 
                    view_record.schema_name, view_record.view_name, SQLERRM;
            END;
        END IF;
    END LOOP;
    
    IF found_views_count = 0 THEN
        RAISE NOTICE 'Nenhuma view encontrada com referência a p.commission_rate ou professionals.commission_rate.';
    ELSE
        RAISE NOTICE 'Total de views encontradas e corrigidas: %', found_views_count;
    END IF;
    
    RAISE NOTICE 'Verificação e atualização de views concluídas com sucesso!';
END;
$$; 