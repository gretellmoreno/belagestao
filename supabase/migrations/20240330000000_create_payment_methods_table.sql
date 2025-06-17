-- Criar tabela de métodos de pagamento
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    fee DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar comentários na tabela
COMMENT ON TABLE payment_methods IS 'Métodos de pagamento e suas taxas';
COMMENT ON COLUMN payment_methods.name IS 'Nome do método de pagamento';
COMMENT ON COLUMN payment_methods.fee IS 'Taxa do método de pagamento em porcentagem';

-- Inserir métodos de pagamento iniciais
INSERT INTO payment_methods (name, fee) VALUES
('Dinheiro', 0.00),
('Pix', 0.00),
('Cartão de Crédito', 3.00),
('Cartão de Débito', 2.00)
ON CONFLICT (name) DO NOTHING;

-- Adicionar a coluna payment_method_id à tabela appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS payment_method_id UUID REFERENCES payment_methods(id);

-- Adicionar comentário à coluna
COMMENT ON COLUMN appointments.payment_method_id IS 'Referência ao método de pagamento utilizado';

-- Adicionar índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_appointments_payment_method ON appointments(payment_method_id);

-- Migrar os dados existentes
-- Esta parte precisa ser adaptada com base na estrutura atual dos dados
UPDATE appointments
SET payment_method_id = (
    SELECT id FROM payment_methods 
    WHERE name = 
        CASE 
            WHEN appointments.payment_method = 'Cartão' THEN 'Cartão de Crédito'
            WHEN appointments.payment_method = 'Dinheiro' THEN 'Dinheiro'
            WHEN appointments.payment_method = 'Pix' THEN 'Pix'
            ELSE 'Cartão de Crédito'
        END
    LIMIT 1
)
WHERE payment_method_id IS NULL;