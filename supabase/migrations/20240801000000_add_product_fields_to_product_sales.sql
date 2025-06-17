-- Migração para adicionar campo professional_id à tabela product_sales
-- Data: 01/08/2024 (atualizada)

-- Verificar se a tabela product_sales existe
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'product_sales'
    ) THEN
        -- Verificar e adicionar a coluna professional_id se não existir
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'product_sales' 
            AND column_name = 'professional_id'
        ) THEN
            -- Adicionar a coluna professional_id
            ALTER TABLE product_sales 
            ADD COLUMN professional_id UUID REFERENCES professionals(id) ON DELETE SET NULL;
            
            -- Adicionar índice para melhorar performance de consultas
            CREATE INDEX IF NOT EXISTS idx_product_sales_professional_id ON product_sales(professional_id);
            
            -- Documentar a coluna
            COMMENT ON COLUMN product_sales.professional_id IS 'ID do profissional responsável pela venda (obrigatório apenas para vendas durante atendimentos).';
            
            RAISE NOTICE 'Coluna professional_id adicionada à tabela product_sales com sucesso.';
        ELSE
            RAISE NOTICE 'A coluna professional_id já existe na tabela product_sales.';
        END IF;
    ELSE
        RAISE NOTICE 'A tabela product_sales não existe no banco de dados.';
    END IF;
END $$; 