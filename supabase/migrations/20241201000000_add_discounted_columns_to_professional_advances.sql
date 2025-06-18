-- Migração para adicionar colunas de controle de desconto à tabela professional_advances
-- Data: 01/12/2024

DO $$
BEGIN
    -- Verificar se a tabela professional_advances existe
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'professional_advances'
    ) THEN
        -- Adicionar coluna discounted se não existir
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'professional_advances' 
            AND column_name = 'discounted'
        ) THEN
            ALTER TABLE professional_advances 
            ADD COLUMN discounted BOOLEAN DEFAULT FALSE;
            
            RAISE NOTICE 'Coluna discounted adicionada à tabela professional_advances.';
        ELSE
            RAISE NOTICE 'A coluna discounted já existe na tabela professional_advances.';
        END IF;

        -- Adicionar coluna closure_date se não existir
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'professional_advances' 
            AND column_name = 'closure_date'
        ) THEN
            ALTER TABLE professional_advances 
            ADD COLUMN closure_date TIMESTAMPTZ;
            
            RAISE NOTICE 'Coluna closure_date adicionada à tabela professional_advances.';
        ELSE
            RAISE NOTICE 'A coluna closure_date já existe na tabela professional_advances.';
        END IF;

        -- Adicionar índice para melhorar performance de consultas por discounted
        CREATE INDEX IF NOT EXISTS idx_professional_advances_discounted 
        ON professional_advances(discounted);

        -- Adicionar comentários para documentar as colunas
        COMMENT ON COLUMN professional_advances.discounted IS 'Indica se o vale foi descontado em um fechamento de caixa';
        COMMENT ON COLUMN professional_advances.closure_date IS 'Data e hora em que o vale foi descontado';

        RAISE NOTICE 'Migração concluída com sucesso!';
    ELSE
        RAISE NOTICE 'A tabela professional_advances não existe no banco de dados.';
    END IF;
END $$; 