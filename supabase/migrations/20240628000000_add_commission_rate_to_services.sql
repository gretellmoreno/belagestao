-- Script para adicionar a coluna commission_rate à tabela services
DO $$
BEGIN
    -- Verifica se a coluna commission_rate já existe
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'services' 
        AND column_name = 'commission_rate'
    ) THEN
        -- Adiciona a coluna commission_rate como DECIMAL(5,2) com valor padrão 30.00
        ALTER TABLE services ADD COLUMN commission_rate DECIMAL(5,2) DEFAULT 30.00;
        
        -- Se a coluna commission já existir, migra os valores para a nova coluna
        IF EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'services' 
            AND column_name = 'commission'
        ) THEN
            -- Atualiza commission_rate com os valores de commission
            UPDATE services SET commission_rate = commission;
            RAISE NOTICE 'Valores da coluna commission foram migrados para a coluna commission_rate.';
        END IF;
        
        RAISE NOTICE 'Coluna commission_rate foi adicionada à tabela services.';
    ELSE
        RAISE NOTICE 'A coluna commission_rate já existe na tabela services.';
    END IF;
END;
$$; 