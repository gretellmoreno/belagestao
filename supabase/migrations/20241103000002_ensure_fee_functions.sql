-- Migração para garantir que todas as funções que usam a coluna fee estão corretas
-- Data: 2024-11-03

-- 1. Recriar a função calculate_payment_fee para usar a coluna fee
CREATE OR REPLACE FUNCTION calculate_payment_fee(
    _payment_method_id UUID,
    _amount DECIMAL
)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    payment_fee_rate DECIMAL;
BEGIN
    -- Buscar a taxa do método de pagamento
    SELECT fee INTO payment_fee_rate
    FROM payment_methods
    WHERE id = _payment_method_id;

    -- Se não encontrar o método de pagamento ou a taxa for nula, retornar 0
    IF payment_fee_rate IS NULL THEN
        RETURN 0;
    END IF;

    -- Calcular e retornar a taxa
    RETURN (_amount * payment_fee_rate / 100);
END;
$$;

-- 2. Recriar a função calculate_net_value para usar a coluna fee
CREATE OR REPLACE FUNCTION calculate_net_value(
    _gross_amount DECIMAL,
    _payment_method_id UUID,
    _discount_payment_fee BOOLEAN DEFAULT FALSE
)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    payment_fee_rate DECIMAL;
    payment_fee_amount DECIMAL;
BEGIN
    -- Buscar a taxa do método de pagamento
    SELECT fee INTO payment_fee_rate
    FROM payment_methods
    WHERE id = _payment_method_id;

    -- Se não encontrar o método de pagamento, a taxa for nula, ou não descontar a taxa
    IF payment_fee_rate IS NULL OR NOT _discount_payment_fee THEN
        RETURN _gross_amount;
    END IF;

    -- Calcular o valor da taxa
    payment_fee_amount := (_gross_amount * payment_fee_rate / 100);

    -- Retornar o valor líquido (valor bruto - taxa)
    RETURN (_gross_amount - payment_fee_amount);
END;
$$;

-- 3. Recriar a função get_payment_methods_summary para usar a coluna fee
CREATE OR REPLACE FUNCTION get_payment_methods_summary(
    data_inicio TIMESTAMP WITH TIME ZONE,
    data_fim TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
    payment_method_id UUID,
    payment_method_name TEXT,
    total_amount DECIMAL,
    total_fee DECIMAL,
    net_amount DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH payment_summary AS (
        -- Somar valores de serviços
        SELECT
            pm.id AS payment_method_id,
            pm.name AS payment_method_name,
            COALESCE(SUM(as_srv.custom_price), 0) as total_amount,
            COALESCE(SUM(as_srv.payment_fee), 0) as total_fee
        FROM
            payment_methods pm
            LEFT JOIN appointment_services as_srv ON pm.id = as_srv.payment_method_id
            LEFT JOIN appointments a ON as_srv.appointment_id = a.id
                AND a.status = 'finalizado'
                AND as_srv.updated_at >= data_inicio 
                AND as_srv.updated_at <= data_fim
        GROUP BY
            pm.id, pm.name

        UNION ALL

        -- Somar valores de produtos
        SELECT
            pm.id AS payment_method_id,
            pm.name AS payment_method_name,
            COALESCE(SUM(ps.gross_total), 0) as total_amount,
            COALESCE(SUM(ps.gross_total * pm.fee / 100), 0) as total_fee
        FROM
            payment_methods pm
            LEFT JOIN product_sales ps ON pm.id = ps.payment_method_id
                AND ps.status = 'completed'
                AND ps.updated_at >= data_inicio 
                AND ps.updated_at <= data_fim
        GROUP BY
            pm.id, pm.name
    )
    SELECT
        payment_method_id,
        payment_method_name,
        SUM(total_amount)::DECIMAL AS total_amount,
        SUM(total_fee)::DECIMAL AS total_fee,
        (SUM(total_amount) - SUM(total_fee))::DECIMAL AS net_amount
    FROM
        payment_summary
    GROUP BY
        payment_method_id, payment_method_name
    HAVING
        SUM(total_amount) > 0
    ORDER BY
        payment_method_name;
END;
$$; 