-- Script para verificar e garantir a existência de todas as tabelas necessárias para o módulo financeiro
DO $$
DECLARE
    employee_advances_exists BOOLEAN;
BEGIN
    -- Verificar se a tabela employee_advances existe
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'employee_advances'
    ) INTO employee_advances_exists;
    
    -- Se a tabela employee_advances não existir, criá-la
    IF NOT employee_advances_exists THEN
        -- Criar a tabela de vales/adiantamentos
        CREATE TABLE public.employee_advances (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
            amount DECIMAL(10,2) NOT NULL,
            date DATE NOT NULL,
            notes TEXT,
            cash_closing_id UUID, -- Será adicionada a referência depois
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        
        -- Criar índice para melhor performance
        CREATE INDEX employee_advances_professional_id_idx ON employee_advances(professional_id);
        CREATE INDEX employee_advances_date_idx ON employee_advances(date);
        
        -- Verificar se existe a função trigger_set_timestamp
        IF NOT EXISTS (
            SELECT FROM pg_proc
            WHERE proname = 'trigger_set_timestamp'
        ) THEN
            -- Criar a função trigger se não existir
            CREATE OR REPLACE FUNCTION trigger_set_timestamp()
            RETURNS TRIGGER AS $$
            BEGIN
              NEW.updated_at = NOW();
              RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        END IF;
        
        -- Criar trigger para atualizar o updated_at
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
        
        RAISE NOTICE 'Tabela employee_advances criada com sucesso.';
    ELSE
        RAISE NOTICE 'A tabela employee_advances já existe.';
    END IF;
    
    -- Verificar se a tabela cash_closings existe
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'cash_closings'
    ) THEN
        -- Criar a tabela cash_closings
        CREATE TABLE public.cash_closings (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            start_date TIMESTAMP WITH TIME ZONE NOT NULL,
            end_date TIMESTAMP WITH TIME ZONE NOT NULL,
            total_earnings DECIMAL(10,2) NOT NULL DEFAULT 0,
            total_commissions DECIMAL(10,2) NOT NULL DEFAULT 0,
            total_payment_fees DECIMAL(10,2) NOT NULL DEFAULT 0,
            total_advances DECIMAL(10,2) NOT NULL DEFAULT 0,
            notes TEXT,
            closed_by TEXT,
            status TEXT DEFAULT 'fechado',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Adicionar comentários para documentação
        COMMENT ON TABLE public.cash_closings IS 'Registros de fechamentos de caixa do salão';
        
        -- Criar trigger para atualizar o campo updated_at automaticamente
        CREATE TRIGGER set_timestamp
        BEFORE UPDATE ON public.cash_closings
        FOR EACH ROW
        EXECUTE FUNCTION trigger_set_timestamp();
        
        -- Adicionar índices para melhorar a performance
        CREATE INDEX idx_cash_closings_dates ON public.cash_closings(start_date, end_date);
        CREATE INDEX idx_cash_closings_status ON public.cash_closings(status);
        
        -- Aplicar Row-Level Security (RLS)
        ALTER TABLE public.cash_closings ENABLE ROW LEVEL SECURITY;
        
        -- Permitir acesso completo via anon key para facilitar o desenvolvimento inicial
        CREATE POLICY "Allow select for anonymous users"
          ON public.cash_closings FOR SELECT
          USING (true);
        
        CREATE POLICY "Allow insert for anonymous users"
          ON public.cash_closings FOR INSERT
          WITH CHECK (true);
        
        CREATE POLICY "Allow update for anonymous users"
          ON public.cash_closings FOR UPDATE
          USING (true);
        
        CREATE POLICY "Allow delete for anonymous users"
          ON public.cash_closings FOR DELETE
          USING (true);
          
        RAISE NOTICE 'Tabela cash_closings criada com sucesso.';
    ELSE
        RAISE NOTICE 'A tabela cash_closings já existe.';
    END IF;
    
    -- Adicionar referência de cash_closings em employee_advances se não existir
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'employee_advances' 
        AND column_name = 'cash_closing_id'
    ) THEN
        ALTER TABLE employee_advances 
        ADD COLUMN cash_closing_id UUID REFERENCES cash_closings(id) ON DELETE SET NULL;
        
        CREATE INDEX employee_advances_cash_closing_id_idx ON employee_advances(cash_closing_id);
        
        RAISE NOTICE 'Coluna cash_closing_id adicionada à tabela employee_advances.';
    ELSE
        RAISE NOTICE 'A coluna cash_closing_id já existe na tabela employee_advances.';
    END IF;
    
    -- Verificar se a tabela payment_methods existe
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'payment_methods'
    ) THEN
        -- Criar a tabela de métodos de pagamento
        CREATE TABLE public.payment_methods (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            name TEXT NOT NULL,
            fee DECIMAL(5,2) DEFAULT 0.00,
            active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Criar trigger para atualizar o updated_at
        CREATE TRIGGER set_timestamp
            BEFORE UPDATE ON payment_methods
            FOR EACH ROW
            EXECUTE FUNCTION trigger_set_timestamp();
        
        -- Criar políticas de RLS
        ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
        
        -- Criar políticas de acesso
        CREATE POLICY "Permitir select para todos" ON payment_methods
            FOR SELECT USING (true);
        
        CREATE POLICY "Permitir insert para todos" ON payment_methods
            FOR INSERT WITH CHECK (true);
        
        CREATE POLICY "Permitir update para todos" ON payment_methods
            FOR UPDATE USING (true);
        
        CREATE POLICY "Permitir delete para todos" ON payment_methods
            FOR DELETE USING (true);
        
        -- Inserir métodos de pagamento padrão
        INSERT INTO payment_methods (name, fee) VALUES
            ('Dinheiro', 0.00),
            ('Cartão de Débito', 2.00),
            ('Cartão de Crédito', 4.00),
            ('Pix', 0.00),
            ('Transferência', 0.00);
        
        RAISE NOTICE 'Tabela payment_methods criada e populada com métodos de pagamento padrão.';
    ELSE
        RAISE NOTICE 'A tabela payment_methods já existe.';
    END IF;
END;
$$; 