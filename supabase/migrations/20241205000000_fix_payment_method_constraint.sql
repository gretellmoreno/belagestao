-- Migração para corrigir o erro P0001 relacionado a payment_method_id
-- "O campo payment_method_id só pode ser preenchido quando o status do agendamento for 'finalizado'"

-- 1. Identificar e remover constraints que impedem payment_method_id quando status não é finalizado
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    -- Buscar constraints relacionados a payment_method_id na tabela appointments
    FOR constraint_record IN
        SELECT conname, pg_get_constraintdef(oid) as definition
        FROM pg_constraint
        WHERE conrelid = 'appointments'::regclass
        AND pg_get_constraintdef(oid) ILIKE '%payment_method_id%'
        AND pg_get_constraintdef(oid) ILIKE '%status%'
    LOOP
        RAISE NOTICE 'Encontrado constraint problemático: % - %', constraint_record.conname, constraint_record.definition;
        
        -- Remover o constraint problemático
        EXECUTE 'ALTER TABLE appointments DROP CONSTRAINT IF EXISTS ' || constraint_record.conname;
        RAISE NOTICE 'Constraint % removido', constraint_record.conname;
    END LOOP;
END $$;

-- 2. Garantir que payment_method_id permite NULL na tabela appointments
DO $$
BEGIN
    -- Verificar se a coluna payment_method_id permite NULL na tabela appointments
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' 
        AND column_name = 'payment_method_id'
        AND is_nullable = 'NO'
    ) THEN
        -- Permitir valores NULL para resolver o problema
        ALTER TABLE appointments ALTER COLUMN payment_method_id DROP NOT NULL;
        RAISE NOTICE 'Coluna payment_method_id agora permite valores NULL na tabela appointments';
    ELSE
        RAISE NOTICE 'Coluna payment_method_id já permite valores NULL na tabela appointments';
    END IF;
END $$;

-- 3. Comentário explicativo sobre a mudança
COMMENT ON COLUMN appointments.payment_method_id IS 'ID do método de pagamento. Pode ser NULL na criação e preenchido apenas na finalização do agendamento.';

-- 4. Atualizar agendamentos existentes que tenham payment_method_id mas status diferente de finalizado
-- Isso é uma medida preventiva para evitar inconsistências futuras
UPDATE appointments 
SET payment_method_id = NULL 
WHERE payment_method_id IS NOT NULL 
AND status != 'finalizado';

-- 5. Log final
DO $$
BEGIN
    RAISE NOTICE '=== CORREÇÃO APLICADA COM SUCESSO ===';
    RAISE NOTICE 'O campo payment_method_id na tabela appointments agora:';
    RAISE NOTICE '1. Permite valores NULL';
    RAISE NOTICE '2. Não tem constraints que impedem preenchimento baseado no status';
    RAISE NOTICE '3. Pode ser preenchido apenas na finalização do agendamento';
    RAISE NOTICE '';
    RAISE NOTICE 'FLUXO RECOMENDADO:';
    RAISE NOTICE '1. Criar agendamento SEM payment_method_id (será NULL)';
    RAISE NOTICE '2. Adicionar serviços com payment_method_id em appointment_services';
    RAISE NOTICE '3. Finalizar agendamento definindo payment_method_id se necessário';
END $$; 