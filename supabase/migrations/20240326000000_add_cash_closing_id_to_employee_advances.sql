-- Adicionar coluna cash_closing_id à tabela employee_advances
ALTER TABLE employee_advances
ADD COLUMN cash_closing_id UUID REFERENCES cash_closings(id) ON DELETE SET NULL;

-- Criar índice para melhor performance
CREATE INDEX employee_advances_cash_closing_id_idx ON employee_advances(cash_closing_id); 