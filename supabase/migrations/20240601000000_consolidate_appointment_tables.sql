-- Migração para consolidar tabelas relacionadas a agendamentos
-- Adiciona campos JSONB à tabela appointments para armazenar dados relacionados

-- Passo 1: Adicionar novos campos à tabela appointments
ALTER TABLE appointments
ADD COLUMN services_data JSONB DEFAULT '[]'::jsonb,
ADD COLUMN products_data JSONB DEFAULT '[]'::jsonb,
ADD COLUMN sales_data JSONB DEFAULT '[]'::jsonb;

-- Passo 2: Migrar dados da tabela appointment_services para o campo services_data
UPDATE appointments a
SET services_data = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'service_id', s.service_id,
      'professional_id', s.professional_id,
      'original_price', s.original_price,
      'final_price', s.final_price,
      'commission_rate', s.commission_rate,
      'commission_amount', s.commission_amount,
      'custom_time', s.custom_time
    )
  )
  FROM appointment_services s
  WHERE s.appointment_id = a.id
);

-- Passo 3: Migrar dados da tabela appointment_products para o campo products_data
UPDATE appointments a
SET products_data = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'product_id', p.product_id,
      'quantity', p.quantity,
      'price', p.price
    )
  )
  FROM appointment_products p
  WHERE p.appointment_id = a.id
);

-- Passo 4: Migrar dados da tabela appointment_product_sales para o campo sales_data
UPDATE appointments a
SET sales_data = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'payment_method_id', s.payment_method_id,
      'subtotal', s.subtotal,
      'fee', s.fee,
      'total', s.total,
      'created_at', s.created_at,
      'status', s.status,
      'source', s.source
    )
  )
  FROM appointment_product_sales s
  WHERE s.appointment_id = a.id
);

-- Passo 5: Garantir que registros sem dados relacionados tenham arrays vazios
UPDATE appointments
SET services_data = '[]'::jsonb
WHERE services_data IS NULL;

UPDATE appointments
SET products_data = '[]'::jsonb
WHERE products_data IS NULL;

UPDATE appointments
SET sales_data = '[]'::jsonb
WHERE sales_data IS NULL;

-- Passo 6: Comentários nas colunas para documentação
COMMENT ON COLUMN appointments.services_data IS 'Armazena os serviços associados ao agendamento como array JSONB';
COMMENT ON COLUMN appointments.products_data IS 'Armazena os produtos associados ao agendamento como array JSONB';
COMMENT ON COLUMN appointments.sales_data IS 'Armazena os dados de vendas associados ao agendamento como array JSONB';

-- Opcional: criar índices para consultas por dados dentro dos JSONs
CREATE INDEX idx_appointments_services_data ON appointments USING GIN (services_data);
CREATE INDEX idx_appointments_products_data ON appointments USING GIN (products_data);
CREATE INDEX idx_appointments_sales_data ON appointments USING GIN (sales_data);

-- Nota: As tabelas originais não serão removidas até confirmar que a migração foi bem-sucedida
-- Para removê-las posteriormente, use:
-- DROP TABLE appointment_services CASCADE;
-- DROP TABLE appointment_products CASCADE;
-- DROP TABLE appointment_product_sales CASCADE; 