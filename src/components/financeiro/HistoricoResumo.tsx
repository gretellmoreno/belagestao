import React, { useMemo } from 'react';
import { HistoricalData } from '../../hooks/useFinanceiroData';
import { formatCurrency } from '../../lib/financeiroUtils';
import ResumoFinanceiroDetalhado from './ResumoFinanceiroDetalhado';

interface HistoricoResumoProps {
  historicalData: HistoricalData;
  isUpdating: boolean;
  dateRangeText: string;
  periodoInicio: Date | null;
  periodoFim: Date | null;
}

const HistoricoResumo: React.FC<HistoricoResumoProps> = ({ 
  historicalData, 
  isUpdating, 
  dateRangeText,
  periodoInicio,
  periodoFim 
}) => {
  // Memoizar os cálculos para evitar recálculos desnecessários
  const totals = useMemo(() => {
    // O valor total é a soma de receita de serviços e produtos
    const valorTotal = historicalData.totalServiceRevenue + historicalData.totalProductRevenue;
    
    // Obter lucro do salão e lucro de produtos diretamente do estado
    const lucroSalao = historicalData.totalProfit - historicalData.totalProductProfit; // Lucro de serviços
    const lucroProdutos = historicalData.totalProductProfit; // Lucro de produtos
    
    // Lucro total (serviços + produtos) já está disponível no estado
    const lucroTotal = historicalData.totalProfit;
    
    // Calcular margem de lucro (se o valor total for 0, a margem é 0)
    const margemLucro = historicalData.profitMargin;

    return {
      valorTotal,
      lucroSalao,
      lucroProdutos,
      lucroTotal,
      margemLucro
    };
  }, [
    historicalData.totalServiceRevenue, 
    historicalData.totalProductRevenue,
    historicalData.totalProfit,
    historicalData.totalProductProfit,
    historicalData.profitMargin
  ]);

  if (historicalData.loading || isUpdating) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <h3 className="text-md font-medium text-gray-700 mb-4">Resumo do Período: {dateRangeText}</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-sm p-4 border border-blue-100">
            <h4 className="text-xs text-blue-500 uppercase font-semibold">Total em Atendimentos</h4>
            <div className="mt-1">
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(historicalData.totalServiceRevenue)}</p>
            </div>
            <p className="text-xs text-blue-800 mt-1">Valor total dos atendimentos</p>
          </div>
          
          <div className="bg-gradient-to-br from-green-50 to-teal-50 rounded-lg shadow-sm p-4 border border-green-100">
            <h4 className="text-xs text-green-500 uppercase font-semibold">Total em Produtos</h4>
            <div className="mt-1">
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(historicalData.totalProductRevenue)}</p>
            </div>
            <p className="text-xs text-green-800 mt-1">Valor total dos produtos vendidos</p>
          </div>
          
          <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-lg shadow-sm p-4 border border-yellow-100">
            <h4 className="text-xs text-yellow-600 uppercase font-semibold">Faturamento Total</h4>
            <div className="mt-1">
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totals.valorTotal)}</p>
            </div>
            <p className="text-xs text-yellow-800 mt-1">Soma de serviços e produtos</p>
          </div>
          
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg shadow-sm p-4 border border-purple-100">
            <h4 className="text-xs text-purple-500 uppercase font-semibold">Lucro Líquido</h4>
            <div className="mt-1">
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totals.lucroTotal)}</p>
            </div>
            <p className="text-xs text-purple-800 mt-1">Margem: {totals.margemLucro.toFixed(2)}%</p>
          </div>
        </div>
      </div>
      
      <ResumoFinanceiroDetalhado 
        periodoInicio={periodoInicio}
        periodoFim={periodoFim}
        totalServiceRevenue={historicalData.totalServiceRevenue}
        totalProductRevenue={historicalData.totalProductRevenue}
        professionalProfit={historicalData.totalCommissions}
        salonProfit={historicalData.salonProfit}
        lucroProfissionais={historicalData.lucroProfissionais}
        onError={(msg) => console.error("Erro no componente ResumoFinanceiroDetalhado:", msg)}
      />
    </>
  );
};

export default React.memo(HistoricoResumo); 