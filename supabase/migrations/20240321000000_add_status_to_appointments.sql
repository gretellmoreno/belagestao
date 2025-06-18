-- Adiciona o campo status à tabela appointments
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'agendado'::VARCHAR;

-- Adiciona check constraint para garantir valores válidos
ALTER TABLE appointments
ADD CONSTRAINT appointments_status_check 
CHECK (status IN ('agendado', 'realizado', 'ausente', 'cancelado')); 