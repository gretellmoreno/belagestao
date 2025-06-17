-- Script para criar a tabela cash_closings
DO $$
BEGIN
    -- Verificar se a tabela já existe
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
        COMMENT ON COLUMN public.cash_closings.id IS 'Identificador único do fechamento';
        COMMENT ON COLUMN public.cash_closings.start_date IS 'Data inicial do período do fechamento';
        COMMENT ON COLUMN public.cash_closings.end_date IS 'Data final do período do fechamento';
        COMMENT ON COLUMN public.cash_closings.total_earnings IS 'Valor total das receitas no período';
        COMMENT ON COLUMN public.cash_closings.total_commissions IS 'Valor total das comissões no período';
        COMMENT ON COLUMN public.cash_closings.total_payment_fees IS 'Valor total das taxas de pagamento no período';
        COMMENT ON COLUMN public.cash_closings.total_advances IS 'Valor total dos adiantamentos no período';
        COMMENT ON COLUMN public.cash_closings.notes IS 'Observações sobre o fechamento';
        COMMENT ON COLUMN public.cash_closings.closed_by IS 'Pessoa responsável pelo fechamento';
        COMMENT ON COLUMN public.cash_closings.status IS 'Status do fechamento (aberto, fechado, etc)';
        
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
        DROP POLICY IF EXISTS "Allow select for anonymous users" ON public.cash_closings;
        DROP POLICY IF EXISTS "Allow insert for anonymous users" ON public.cash_closings;
        DROP POLICY IF EXISTS "Allow update for anonymous users" ON public.cash_closings;
        DROP POLICY IF EXISTS "Allow delete for anonymous users" ON public.cash_closings;
        
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
        
        RAISE NOTICE 'Função trigger_set_timestamp criada.';
    ELSE
        RAISE NOTICE 'Função trigger_set_timestamp já existe.';
    END IF;
END;
$$; 