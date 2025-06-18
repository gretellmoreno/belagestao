-- Script para remover a coluna commission_rate da tabela professionals
-- Nota: Essa coluna foi removida porque gerava conflito com a lógica real do sistema.
-- A comissão do profissional depende do serviço realizado, e por isso é controlada somente 
-- pela tabela services, na coluna services.commission_rate.

DO $$
BEGIN
    -- Verificar se a coluna commission_rate existe na tabela professionals
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'professionals' 
        AND column_name = 'commission_rate'
    ) THEN
        -- Remover a coluna commission_rate da tabela professionals
        ALTER TABLE professionals DROP COLUMN commission_rate;
        RAISE NOTICE 'Coluna commission_rate removida da tabela professionals.';
    ELSE
        RAISE NOTICE 'A coluna commission_rate não existe na tabela professionals.';
    END IF;

    -- Adicionar comentário na tabela services para documentar a mudança de lógica
    COMMENT ON COLUMN services.commission_rate IS 'Taxa de comissão do serviço. Esta coluna substitui a antiga commission_rate da tabela professionals, pois a comissão é definida por serviço e não por profissional.';

    RAISE NOTICE 'Migração concluída com sucesso!';
END;
$$; 