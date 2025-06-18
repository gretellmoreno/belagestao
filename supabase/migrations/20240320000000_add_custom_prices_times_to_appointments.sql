-- Adiciona os campos custom_prices e custom_times à tabela appointments
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS custom_prices jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS custom_times jsonb DEFAULT '{}'::jsonb; 