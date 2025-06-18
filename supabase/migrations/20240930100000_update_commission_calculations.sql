-- Script para atualizar os cálculos de comissão existentes
-- Este script atualiza os appointment_services existentes
-- para usar a comissão do serviço em vez da comissão do profissional

DO $$
DECLARE
    appointment_service_record RECORD;
    service_commission_rate DECIMAL(5,2);
BEGIN
    RAISE NOTICE 'Iniciando atualização dos cálculos de comissão...';
    
    -- Iterar por todos os appointment_services existentes
    FOR appointment_service_record IN 
        SELECT 
            as_update.id,
            as_update.service_id,
            as_update.custom_price,
            as_update.payment_method_id,
            as_update.discount_payment_fee,
            pm.fee,
            as_update.commission_rate AS old_commission_rate
        FROM 
            appointment_services as_update
            LEFT JOIN payment_methods pm ON as_update.payment_method_id = pm.id
    LOOP
        -- Obter a taxa de comissão do serviço
        SELECT commission_rate INTO service_commission_rate
        FROM services
        WHERE id = appointment_service_record.service_id;
        
        -- Se não encontrar um valor de comissão no serviço, definir um valor padrão de 40%
        IF service_commission_rate IS NULL THEN
            service_commission_rate := 40.0;
        END IF;
        
        -- Atualizar a comissão com base na taxa do serviço
        UPDATE appointment_services
        SET 
            -- Nova taxa de comissão (do serviço)
            commission_rate = service_commission_rate,
            
            -- Recalcular o valor da comissão
            commission_amount = CASE 
                WHEN appointment_service_record.payment_method_id IS NOT NULL 
                     AND appointment_service_record.fee > 0 
                     AND appointment_service_record.discount_payment_fee = true
                THEN (appointment_service_record.custom_price - 
                     (appointment_service_record.custom_price * appointment_service_record.fee / 100)) * 
                     service_commission_rate / 100
                ELSE appointment_service_record.custom_price * service_commission_rate / 100
            END,
            
            -- Recalcular o lucro do salão
            salon_profit = CASE 
                WHEN appointment_service_record.payment_method_id IS NOT NULL 
                     AND appointment_service_record.fee > 0 
                     AND appointment_service_record.discount_payment_fee = true
                THEN (appointment_service_record.custom_price - 
                     (appointment_service_record.custom_price * appointment_service_record.fee / 100)) - 
                     ((appointment_service_record.custom_price - 
                     (appointment_service_record.custom_price * appointment_service_record.fee / 100)) * 
                     service_commission_rate / 100)
                ELSE appointment_service_record.custom_price - 
                     (appointment_service_record.custom_price * service_commission_rate / 100)
            END
        WHERE 
            id = appointment_service_record.id;
    END LOOP;
    
    RAISE NOTICE 'Atualização dos cálculos de comissão concluída com sucesso!';
END;
$$; 