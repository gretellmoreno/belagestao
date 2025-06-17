-- Migração para garantir que todos os triggers que usam a coluna fee estão corretos
-- Data: 2024-11-03

-- 1. Recriar o trigger para calcular o valor líquido do serviço
DROP TRIGGER IF EXISTS calculate_net_service_value_trigger ON appointment_services;

CREATE TRIGGER calculate_net_service_value_trigger
    BEFORE INSERT OR UPDATE ON appointment_services
    FOR EACH ROW
    EXECUTE FUNCTION calculate_net_service_value();

-- 2. Recriar o trigger para calcular o valor líquido do produto
DROP TRIGGER IF EXISTS calculate_net_product_value_trigger ON product_sales;

CREATE OR REPLACE FUNCTION calculate_net_product_value()
RETURNS TRIGGER AS $$
DECLARE
    payment_fee_rate DECIMAL;
BEGIN
    -- Buscar a taxa do método de pagamento
    SELECT fee INTO payment_fee_rate
    FROM payment_methods
    WHERE id = NEW.payment_method_id;

    -- Definir valor padrão para a taxa se não encontrada
    payment_fee_rate := COALESCE(payment_fee_rate, 0);
    
    -- Calcular o valor da taxa de pagamento
    NEW.payment_fee := (NEW.gross_total * payment_fee_rate / 100);
    
    -- Calcular o valor líquido do produto (após descontar a taxa de pagamento)
    NEW.net_total := NEW.gross_total - COALESCE(NEW.payment_fee, 0);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_net_product_value_trigger
    BEFORE INSERT OR UPDATE ON product_sales
    FOR EACH ROW
    EXECUTE FUNCTION calculate_net_product_value();

-- 3. Recriar o trigger para atualizar o valor líquido quando a taxa do método de pagamento é alterada
DROP TRIGGER IF EXISTS update_net_values_on_fee_change_trigger ON payment_methods;

CREATE OR REPLACE FUNCTION update_net_values_on_fee_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Se a taxa foi alterada
    IF OLD.fee IS DISTINCT FROM NEW.fee THEN
        -- Atualizar valores líquidos dos serviços
        UPDATE appointment_services
        SET
            payment_fee = custom_price * NEW.fee / 100,
            net_service_value = custom_price - (custom_price * NEW.fee / 100)
        WHERE
            payment_method_id = NEW.id
            AND status = 'pendente';

        -- Atualizar valores líquidos dos produtos
        UPDATE product_sales
        SET
            payment_fee = gross_total * NEW.fee / 100,
            net_total = gross_total - (gross_total * NEW.fee / 100)
        WHERE
            payment_method_id = NEW.id
            AND status = 'pending';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_net_values_on_fee_change_trigger
    AFTER UPDATE ON payment_methods
    FOR EACH ROW
    EXECUTE FUNCTION update_net_values_on_fee_change(); 