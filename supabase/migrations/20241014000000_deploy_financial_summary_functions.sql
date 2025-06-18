-- Migração para implementar e publicar as funções de resumo financeiro
-- Data: 2024-10-14

-- Primeiro, remover as funções existentes se houver (para garantir compatibilidade)
DROP FUNCTION IF EXISTS get_services_summary(TIMESTAMP, TIMESTAMP);
DROP FUNCTION IF EXISTS get_products_summary(TIMESTAMP, TIMESTAMP);
DROP FUNCTION IF EXISTS get_payment_methods_summary(TIMESTAMP, TIMESTAMP);
DROP FUNCTION IF EXISTS get_professionals_profit_summary(TIMESTAMP, TIMESTAMP);
DROP FUNCTION IF EXISTS get_financial_summary(TIMESTAMP, TIMESTAMP);

-- Criar função RPC para obter resumo de serviços
CREATE OR REPLACE FUNCTION public.get_services_summary(data_inicio TIMESTAMP, data_fim TIMESTAMP)
RETURNS JSON AS $$
DECLARE
    result JSON;
    debug_count INTEGER;
BEGIN
    -- Mostrar datas para verificação no log
    RAISE NOTICE 'Executando get_services_summary com período: % até %', data_inicio, data_fim;
    
    -- Verificar quantos registros existem primeiro para diagnóstico
    SELECT COUNT(*) INTO debug_count 
    FROM appointment_services as_srv
    INNER JOIN appointments a ON as_srv.appointment_id = a.id
    WHERE a.status = 'finalizado';
    
    RAISE NOTICE 'Total de registros de serviços finalizados: %', debug_count;
    
    -- Verificar registros no período de data
    SELECT COUNT(*) INTO debug_count 
    FROM appointment_services as_srv
    INNER JOIN appointments a ON as_srv.appointment_id = a.id
    WHERE a.status = 'finalizado'
    AND as_srv.updated_at >= data_inicio 
    AND as_srv.updated_at <= data_fim;
    
    RAISE NOTICE 'Registros de serviços no período solicitado: %', debug_count;

    -- Obter resumo de serviços
    WITH services_summary AS (
        SELECT
            COUNT(*) as quantidade,
            SUM(as_srv.custom_price) as valor_bruto,
            SUM(as_srv.professional_profit) as lucro_profissional,
            SUM(as_srv.net_value) as lucro_salao
        FROM
            appointment_services as_srv
            INNER JOIN appointments a ON as_srv.appointment_id = a.id
        WHERE
            a.status = 'finalizado'
            AND as_srv.updated_at >= data_inicio 
            AND as_srv.updated_at <= data_fim
    )
    SELECT
        json_build_object(
            'quantidade', COALESCE(quantidade, 0),
            'valor_bruto', COALESCE(valor_bruto, 0),
            'lucro_profissional', COALESCE(lucro_profissional, 0),
            'lucro_salao', COALESCE(lucro_salao, 0)
        ) INTO result
    FROM
        services_summary;

    -- Log dos resultados
    RAISE NOTICE 'Resultado do resumo de serviços: %', result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar função RPC para obter resumo de produtos
CREATE OR REPLACE FUNCTION public.get_products_summary(data_inicio TIMESTAMP, data_fim TIMESTAMP)
RETURNS JSON AS $$
DECLARE
    result JSON;
    debug_count INTEGER;
BEGIN
    -- Mostrar datas para verificação no log
    RAISE NOTICE 'Executando get_products_summary com período: % até %', data_inicio, data_fim;
    
    -- Verificar quantos registros existem primeiro para diagnóstico
    SELECT COUNT(*) INTO debug_count 
    FROM product_sales
    WHERE status = 'completed';
    
    RAISE NOTICE 'Total de registros de produtos vendidos: %', debug_count;
    
    -- Verificar registros no período de data
    SELECT COUNT(*) INTO debug_count 
    FROM product_sales
    WHERE status = 'completed'
    AND updated_at >= data_inicio 
    AND updated_at <= data_fim;
    
    RAISE NOTICE 'Registros de produtos no período solicitado: %', debug_count;

    -- Obter resumo de produtos
    WITH products_summary AS (
        SELECT
            SUM(quantity) as quantidade,
            SUM(gross_total) as valor_bruto,
            SUM(net_profit) as lucro
        FROM
            product_sales
        WHERE
            status = 'completed'
            AND updated_at >= data_inicio 
            AND updated_at <= data_fim
    )
    SELECT
        json_build_object(
            'quantidade', COALESCE(quantidade, 0),
            'valor_bruto', COALESCE(valor_bruto, 0),
            'lucro', COALESCE(lucro, 0)
        ) INTO result
    FROM
        products_summary;

    -- Log dos resultados
    RAISE NOTICE 'Resultado do resumo de produtos: %', result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar função RPC para obter resumo por método de pagamento
