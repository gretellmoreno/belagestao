-- Script para corrigir a função calculate_salon_profit
-- Esta função pode estar causando o erro de p.commission_rate not exist

DO $$
BEGIN
    -- Verificar se a função existe
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'calculate_salon_profit' 
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN
        -- Recriar a função calculate_salon_profit para usar s.commission_rate em vez de p.commission_rate
        EXECUTE '
        CREATE OR REPLACE FUNCTION calculate_salon_profit(appointment_id UUID)
        RETURNS DECIMAL
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        DECLARE
            total_price DECIMAL DEFAULT 0;
            total_commission DECIMAL DEFAULT 0;
            total_profit DECIMAL DEFAULT 0;
            appointment_record RECORD;
            service_record RECORD;
        BEGIN
            -- Verificar se o agendamento existe
            SELECT * INTO appointment_record 
            FROM appointments a
            WHERE a.id = calculate_salon_profit.appointment_id;
            
            IF NOT FOUND THEN
                RAISE EXCEPTION ''Agendamento não encontrado'';
            END IF;
            
            -- Calcular o lucro do salão para cada serviço no agendamento
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
                    as_update.appointment_id = calculate_salon_profit.appointment_id
            LOOP
                -- Adicionar ao preço total
                total_price := total_price + COALESCE(service_record.custom_price, 0);
                
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
            
            -- Calcular lucro do salão (valor total - comissão total)
            total_profit := total_price - total_commission;
            
            -- Atualizar o campo salon_profit no registro do agendamento
            UPDATE appointments
            SET 
                salon_profit = total_profit,
                updated_at = NOW()
            WHERE id = calculate_salon_profit.appointment_id;
            
            RETURN total_profit;
        END;
        $$;
        ';
        
        RAISE NOTICE 'Função calculate_salon_profit atualizada com sucesso.';
    ELSE
        -- Criar a função se não existir
        EXECUTE '
        CREATE OR REPLACE FUNCTION calculate_salon_profit(appointment_id UUID)
        RETURNS DECIMAL
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        DECLARE
            total_price DECIMAL DEFAULT 0;
            total_commission DECIMAL DEFAULT 0;
            total_profit DECIMAL DEFAULT 0;
            appointment_record RECORD;
            service_record RECORD;
        BEGIN
            -- Verificar se o agendamento existe
            SELECT * INTO appointment_record 
            FROM appointments a
            WHERE a.id = calculate_salon_profit.appointment_id;
            
            IF NOT FOUND THEN
                RAISE EXCEPTION ''Agendamento não encontrado'';
            END IF;
            
            -- Calcular o lucro do salão para cada serviço no agendamento
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
                    as_update.appointment_id = calculate_salon_profit.appointment_id
            LOOP
                -- Adicionar ao preço total
                total_price := total_price + COALESCE(service_record.custom_price, 0);
                
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
            
            -- Calcular lucro do salão (valor total - comissão total)
            total_profit := total_price - total_commission;
            
            -- Atualizar o campo salon_profit no registro do agendamento
            UPDATE appointments
            SET 
                salon_profit = total_profit,
                updated_at = NOW()
            WHERE id = calculate_salon_profit.appointment_id;
            
            RETURN total_profit;
        END;
        $$;
        ';
        
        RAISE NOTICE 'Função calculate_salon_profit criada com sucesso.';
    END IF;
END;
$$; 