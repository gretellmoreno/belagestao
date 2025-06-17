import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { formatCurrency } from '../../lib/financeiroUtils';

interface TaxasPagamentoProps {
  periodoInicio: Date;
  periodoFim: Date;
  onError?: (message: string) => void;
}

interface TaxaPagamento {
  metodo: string;
  total: number;
  percentual: number;
  valor: number;
}

const TaxasPagamento: React.FC<TaxasPagamentoProps> = ({ 
  periodoInicio, 
  periodoFim,
  onError 
}) => {
  const [taxas, setTaxas] = useState<TaxaPagamento[]>([]);
  const [totalGeral, setTotalGeral] = useState(0);
  const [totalTaxas, setTotalTaxas] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTaxas = async () => {
      setLoading(true);
      try {
        // Converter as datas para formato ISO para o Supabase
        const dataInicio = periodoInicio.toISOString().split('T')[0];
        const dataFim = periodoFim.toISOString().split('T')[0];

        // Buscar agendamentos com serviços e métodos de pagamento
        const { data, error } = await supabase
          .from('appointments')
          .select(`
            id,
            date,
            appointment_services (
              id,
              service_id,
              custom_price,
              payment_method_id,
              payment_method:payment_methods (
                id,
                name,
                fee
              )
            )
          `)
          .gte('date', dataInicio)
          .lte('date', dataFim);

        if (error) {
          console.error('Erro ao buscar dados:', error);
          if (onError) onError('Erro ao buscar dados de taxas de pagamento');
          return;
        }

        // Agrupar por método de pagamento e calcular totais
        const metodoMap: { [key: string]: TaxaPagamento } = {};
        let somaTotal = 0;
        let somaTaxas = 0;

        data?.forEach(appointment => {
          if (appointment.appointment_services && appointment.appointment_services.length > 0) {
            appointment.appointment_services.forEach((service: any) => {
              // Verificar se o serviço tem método de pagamento
              if (service.payment_method_id && service.payment_method) {
                const metodoPagamentoId = service.payment_method_id;
                const metodoPagamentoNome = service.payment_method.name;
                const taxaPercentual = service.payment_method.fee || 0;
                const valorServico = service.custom_price || 0;
                const valorTaxa = (valorServico * taxaPercentual) / 100;

                // Adicionar ao mapa de métodos
                if (!metodoMap[metodoPagamentoId]) {
                  metodoMap[metodoPagamentoId] = {
                    metodo: metodoPagamentoNome,
                    total: 0,
                    percentual: taxaPercentual,
                    valor: 0
                  };
                }

                // Atualizar valores
                metodoMap[metodoPagamentoId].total += valorServico;
                metodoMap[metodoPagamentoId].valor += valorTaxa;

                // Atualizar totais gerais
                somaTotal += valorServico;
                somaTaxas += valorTaxa;
              }
            });
          }
        });

        // Converter para array
        const taxasArray = Object.values(metodoMap);
        
        // Ordenar do maior para o menor valor
        taxasArray.sort((a, b) => b.total - a.total);
        
        setTaxas(taxasArray);
        setTotalGeral(somaTotal);
        setTotalTaxas(somaTaxas);
      } catch (error) {
        console.error('Erro ao processar dados:', error);
        if (onError) onError('Erro ao processar dados de taxas');
      } finally {
        setLoading(false);
      }
    };

    fetchTaxas();
  }, [periodoInicio, periodoFim, onError]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 rounded-full border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Taxas por Método de Pagamento</h2>
      
      {taxas.length === 0 ? (
        <div className="text-center py-4 text-gray-500">
          Nenhuma transação encontrada no período selecionado.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Método
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vendas
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Taxa (%)
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor Taxa
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {taxas.map((taxa, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {taxa.metodo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                      {formatCurrency(taxa.total)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                      {taxa.percentual.toFixed(2).replace('.', ',')}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                      {formatCurrency(taxa.valor)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-100 font-semibold">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    Total
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {formatCurrency(totalGeral)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {totalGeral > 0 ? ((totalTaxas / totalGeral) * 100).toFixed(2).replace('.', ',') : '0,00'}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {formatCurrency(totalTaxas)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-4 bg-blue-50 p-4 rounded-md">
            <h3 className="text-sm font-medium text-blue-800 mb-2">Análise</h3>
            <p className="text-sm text-blue-700">
              No período selecionado, as taxas de pagamento representaram <strong>{totalGeral > 0 ? ((totalTaxas / totalGeral) * 100).toFixed(2) : '0,00'}%</strong> do 
              faturamento total (R$ {formatCurrency(totalTaxas)} em taxas).
              {totalTaxas > 0 && taxas.length > 1 && (
                <span className="block mt-2">
                  Considere incentivar o uso de {taxas[taxas.length - 1].metodo} ({taxas[taxas.length - 1].percentual}%) 
                  em vez de {taxas[0].metodo} ({taxas[0].percentual}%) para reduzir os custos com taxas.
                </span>
              )}
            </p>
          </div>
        </>
      )}
    </div>
  );
};

export default TaxasPagamento; 