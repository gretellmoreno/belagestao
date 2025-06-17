import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Loader2 } from 'lucide-react';

interface VerifyDatabaseTablesProps {
  onComplete: () => void;
}

export const VerifyDatabaseTables: React.FC<VerifyDatabaseTablesProps> = ({ onComplete }) => {
  const [status, setStatus] = useState<'verifying' | 'creating' | 'completed' | 'error'>('verifying');
  const [message, setMessage] = useState('Verificando estrutura do banco de dados...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verifyAndCreateTables = async () => {
      try {
        setStatus('verifying');
        setMessage('Verificando estrutura do banco de dados...');

        // Verificar se as tabelas necessárias existem
        const { data: tables, error: tablesError } = await supabase
          .from('pg_catalog.pg_tables')
          .select('tablename')
          .eq('schemaname', 'public');

        if (tablesError) {
          console.error('Erro ao verificar tabelas:', tablesError);
          setStatus('error');
          setError('Não foi possível verificar as tabelas do banco de dados.');
          return;
        }

        const existingTables = (tables || []).map(t => t.tablename);
        const requiredTables = ['employee_advances', 'payment_methods'];
        const missingTables = requiredTables.filter(table => !existingTables.includes(table));

        if (missingTables.length === 0) {
          setMessage('Todas as tabelas necessárias existem.');
          setStatus('completed');
          onComplete();
          return;
        }

        setStatus('creating');
        setMessage(`Criando tabelas faltantes: ${missingTables.join(', ')}...`);

        // Criar as tabelas faltantes
        const script = `
        DO $$
        BEGIN
            -- Verificar e criar a função trigger_set_timestamp, se necessário
            IF NOT EXISTS (
                SELECT FROM pg_proc
                WHERE proname = 'trigger_set_timestamp'
            ) THEN
                CREATE OR REPLACE FUNCTION trigger_set_timestamp()
                RETURNS TRIGGER AS $$
                BEGIN
                  NEW.updated_at = NOW();
                  RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;
            END IF;

            -- Verificar e criar a tabela employee_advances, se necessária
            IF NOT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'employee_advances'
            ) THEN
                CREATE TABLE public.employee_advances (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE,
                    amount DECIMAL(10,2) NOT NULL,
                    date DATE NOT NULL,
                    notes TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                
                CREATE INDEX employee_advances_professional_id_idx ON employee_advances(professional_id);
                CREATE INDEX employee_advances_date_idx ON employee_advances(date);
                
                CREATE TRIGGER set_timestamp
                BEFORE UPDATE ON public.employee_advances
                FOR EACH ROW
                EXECUTE FUNCTION trigger_set_timestamp();
                
                ALTER TABLE public.employee_advances ENABLE ROW LEVEL SECURITY;
                
                CREATE POLICY "Allow select for anonymous users"
                ON public.employee_advances FOR SELECT
                USING (true);
                
                CREATE POLICY "Allow insert for anonymous users"
                ON public.employee_advances FOR INSERT
                WITH CHECK (true);
                
                CREATE POLICY "Allow update for anonymous users"
                ON public.employee_advances FOR UPDATE
                USING (true);
                
                CREATE POLICY "Allow delete for anonymous users"
                ON public.employee_advances FOR DELETE
                USING (true);
            END IF;

            -- Verificar e criar a tabela payment_methods, se necessária
            IF NOT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'payment_methods'
            ) THEN
                CREATE TABLE public.payment_methods (
                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                    name TEXT NOT NULL,
                    fee DECIMAL(5,2) DEFAULT 0.00,
                    active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                
                CREATE TRIGGER set_timestamp
                BEFORE UPDATE ON public.payment_methods
                FOR EACH ROW
                EXECUTE FUNCTION trigger_set_timestamp();
                
                ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
                
                CREATE POLICY "Allow select for anonymous users"
                ON public.payment_methods FOR SELECT
                USING (true);
                
                CREATE POLICY "Allow insert for anonymous users"
                ON public.payment_methods FOR INSERT
                WITH CHECK (true);
                
                CREATE POLICY "Allow update for anonymous users"
                ON public.payment_methods FOR UPDATE
                USING (true);
                
                CREATE POLICY "Allow delete for anonymous users"
                ON public.payment_methods FOR DELETE
                USING (true);
                
                -- Inserir métodos de pagamento padrão se não existirem
                INSERT INTO payment_methods (name, fee)
                VALUES
                    ('Dinheiro', 0.00),
                    ('Cartão de Débito', 2.00),
                    ('Cartão de Crédito', 4.00),
                    ('Pix', 0.00),
                    ('Transferência', 0.00);
            END IF;
        END;
        $$;`;

        // Executar o script SQL
        const { error: createError } = await supabase.rpc('exec_sql', { sql: script });

        if (createError) {
          console.error('Erro ao criar tabelas:', createError);
          setStatus('error');
          setError(`Erro ao criar tabelas: ${createError.message}`);
          return;
        }

        setMessage('Tabelas criadas com sucesso.');
        setStatus('completed');
        onComplete();
      } catch (error) {
        console.error('Erro ao verificar/criar tabelas:', error);
        setStatus('error');
        setError('Erro inesperado ao verificar/criar tabelas.');
      }
    };

    verifyAndCreateTables();
  }, [onComplete]);

  return (
    <div className="bg-white shadow rounded-lg p-4 mb-4 flex flex-col items-center justify-center">
      {status === 'error' ? (
        <div className="text-red-600 flex flex-col items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="font-semibold">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 bg-red-100 text-red-800 rounded-md hover:bg-red-200 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <>
          {status !== 'completed' && (
            <Loader2 className="h-12 w-12 text-indigo-500 animate-spin mb-2" />
          )}
          {status === 'completed' && (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-green-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          <p className="text-gray-700 text-sm">{message}</p>
        </>
      )}
    </div>
  );
};

export default VerifyDatabaseTables; 