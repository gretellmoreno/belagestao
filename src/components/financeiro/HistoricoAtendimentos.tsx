import React, { useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { Calendar, User, CreditCard, DollarSign } from 'lucide-react';
import { formatCurrency } from '../../lib/financeiroUtils';
import { AppointmentHistoryItem } from '../../lib/financeiroService';

interface HistoricoAtendimentosProps {
  dados: AppointmentHistoryItem[];
  isLoading: boolean;
  viewMode?: 'desktop' | 'mobile';
}

const HistoricoAtendimentos: React.FC<HistoricoAtendimentosProps> = ({
  dados = [],
  isLoading,
  viewMode = 'desktop'
}) => {
  console.log('HistoricoAtendimentos recebeu dados:', dados?.length, 'itens');

  const formatarData = (data: string) => {
    if (!data) return '';
    try {
      // Se a data já estiver no formato ISO, usar parseISO
      if (data.includes('T')) {
        return format(parseISO(data), 'dd/MM/yyyy HH:mm');
      }
      // Caso contrário, assumir formato YYYY-MM-DD
      const [ano, mes, dia] = data.split('-');
      return `${dia}/${mes}/${ano}`;
    } catch (error) {
      console.error('Erro ao formatar data:', error);
      return data;
    }
  };

  const formatarValor = (valor: number) => {
    return formatCurrency(valor || 0);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!dados || dados.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-400" />
        <p>Nenhum atendimento encontrado para o período selecionado.</p>
      </div>
    );
  }

  // Versão Mobile
  if (viewMode === 'mobile') {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Histórico de Atendimentos ({dados.length})
        </h3>
        
        {dados.map((atendimento, index) => (
          <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center">
                <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-sm font-medium text-gray-900">
                  {formatarData(atendimento.atendimento_date)}
                </span>
              </div>
              <span className="text-lg font-bold text-green-600">
                R$ {formatarValor(atendimento.net_value)}
              </span>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex items-center">
                <User className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-gray-600">Profissional:</span>
                <span className="ml-1 font-medium">{atendimento.professional_name}</span>
              </div>
              
              <div className="flex items-center">
                <User className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-gray-600">Cliente:</span>
                <span className="ml-1 font-medium">{atendimento.client_name}</span>
              </div>
              
              <div className="flex items-center">
                <CreditCard className="h-4 w-4 text-gray-400 mr-2" />
                <span className="text-gray-600">Pagamento:</span>
                <span className="ml-1">{atendimento.payment_method_name}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-100">
                <div>
                  <span className="text-xs text-gray-500">Lucro Salão</span>
                  <div className="font-medium text-blue-600">R$ {formatarValor(atendimento.salon_profit)}</div>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Lucro Profissional</span>
                  <div className="font-medium text-purple-600">R$ {formatarValor(atendimento.professional_profit)}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Versão Desktop
  return (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Histórico de Atendimentos ({dados.length})
      </h3>
      
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data/Hora
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Profissional
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Forma de Pagamento
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor Total
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lucro Salão
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lucro Profissional
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {dados.map((atendimento, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatarData(atendimento.atendimento_date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {atendimento.professional_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {atendimento.client_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {atendimento.payment_method_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right text-green-600">
                    R$ {formatarValor(atendimento.net_value)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right text-blue-600">
                    R$ {formatarValor(atendimento.salon_profit)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right text-purple-600">
                    R$ {formatarValor(atendimento.professional_profit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HistoricoAtendimentos; 