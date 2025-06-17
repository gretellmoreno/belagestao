import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const CheckTableStructure: React.FC = () => {
  const [tableInfo, setTableInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTableStructure() {
      try {
        setLoading(true);
        
        // Verificar se a tabela appointments existe
        const { data: tablesData, error: tablesError } = await supabase
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_schema', 'public')
          .eq('table_name', 'appointments');

        if (tablesError) {
          throw tablesError;
        }

        if (!tablesData || tablesData.length === 0) {
          setError('A tabela appointments não existe no banco de dados.');
          setLoading(false);
          return;
        }

        // Buscar a estrutura da tabela (colunas)
        const { data: columnsData, error: columnsError } = await supabase
          .from('information_schema.columns')
          .select('column_name, data_type, is_nullable, column_default')
          .eq('table_schema', 'public')
          .eq('table_name', 'appointments');

        if (columnsError) {
          throw columnsError;
        }

        // Fazer uma consulta de exemplo para ver os dados existentes
        const { data: sampleData, error: sampleError } = await supabase
          .from('appointments')
          .select('*')
          .limit(1);

        setTableInfo({
          columns: columnsData,
          sampleData: sampleData || []
        });
      } catch (err: any) {
        console.error('Erro ao verificar estrutura da tabela:', err);
        setError(err.message || 'Erro ao verificar estrutura da tabela');
      } finally {
        setLoading(false);
      }
    }

    fetchTableStructure();
  }, []);

  // Apenas para debugging - remover após uso
  console.log('Table Info:', tableInfo);

  if (loading) return <div>Carregando informações da tabela...</div>;
  if (error) return <div>Erro: {error}</div>;

  return (
    <div>
      <h3>Estrutura da Tabela appointments</h3>
      {tableInfo && (
        <div>
          <h4>Colunas:</h4>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Nulo Permitido</th>
                <th>Valor Padrão</th>
              </tr>
            </thead>
            <tbody>
              {tableInfo.columns.map((column: any) => (
                <tr key={column.column_name}>
                  <td>{column.column_name}</td>
                  <td>{column.data_type}</td>
                  <td>{column.is_nullable}</td>
                  <td>{column.column_default}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h4>Amostra de Dados:</h4>
          <pre>{JSON.stringify(tableInfo.sampleData, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default CheckTableStructure; 