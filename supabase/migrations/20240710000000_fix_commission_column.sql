-- Migração para corrigir a coluna commission na tabela appointments
-- Data: 10/07/2024

DO $$
BEGIN
    -- Verificar se a coluna commission_rate já existe
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'appointments' 
        AND column_name = 'commission_rate'
    ) THEN
        -- Adicionar a coluna commission_rate com valor padrão 30.00
        ALTER TABLE appointments ADD COLUMN commission_rate DECIMAL(5,2) DEFAULT 30.00;
        RAISE NOTICE 'Coluna commission_rate foi adicionada à tabela appointments com valor padrão 30.00.';
    ELSE
        RAISE NOTICE 'A coluna commission_rate já existe na tabela appointments.';
    END IF;
    
    -- Verificar se a coluna commission existe e removê-la se existir
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'appointments' 
        AND column_name = 'commission'
    ) THEN
        -- Remover a coluna commission
        ALTER TABLE appointments DROP COLUMN commission;
        RAISE NOTICE 'Coluna commission foi removida da tabela appointments.';
    ELSE
        RAISE NOTICE 'A coluna commission não existe na tabela appointments.';
    END IF;
END;
$$; 