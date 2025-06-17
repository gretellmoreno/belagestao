-- Migração para adicionar campo appointment_id à tabela product_sales
-- Data: 30/07/2024

-- Verificar se a tabela product_sales existe
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'product_sales'
    ) THEN
        -- Verificar se a coluna já existe
        IF NOT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'product_sales' 
            AND column_name = 'appointment_id'
        ) THEN
            -- Adicionar a coluna appointment_id
            ALTER TABLE product_sales 
            ADD COLUMN appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL;
            
            -- Adicionar índice para melhorar performance de consultas
            CREATE INDEX idx_product_sales_appointment_id ON product_sales(appointment_id);
            
            -- Documentar a coluna
            COMMENT ON COLUMN product_sales.appointment_id IS 'ID do atendimento relacionado à venda do produto. NULL para vendas diretas.';
            
            RAISE NOTICE 'Coluna appointment_id adicionada à tabela product_sales com sucesso.';
        ELSE
            RAISE NOTICE 'A coluna appointment_id já existe na tabela product_sales.';
        END IF;
    ELSE
        RAISE NOTICE 'A tabela product_sales não existe no banco de dados.';
    END IF;
END $$; 