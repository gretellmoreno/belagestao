-- Migração para garantir que a coluna fee existe e tem as propriedades corretas
-- Data: 2024-11-03

DO $$
BEGIN
    -- 1. Verificar se a coluna fee existe
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'payment_methods' 
        AND column_name = 'fee'
    ) THEN
        -- Criar a coluna fee se não existir
        ALTER TABLE payment_methods ADD COLUMN fee DECIMAL(5,2) DEFAULT 0;
    END IF;

    -- 2. Garantir que a coluna fee tem o tipo correto
    ALTER TABLE payment_methods 
    ALTER COLUMN fee TYPE DECIMAL(5,2) USING fee::DECIMAL(5,2);

    -- 3. Garantir que a coluna fee tem o valor padrão correto
    ALTER TABLE payment_methods 
    ALTER COLUMN fee SET DEFAULT 0;

    -- 4. Garantir que não existem valores nulos
    UPDATE payment_methods 
    SET fee = 0 
    WHERE fee IS NULL;

    -- 5. Adicionar constraint para garantir que fee não pode ser nulo
    ALTER TABLE payment_methods 
    ALTER COLUMN fee SET NOT NULL;

    -- 6. Adicionar constraint para garantir que fee é um valor válido (entre 0 e 100)
    ALTER TABLE payment_methods 
    ADD CONSTRAINT payment_methods_fee_check 
    CHECK (fee >= 0 AND fee <= 100);

END $$; 