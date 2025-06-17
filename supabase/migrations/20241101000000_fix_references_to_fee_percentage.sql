-- Migração para corrigir referências a fee_percentage
-- Data: 2024-11-01

-- Esta migração corrige qualquer referência restante à coluna fee_percentage
-- que foi renomeada para fee na tabela payment_methods

-- 1. Verificar e corrigir todas as funções e triggers que referenciam fee_percentage
DO $$
DECLARE
    func_record RECORD;
    func_def TEXT;
    updated_def TEXT;
BEGIN
    RAISE NOTICE 'Iniciando correção de referências a fee_percentage...';

    -- Looping por todas as funções que podem conter fee_percentage em sua definição
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

    RAISE NOTICE 'Correção de referências a fee_percentage concluída.';
END $$;

-- 2. Recriar a função finalize_appointment que é crítica para o sistema
-- Este é um backup para garantir que essa função específica esteja correta
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
            LEFT JOIN professionals p ON a.professional_id = p.id
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