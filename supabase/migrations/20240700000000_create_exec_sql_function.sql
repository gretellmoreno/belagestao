-- Função SQL para executar comandos SQL diretos (para uso em migrações e configurações)
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS void AS $$
BEGIN
    EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função RPC para expor exec_sql ao cliente (limitado ao esquema public para segurança)
CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS void AS $$
DECLARE
    -- Verificar se o comando SQL contém apenas operações permitidas
    is_malicious boolean := false;
BEGIN
    -- Verificar se o SQL tenta acessar tabelas ou schemas do sistema
    -- Esta é uma verificação básica, em produção seria recomendável
    -- uma análise mais rigorosa ou usar outra abordagem mais segura
    is_malicious := sql ~* '(pg_|information_schema\.)' AND 
                   sql !~* '(pg_catalog\.pg_tables|information_schema\.tables|information_schema\.columns|pg_proc)';
    
    -- Verificar comandos perigosos
    is_malicious := is_malicious OR sql ~* '(DROP\s+DATABASE|TRUNCATE\s+schema|ALTER\s+SYSTEM)';
    
    -- Se for considerado malicioso, interrompe a execução
    IF is_malicious THEN
        RAISE EXCEPTION 'Comando SQL não permitido para execução';
    END IF;
    
    -- Executar o comando SQL
    EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar permissão anônima para executar a função (apenas para desenvolvimento)
GRANT EXECUTE ON FUNCTION public.exec_sql TO anon;
GRANT EXECUTE ON FUNCTION public.exec_sql TO authenticated;
GRANT EXECUTE ON FUNCTION public.exec_sql TO service_role; 