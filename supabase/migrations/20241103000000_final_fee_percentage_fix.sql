-- Migração final para remover todas as referências a fee_percentage
-- Data: 2024-11-03

DO $$
DECLARE
    func_record RECORD;
    view_record RECORD;
    trigger_record RECORD;
    func_def TEXT;
    updated_def TEXT;
BEGIN
    -- 1. Verificar e corrigir todas as funções
    FOR func_record IN
        SELECT p.proname as func_name, n.nspname as schema_name, p.oid
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
    LOOP
        func_def := pg_get_functiondef(func_record.oid);
        
        IF func_def LIKE '%fee_percentage%' THEN
            -- Substituir fee_percentage por fee
            updated_def := REPLACE(func_def, 'fee_percentage', 'fee');
            
            -- Executar o comando para recriar a função
            EXECUTE updated_def;
        END IF;
    END LOOP;

    -- 2. Verificar e corrigir todas as views
    FOR view_record IN
        SELECT viewname, schemaname
        FROM pg_views
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
    LOOP
        EXECUTE format('
            SELECT pg_get_viewdef(''%I.%I'', true) AS view_def
        ', view_record.schemaname, view_record.viewname) INTO func_def;

        IF func_def LIKE '%fee_percentage%' THEN
            -- Substituir fee_percentage por fee
            updated_def := REPLACE(func_def, 'fee_percentage', 'fee');
            
            -- Recriar a view
            EXECUTE format('CREATE OR REPLACE VIEW %I.%I AS %s',
                view_record.schemaname, view_record.viewname, updated_def);
        END IF;
    END LOOP;

    -- 3. Verificar e corrigir todos os triggers
    FOR trigger_record IN
        SELECT 
            t.tgname AS trigger_name,
            c.relname AS table_name,
            n.nspname AS schema_name,
            p.proname AS function_name,
            p.oid AS function_oid
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        JOIN pg_proc p ON t.tgfoid = p.oid
        WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
    LOOP
        func_def := pg_get_functiondef(trigger_record.function_oid);
        
        IF func_def LIKE '%fee_percentage%' THEN
            -- Substituir fee_percentage por fee
            updated_def := REPLACE(func_def, 'fee_percentage', 'fee');
            
            -- Recriar a função do trigger
            EXECUTE updated_def;
        END IF;
    END LOOP;

    -- 4. Garantir que a coluna fee_percentage não existe mais
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'payment_methods' 
        AND column_name = 'fee_percentage'
    ) THEN
        -- Migrar dados restantes se necessário
        UPDATE payment_methods 
        SET fee = fee_percentage 
        WHERE fee IS NULL AND fee_percentage IS NOT NULL;
        
        -- Remover a coluna
        ALTER TABLE payment_methods DROP COLUMN IF EXISTS fee_percentage;
    END IF;

    -- 5. Recriar a função finalize_appointment para garantir que está correta
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
            RETURN json_build_object('success', false, 'message', 'Agendamento não encontrado');
        END IF;
        
        -- 1. Atualizar o status do agendamento para "finalizado"
        UPDATE appointments 
        SET 
            status = 'finalizado',
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
                status = 'finalizado',
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
                'success', true,
                'appointment_id', finalize_appointment._appointment_id,
                'status', 'finalizado',
                'message', 'Agendamento finalizado com sucesso',
                'updated_services', COALESCE(json_agg(updated_services), '[]'::json)
            ) INTO result
        FROM 
            updated_services;
        
        -- Se não houver serviços atualizados, ainda assim retornar sucesso
        IF result IS NULL THEN
            result := json_build_object(
                'success', true,
                'appointment_id', finalize_appointment._appointment_id,
                'status', 'finalizado',
                'message', 'Agendamento finalizado com sucesso, mas nenhum serviço foi encontrado',
                'updated_services', '[]'::json
            );
        END IF;
        
        RETURN result;
    END;
    $$;

    -- 6. Recriar a função calculate_net_service_value para garantir que está correta
    CREATE OR REPLACE FUNCTION calculate_net_service_value()
    RETURNS TRIGGER AS $$
    DECLARE
        payment_fee_percent DECIMAL;
        fee_amount DECIMAL;
    BEGIN
        -- Buscar a taxa do método de pagamento
        SELECT fee INTO payment_fee_percent
        FROM payment_methods
        WHERE id = NEW.payment_method_id;

        -- Definir valor padrão para a taxa se não encontrada
        payment_fee_percent := COALESCE(payment_fee_percent, 0);
        
        -- Calcular o valor da taxa de pagamento
        fee_amount := (NEW.custom_price * payment_fee_percent / 100);
        
        -- Atualizar o payment_fee apenas se não foi explicitamente definido
        IF NEW.payment_fee IS NULL THEN
            NEW.payment_fee := fee_amount;
        END IF;
        
        -- Calcular o valor líquido do serviço (após descontar a taxa de pagamento)
        NEW.net_service_value := NEW.custom_price - COALESCE(NEW.payment_fee, 0);
        
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

END $$; 