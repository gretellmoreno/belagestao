-- Crear tabla de servicios si no existe
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  description TEXT,
  commission INTEGER NOT NULL DEFAULT 30,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  type TEXT NOT NULL DEFAULT 'service', -- Nuevo campo para distinguir entre servicio y producto
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Crear un trigger para actualizar el campo updated_at automáticamente
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp ON services;
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON services
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Crear políticas de RLS (Row Level Security) para permitir operaciones CRUD
-- Estas políticas permiten acceso completo usando la clave anónima para simplificar la implementación inicial
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si ya existen
DROP POLICY IF EXISTS "Allow select for anonymous users" ON services;
DROP POLICY IF EXISTS "Allow insert for anonymous users" ON services;
DROP POLICY IF EXISTS "Allow update for anonymous users" ON services;
DROP POLICY IF EXISTS "Allow delete for anonymous users" ON services;

-- Crear nuevas políticas
CREATE POLICY "Allow select for anonymous users"
  ON services FOR SELECT
  USING (true);

CREATE POLICY "Allow insert for anonymous users"
  ON services FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update for anonymous users"
  ON services FOR UPDATE
  USING (true);
  
CREATE POLICY "Allow delete for anonymous users"
  ON services FOR DELETE
  USING (true); 