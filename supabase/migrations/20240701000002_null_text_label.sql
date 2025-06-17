-- Migração para corrigir problemas com a coluna text_label
-- Solução alternativa: Ao invés de remover, definir como NULL por padrão
-- Data: 01/07/2024

-- Verificar se a coluna existe
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'appointments' 
        AND column_name = 'text_label'
    ) THEN
        -- 1. Definir valor padrão como NULL
        ALTER TABLE appointments ALTER COLUMN text_label SET DEFAULT NULL;
        
        -- 2. Limpar valores existentes da coluna para evitar problemas
        UPDATE appointments SET text_label = NULL;
        
        -- 3. Adicionar restrição para garantir que seja NULL
        ALTER TABLE appointments DROP CONSTRAINT IF EXISTS text_label_must_be_null;
        ALTER TABLE appointments ADD CONSTRAINT text_label_must_be_null 
            CHECK (text_label IS NULL);
            
        -- 4. Adicionar comentário explicativo
        COMMENT ON COLUMN appointments.text_label IS 
            'DEPRECATED: Campo obsoleto que não deve ser utilizado. Será removido em versão futura.';
            
        RAISE NOTICE 'Coluna text_label configurada para aceitar apenas valores NULL';
    ELSE
        RAISE NOTICE 'Coluna text_label não existe na tabela appointments';
    END IF;
END;
$$; 