CREATE OR REPLACE FUNCTION public.get_payment_methods_summary(data_inicio TIMESTAMP, data_fim TIMESTAMP)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    -- Mostrar datas para verificação no log
    RAISE NOTICE 'Executando get_payment_methods_summary com período: % até %', data_inicio, data_fim;

    -- Obter valor por método de pagamento (serviços + produtos)
    WITH payment_methods_summary AS (
        -- Valor de serviços por método
        SELECT
            pm.id,
            pm.name,
            COALESCE(SUM(as_srv.custom_price), 0) as valor_servicos,
            COALESCE(SUM(as_srv.payment_fee), 0) as taxas_servicos
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
        
        -- Valor de produtos por método
        SELECT
            pm.id,
            pm.name,
            COALESCE(SUM(ps.gross_total), 0) as valor_produtos,
            0 as taxas_produtos  -- A coluna payment_fee não existe em product_sales
        FROM
            payment_methods pm
            LEFT JOIN product_sales ps ON pm.id = ps.payment_method_id
                AND ps.status = 'completed'
                AND ps.updated_at >= data_inicio 
                AND ps.updated_at <= data_fim
        GROUP BY
            pm.id, pm.name
    ),
    -- Consolidar valores por método
    consolidated AS (
        SELECT
            id,
            name,
            SUM(valor_servicos) as valor_total,
            SUM(taxas_servicos) as taxas_total
        FROM
            payment_methods_summary
        GROUP BY
            id, name
        HAVING
            SUM(valor_servicos) > 0
    )
    SELECT
        json_agg(
            json_build_object(
                'id', id,
                'nome', name,
                'valorTotal', valor_total,
                'taxas', taxas_total
            )
        ) INTO result
    FROM
        consolidated;

    -- Log dos resultados
    RAISE NOTICE 'Resultado dos métodos de pagamento: %', COALESCE(result, '[]'::JSON);
    
    RETURN COALESCE(result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar função RPC para obter lucro por profissional
CREATE OR REPLACE FUNCTION public.get_professionals_profit_summary(data_inicio TIMESTAMP, data_fim TIMESTAMP)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    -- Mostrar datas para verificação no log
    RAISE NOTICE 'Executando get_professionals_profit_summary com período: % até %', data_inicio, data_fim;

    -- Obter lucro por profissional (serviços + produtos)
    WITH professionals_services AS (
        -- Lucro de serviços por profissional
        SELECT
            p.id,
            p.name,
            COALESCE(SUM(as_srv.professional_profit), 0) as lucro_servicos
        FROM
            professionals p
            LEFT JOIN appointment_services as_srv ON as_srv.professional_id = p.id
            LEFT JOIN appointments a ON a.id = as_srv.appointment_id
                AND a.status = 'finalizado'
                AND as_srv.updated_at >= data_inicio 
                AND as_srv.updated_at <= data_fim
        GROUP BY
            p.id, p.name
    ),
    professionals_products AS (
        -- Lucro de produtos por profissional
        SELECT
            p.id,
            p.name,
            COALESCE(SUM(ps.net_profit), 0) as lucro_produtos
        FROM
            professionals p
            LEFT JOIN product_sales ps ON p.id = ps.professional_id
                AND ps.status = 'completed'
                AND ps.updated_at >= data_inicio 
                AND ps.updated_at <= data_fim
        GROUP BY
            p.id, p.name
    ),
    -- Consolidar lucros por profissional
    consolidated AS (
        SELECT
            ps.id,
            ps.name,
            ps.lucro_servicos,
            COALESCE(pp.lucro_produtos, 0) as lucro_produtos,
            (ps.lucro_servicos + COALESCE(pp.lucro_produtos, 0)) as lucro_total
        FROM
            professionals_services ps
            LEFT JOIN professionals_products pp ON ps.id = pp.id
        WHERE
            ps.lucro_servicos > 0 OR COALESCE(pp.lucro_produtos, 0) > 0
    )
    SELECT
        json_agg(
            json_build_object(
                'id', id,
                'nome', name,
                'lucroServicos', lucro_servicos,
                'lucroProdutos', lucro_produtos,
                'lucroTotal', lucro_total
            )
        ) INTO result
    FROM
        consolidated
    ORDER BY
        lucro_total DESC;

    -- Log dos resultados
    RAISE NOTICE 'Resultado do lucro por profissionais: %', COALESCE(result, '[]'::JSON);
    
    RETURN COALESCE(result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função principal para obter o resumo financeiro completo
CREATE OR REPLACE FUNCTION public.get_financial_summary(data_inicio TIMESTAMP, data_fim TIMESTAMP)
RETURNS JSON AS $$
DECLARE
    servicos_resumo JSON;
    produtos_resumo JSON;
    metodos_pagamento JSON;
    lucro_profissionais JSON;
    lucro_total DECIMAL;
    data_inicio_ajustada TIMESTAMP;
    data_fim_ajustada TIMESTAMP;
BEGIN
    -- Ajustar datas para garantir início e fim do dia
    data_inicio_ajustada := date_trunc('day', data_inicio);
    data_fim_ajustada := date_trunc('day', data_fim) + interval '1 day' - interval '1 second';
    
    -- Mostrar datas para verificação no log
    RAISE NOTICE 'Executando get_financial_summary com parâmetros originais: % até %', data_inicio, data_fim;
    RAISE NOTICE 'Datas ajustadas para: % até %', data_inicio_ajustada, data_fim_ajustada;
    
    -- Obter resumo de serviços
    servicos_resumo := public.get_services_summary(data_inicio_ajustada, data_fim_ajustada);
    
    -- Obter resumo de produtos
    produtos_resumo := public.get_products_summary(data_inicio_ajustada, data_fim_ajustada);
    
    -- Obter resumo por método de pagamento
    metodos_pagamento := public.get_payment_methods_summary(data_inicio_ajustada, data_fim_ajustada);
    
    -- Obter lucro por profissional
    lucro_profissionais := public.get_professionals_profit_summary(data_inicio_ajustada, data_fim_ajustada);
    
    -- Calcular lucro total
    SELECT 
        COALESCE((servicos_resumo->>'lucro_salao')::DECIMAL, 0) + COALESCE((produtos_resumo->>'lucro')::DECIMAL, 0)
    INTO lucro_total;
    
    RAISE NOTICE 'Lucro total calculado: %', lucro_total;
    
    -- Retornar o resumo completo
    RETURN json_build_object(
        'servicos', servicos_resumo,
        'produtos', produtos_resumo,
        'metodosPagamento', metodos_pagamento,
        'lucroProfissionais', lucro_profissionais,
        'lucroTotal', lucro_total
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atualizar o cache de funções para garantir visibilidade na API REST
COMMENT ON FUNCTION public.get_services_summary(TIMESTAMP, TIMESTAMP) IS 'Retorna um resumo dos serviços realizados em um período específico';
COMMENT ON FUNCTION public.get_products_summary(TIMESTAMP, TIMESTAMP) IS 'Retorna um resumo dos produtos vendidos em um período específico';
COMMENT ON FUNCTION public.get_payment_methods_summary(TIMESTAMP, TIMESTAMP) IS 'Retorna um resumo dos pagamentos por método em um período específico';
COMMENT ON FUNCTION public.get_professionals_profit_summary(TIMESTAMP, TIMESTAMP) IS 'Retorna um resumo do lucro por profissional em um período específico';
COMMENT ON FUNCTION public.get_financial_summary(TIMESTAMP, TIMESTAMP) IS 'Retorna um resumo financeiro completo para um período específico';

-- Garantir que as funções sejam acessíveis via API REST
GRANT EXECUTE ON FUNCTION public.get_services_summary(TIMESTAMP, TIMESTAMP) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_products_summary(TIMESTAMP, TIMESTAMP) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_payment_methods_summary(TIMESTAMP, TIMESTAMP) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_professionals_profit_summary(TIMESTAMP, TIMESTAMP) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_financial_summary(TIMESTAMP, TIMESTAMP) TO authenticated, anon, service_role;

-- Forçar atualização do cache de procedimentos
ANALYZE pg_proc;
REFRESH MATERIALIZED VIEW pg_catalog.pg_proc; 