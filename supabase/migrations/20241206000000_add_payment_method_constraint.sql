-- Migração para adicionar constraint que só permite payment_method_id quando status é finalizado

-- 1. Primeiro, garantir que payment_method_id permite NULL
ALTER TABLE appointment_services ALTER COLUMN payment_method_id DROP NOT NULL;

-- 2. Adicionar constraint que valida o payment_method_id baseado no status do agendamento
ALTER TABLE appointment_services
ADD CONSTRAINT check_payment_method_id_on_finalized
CHECK (
  (payment_method_id IS NULL) OR 
  (
    EXISTS (
      SELECT 1 
      FROM appointments a 
      WHERE a.id = appointment_services.appointment_id 
      AND a.status = 'finalizado'
    )
  )
);

-- 3. Adicionar trigger para validar a inserção/atualização
CREATE OR REPLACE FUNCTION validate_payment_method_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payment_method_id IS NOT NULL THEN
    -- Verificar se o agendamento está finalizado
    IF NOT EXISTS (
      SELECT 1 
      FROM appointments a 
      WHERE a.id = NEW.appointment_id 
      AND a.status = 'finalizado'
    ) THEN
      RAISE EXCEPTION 'O campo payment_method_id só pode ser preenchido quando o status do agendamento for ''finalizado''.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_payment_method_id_before_insert_update
  BEFORE INSERT OR UPDATE ON appointment_services
  FOR EACH ROW
  EXECUTE FUNCTION validate_payment_method_id();

-- 4. Limpar dados existentes que violam a nova regra
UPDATE appointment_services
SET payment_method_id = NULL
WHERE appointment_id IN (
  SELECT id 
  FROM appointments 
  WHERE status != 'finalizado'
);

-- 5. Log de conclusão
DO $$
BEGIN
  RAISE NOTICE '=== MIGRAÇÃO CONCLUÍDA COM SUCESSO ===';
  RAISE NOTICE 'Agora o campo payment_method_id:';
  RAISE NOTICE '1. Permite valores NULL';
  RAISE NOTICE '2. Só pode ser preenchido quando o agendamento está finalizado';
  RAISE NOTICE '3. Tem validação via constraint e trigger';
  RAISE NOTICE '';
  RAISE NOTICE 'FLUXO CORRETO:';
  RAISE NOTICE '1. Criar serviço sem payment_method_id';
  RAISE NOTICE '2. Atualizar payment_method_id apenas na finalização';
END $$; 