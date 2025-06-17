-- Primeiro remover a tabela se ela existir
DROP TABLE IF EXISTS employee_advances CASCADE;

-- Criar a tabela de vales/adiantamentos
CREATE TABLE employee_advances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Criar índice para melhor performance
CREATE INDEX employee_advances_professional_id_idx ON employee_advances(professional_id);
CREATE INDEX employee_advances_date_idx ON employee_advances(date);

-- Criar trigger para atualizar o updated_at
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON employee_advances
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- Criar políticas de RLS (Row Level Security)
ALTER TABLE employee_advances ENABLE ROW LEVEL SECURITY;

-- Criar políticas de acesso
CREATE POLICY "Permitir select para todos" ON employee_advances
    FOR SELECT USING (true);

CREATE POLICY "Permitir insert para todos" ON employee_advances
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir update para todos" ON employee_advances
    FOR UPDATE USING (true);

CREATE POLICY "Permitir delete para todos" ON employee_advances
    FOR DELETE USING (true); 