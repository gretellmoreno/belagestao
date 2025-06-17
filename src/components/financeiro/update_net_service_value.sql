-- Script para garantir que o campo net_service_value na tabela appointment_services esteja correto
-- Este script irá criar ou atualizar a função que calcula o valor líquido do serviço

DO $$
BEGIN
    -- Criar a função para calcular o net_service_value para cada serviço
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
        -- O valor líquido é o valor bruto menos a taxa de pagamento
        NEW.net_service_value := NEW.custom_price - COALESCE(NEW.payment_fee, 0);
        
        -- Calcular o lucro do profissional baseado na taxa de comissão do serviço
        DECLARE
            service_commission_rate DECIMAL;
        BEGIN
            -- Obter a taxa de comissão do serviço
            SELECT commission_rate INTO service_commission_rate
            FROM services
            WHERE id = NEW.service_id;
            
            -- Definir valor padrão para a taxa de comissão se não encontrada
            service_commission_rate := COALESCE(service_commission_rate, 40);
            
            -- Calcular o lucro do profissional (comissão)
            -- A comissão é calculada sobre o valor líquido
            NEW.professional_profit := NEW.net_service_value * (service_commission_rate / 100);
            
            -- Calcular o lucro do salão
            -- O lucro do salão é o valor líquido menos a comissão do profissional
            NEW.salon_profit := NEW.net_service_value - NEW.professional_profit;
        END;
        
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Verificar se o trigger já existe e removê-lo se necessário
    DROP TRIGGER IF EXISTS trg_calculate_net_service_value ON appointment_services;
    
    -- Criar o trigger para executar automaticamente quando um serviço for inserido ou atualizado
    CREATE TRIGGER trg_calculate_net_service_value
    BEFORE INSERT OR UPDATE ON appointment_services
    FOR EACH ROW
    EXECUTE FUNCTION calculate_net_service_value();
    
    -- Atualizar todos os registros existentes para garantir que o net_service_value seja recalculado
    UPDATE appointment_services
    SET net_service_value = NULL
    WHERE TRUE;
    
    RAISE NOTICE 'Trigger de cálculo de net_service_value criado e aplicado a todas as entradas existentes.';
    
    -- Função para recalcular o lucro total de um agendamento
    CREATE OR REPLACE FUNCTION calculate_total_net_value(appointment_id UUID)
    RETURNS DECIMAL AS $$
    DECLARE
        total_net_value DECIMAL DEFAULT 0;
    BEGIN
        -- Calcular a soma de net_service_value para todos os serviços do agendamento
        SELECT COALESCE(SUM(net_service_value), 0) INTO total_net_value
        FROM appointment_services
        WHERE appointment_id = calculate_total_net_value.appointment_id;
        
        RETURN total_net_value;
    END;
    $$ LANGUAGE plpgsql;
    
    -- Verificar se a coluna total_net_value existe na tabela appointments
    -- e criá-la se não existir
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'appointments'
        AND column_name = 'total_net_value'
    ) THEN
        ALTER TABLE appointments ADD COLUMN total_net_value DECIMAL;
        RAISE NOTICE 'Coluna total_net_value adicionada à tabela appointments';
    END IF;
    
    -- Criar a função para atualizar o total_net_value na tabela appointments
    CREATE OR REPLACE FUNCTION update_appointment_total_net_value()
    RETURNS TRIGGER AS $$
    DECLARE
        appointment_id UUID;
        calculated_net_value DECIMAL;
    BEGIN
        -- Determinar o appointment_id baseado no tipo de operação
        IF TG_OP = 'DELETE' THEN
            appointment_id := OLD.appointment_id;
        ELSE
            appointment_id := NEW.appointment_id;
        END IF;
        
        -- Calcular o total_net_value para o agendamento
        calculated_net_value := calculate_total_net_value(appointment_id);
        
        -- Atualizar o total_net_value na tabela appointments
        UPDATE appointments
        SET 
            total_net_value = calculated_net_value,
            updated_at = NOW()
        WHERE id = appointment_id;
        
        -- Retornar o registro apropriado
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END;
    $$ LANGUAGE plpgsql;
    
    -- Verificar se o trigger já existe e removê-lo se necessário
    DROP TRIGGER IF EXISTS trg_update_appointment_total_net_value ON appointment_services;
    
    -- Criar o trigger para atualizar o total_net_value quando serviços são modificados
    CREATE TRIGGER trg_update_appointment_total_net_value
    AFTER INSERT OR UPDATE OR DELETE ON appointment_services
    FOR EACH ROW
    EXECUTE FUNCTION update_appointment_total_net_value();
    
    -- Atualizar o total_net_value para todos os agendamentos existentes
    UPDATE appointments AS a
    SET total_net_value = (
        SELECT COALESCE(SUM(net_service_value), 0)
        FROM appointment_services
        WHERE appointment_id = a.id
    );
    
    RAISE NOTICE 'Sistema de cálculo de valor líquido instalado com sucesso!';
    RAISE NOTICE 'Os valores líquidos foram recalculados para todos os serviços e agendamentos.';
END;
$$; 