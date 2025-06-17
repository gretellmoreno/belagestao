-- Função para finalizar um agendamento e calcular os valores financeiros
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
            
            -- Comissão do profissional (usando a taxa de comissão do profissional)
            commission_amount = CASE 
                WHEN as_update.payment_method_id IS NOT NULL AND pm.fee > 0 AND as_update.discount_payment_fee = true
                THEN (as_update.custom_price - (as_update.custom_price * pm.fee / 100)) * COALESCE(professionals.commission_rate, 40) / 100
                ELSE as_update.custom_price * COALESCE(professionals.commission_rate, 40) / 100
            END,
            
            -- Registrar a taxa de comissão usada
            commission_rate = COALESCE(professionals.commission_rate, 40),
            
            -- Lucro do salão = Valor líquido - Comissão do profissional
            salon_profit = CASE 
                WHEN as_update.payment_method_id IS NOT NULL AND pm.fee > 0 AND as_update.discount_payment_fee = true
                THEN (as_update.custom_price - (as_update.custom_price * pm.fee / 100)) - 
                     ((as_update.custom_price - (as_update.custom_price * pm.fee / 100)) * COALESCE(professionals.commission_rate, 40) / 100)
                ELSE as_update.custom_price - (as_update.custom_price * COALESCE(professionals.commission_rate, 40) / 100)
            END,
            
            -- Marcar como concluído
            status = 'finalizado',
            updated_at = NOW()
        FROM 
            appointments a
            LEFT JOIN professionals ON a.professional_id = professionals.id
            LEFT JOIN payment_methods pm ON as_update.payment_method_id = pm.id
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