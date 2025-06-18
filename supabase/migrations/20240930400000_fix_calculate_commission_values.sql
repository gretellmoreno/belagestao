-- Script para corrigir a função calculate_commission_values
-- Esta função pode estar causando o erro de p.commission_rate not exist

DO $$
BEGIN
    -- Verificar se a função existe
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'calculate_commission_values' 
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        -- Recriar a função calculate_commission_values para usar s.commission_rate em vez de p.commission_rate
        EXECUTE '
        CREATE OR REPLACE FUNCTION calculate_commission_values(
            _appointment_id UUID,
            _update_appointment BOOLEAN DEFAULT true
        )
        RETURNS JSON
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        DECLARE
            total_services_value DECIMAL DEFAULT 0;
            total_commission DECIMAL DEFAULT 0;
            result_json JSON;
            appointment_record RECORD;
            service_record RECORD;
        BEGIN
            -- Verificar se o agendamento existe
            SELECT * INTO appointment_record 
            FROM appointments a
            WHERE a.id = calculate_commission_values._appointment_id;
            
            IF NOT FOUND THEN
                RETURN json_build_object(
                    ''success'', false,
                    ''message'', ''Agendamento não encontrado''
                );
            END IF;
            
            -- Calcular o valor total dos serviços e a comissão total
            FOR service_record IN
                SELECT 
                    as_update.custom_price,
                    as_update.payment_method_id,
                    as_update.discount_payment_fee,
                    as_update.service_id,
                    pm.fee,
                    s.commission_rate
                FROM 
                    appointment_services as_update
                    LEFT JOIN payment_methods pm ON as_update.payment_method_id = pm.id
                    LEFT JOIN services s ON as_update.service_id = s.id
                WHERE 
                    as_update.appointment_id = calculate_commission_values._appointment_id
            LOOP
                -- Somar ao valor total dos serviços
                total_services_value := total_services_value + COALESCE(service_record.custom_price, 0);
                
                -- Calcular comissão para este serviço
                DECLARE
                    service_commission DECIMAL;
                    service_commission_rate DECIMAL := COALESCE(service_record.commission_rate, 40);
                    net_service_value DECIMAL;
                BEGIN
                    -- Calcular valor líquido (após descontar taxa do método de pagamento, se aplicável)
                    IF service_record.payment_method_id IS NOT NULL AND service_record.fee > 0 AND service_record.discount_payment_fee = true THEN
                        net_service_value := service_record.custom_price - (service_record.custom_price * service_record.fee / 100);
                        
                        -- Calcular comissão sobre o valor líquido
                        service_commission := net_service_value * service_commission_rate / 100;
                    ELSE
                        -- Calcular comissão sobre o valor bruto
                        service_commission := service_record.custom_price * service_commission_rate / 100;
                    END IF;
                    
                    -- Adicionar à comissão total
                    total_commission := total_commission + service_commission;
                END;
            END LOOP;
            
            -- Se solicitado, atualizar o registro do agendamento com os valores calculados
            IF _update_appointment THEN
                UPDATE appointments
                SET 
                    services_total_value = total_services_value,
                    commission_amount = total_commission,
                    updated_at = NOW()
                WHERE id = calculate_commission_values._appointment_id;
            END IF;
            
            -- Retornar os valores calculados como JSON
            result_json := json_build_object(
                ''success'', true,
                ''appointment_id'', calculate_commission_values._appointment_id,
                ''services_total_value'', total_services_value,
                ''commission_amount'', total_commission
            );
            
            RETURN result_json;
        END;
        $$;
        ';
        
        RAISE NOTICE 'Função calculate_commission_values atualizada com sucesso.';
    ELSE
        -- Criar a função se não existir
        EXECUTE '
        CREATE OR REPLACE FUNCTION calculate_commission_values(
            _appointment_id UUID,
            _update_appointment BOOLEAN DEFAULT true
        )
        RETURNS JSON
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        DECLARE
            total_services_value DECIMAL DEFAULT 0;
            total_commission DECIMAL DEFAULT 0;
            result_json JSON;
            appointment_record RECORD;
            service_record RECORD;
        BEGIN
            -- Verificar se o agendamento existe
            SELECT * INTO appointment_record 
            FROM appointments a
            WHERE a.id = calculate_commission_values._appointment_id;
            
            IF NOT FOUND THEN
                RETURN json_build_object(
                    ''success'', false,
                    ''message'', ''Agendamento não encontrado''
                );
            END IF;
            
            -- Calcular o valor total dos serviços e a comissão total
            FOR service_record IN
                SELECT 
                    as_update.custom_price,
                    as_update.payment_method_id,
                    as_update.discount_payment_fee,
                    as_update.service_id,
                    pm.fee,
                    s.commission_rate
                FROM 
                    appointment_services as_update
                    LEFT JOIN payment_methods pm ON as_update.payment_method_id = pm.id
                    LEFT JOIN services s ON as_update.service_id = s.id
                WHERE 
                    as_update.appointment_id = calculate_commission_values._appointment_id
            LOOP
                -- Somar ao valor total dos serviços
                total_services_value := total_services_value + COALESCE(service_record.custom_price, 0);
                
                -- Calcular comissão para este serviço
                DECLARE
                    service_commission DECIMAL;
                    service_commission_rate DECIMAL := COALESCE(service_record.commission_rate, 40);
                    net_service_value DECIMAL;
                BEGIN
                    -- Calcular valor líquido (após descontar taxa do método de pagamento, se aplicável)
                    IF service_record.payment_method_id IS NOT NULL AND service_record.fee > 0 AND service_record.discount_payment_fee = true THEN
                        net_service_value := service_record.custom_price - (service_record.custom_price * service_record.fee / 100);
                        
                        -- Calcular comissão sobre o valor líquido
                        service_commission := net_service_value * service_commission_rate / 100;
                    ELSE
                        -- Calcular comissão sobre o valor bruto
                        service_commission := service_record.custom_price * service_commission_rate / 100;
                    END IF;
                    
                    -- Adicionar à comissão total
                    total_commission := total_commission + service_commission;
                END;
            END LOOP;
            
            -- Se solicitado, atualizar o registro do agendamento com os valores calculados
            IF _update_appointment THEN
                UPDATE appointments
                SET 
                    services_total_value = total_services_value,
                    commission_amount = total_commission,
                    updated_at = NOW()
                WHERE id = calculate_commission_values._appointment_id;
            END IF;
            
            -- Retornar os valores calculados como JSON
            result_json := json_build_object(
                ''success'', true,
                ''appointment_id'', calculate_commission_values._appointment_id,
                ''services_total_value'', total_services_value,
                ''commission_amount'', total_commission
            );
            
            RETURN result_json;
        END;
        $$;
        ';
        
        RAISE NOTICE 'Função calculate_commission_values criada com sucesso.';
    END IF;
END;
$$; 