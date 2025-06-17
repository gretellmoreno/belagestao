import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getDailyFinancialReport, getFinancialSummary } from '../../lib/financeiroService';
import { formatCurrency } from '../../lib/financeiroUtils';

interface ResumoFinanceiroProps {
  periodoInicio: Date | null | undefined;
  periodoFim: Date | null | undefined;
  onError?: (message: string) => void;
  totalServiceRevenue?: number; // Valor total dos serviços
  totalProductRevenue?: number; // Valor total dos produtos
  professionalProfit?: number; // Lucro dos Profissionais
  salonProfit?: number; // Lucro do Salão (Serviços)
  lucroProfissionais?: number; // Lucro dos Profissionais (campo principal)
}

interface ResumoFinanceiroData {
  servicos?: {
    quantidade?: number;
    valor_bruto?: number;
    lucro_profissional?: number;
    lucro_salao?: number;
  };
  produtos?: {
    quantidade?: number;
    valor_bruto?: number;
    lucro?: number;
  };
  lucroTotal?: number;
}

interface CacheData {
  periodoInicio: string | null;
  periodoFim: string | null;
  dados: ResumoFinanceiroData | null;
  timestamp: number;
}

const formatarDataSql = (data: Date | null | undefined): string => {
  if (!data) return '';
  return data.toISOString().split('T')[0];
};

const ResumoFinanceiroDetalhado: React.FC<ResumoFinanceiroProps> = ({
  periodoInicio,
  periodoFim,
  onError,
  totalServiceRevenue,
  totalProductRevenue,
  professionalProfit,
  salonProfit,
  lucroProfissionais
}) => {
  const [resumo, setResumo] = useState<ResumoFinanceiroData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  const cacheRef = useRef<CacheData>({
    periodoInicio: null,
    periodoFim: null,
    dados: null,
    timestamp: 0
  });
  const requestInProgressRef = useRef<boolean>(false);

  // Verificar se os dados do cache são válidos
  const isCacheValid = useMemo(() => {
    // Sempre retorna false para forçar uma nova requisição enquanto debugamos
    return false;
  }, [periodoInicio, periodoFim]);

  // Função para formatar os valores com segurança, tratando valores indefinidos/nulos
  const safeFormatCurrency = (value?: number): string => {
    return formatCurrency(value || 0);
  };

  // Função para obter valor de uma propriedade de objeto aninhado com segurança
  const getSafeValue = (obj: any, path: string, defaultValue: any = 0): any => {
    try {
      if (!obj) return defaultValue;

      // Tratar caso especial: se a string for apenas uma propriedade simples (sem pontos)
      if (!path.includes('.')) {
        const value = obj[path];
        return value !== undefined && value !== null ? value : defaultValue;
      }
      
      // Para caminhos aninhados com pontos
      const parts = path.split('.');
      let result = obj;
      
      for (const part of parts) {
        if (result === undefined || result === null) return defaultValue;
        result = result[part];
      }
      
      return result !== undefined && result !== null ? result : defaultValue;
    } catch (error) {
      console.error(`Erro ao acessar caminho ${path}:`, error);
      return defaultValue;
    }
  };

  useEffect(() => {
    const fetchResumo = async () => {
      // Evitar requisições simultâneas
      if (requestInProgressRef.current) {
        console.log("Requisição já em andamento, ignorando chamada duplicada");
        return;
      }

      // Verificar se as datas estão definidas
      if (!periodoInicio || !periodoFim) {
        console.error("Datas de período não definidas");
        if (onError) onError("Período não definido para o resumo financeiro");
        setIsLoading(false);
        setHasError(true);
        return;
      }

      // Verificar se temos dados em cache válidos
      if (isCacheValid) {
        console.log("Usando dados em cache para o resumo financeiro");
        setResumo(cacheRef.current.dados);
        setIsLoading(false);
        setHasError(false);
        return;
      }
      
      // Iniciar requisição
      requestInProgressRef.current = true;
      setIsLoading(true);
      setHasError(false);
      
      try {
        // Converter as datas para formato SQL para o Supabase
        const dataInicio = formatarDataSql(periodoInicio);
        const dataFim = formatarDataSql(periodoFim);

        console.log(`Buscando dados financeiros para o período: ${dataInicio} até ${dataFim}`);
        
        let resumoProcessado: ResumoFinanceiroData;
        
        // Verificar se é um relatório de um único dia
        if (dataInicio === dataFim) {
          console.log('Buscando relatório financeiro diário para:', dataInicio);
          
          // Utilizar a função de relatório diário
          const dailyReport = await getDailyFinancialReport(dataInicio);
          
          if (dailyReport) {
            console.log('Relatório financeiro diário obtido:', dailyReport);
            
            resumoProcessado = {
              servicos: {
                quantidade: dailyReport.total_services_count || 0,
                valor_bruto: dailyReport.services_total_value || 0,
                lucro_profissional: dailyReport.professional_profit || 0,
                lucro_salao: dailyReport.salon_profit || 0
              },
              produtos: {
                quantidade: dailyReport.total_products_count || 0,
                valor_bruto: dailyReport.products_total_value || 0,
                lucro: dailyReport.products_profit || 0
              },
              lucroTotal: dailyReport.lucro_liquido || 0
            };
          } else {
            console.warn('Nenhum dado retornado do relatório diário, tentando método alternativo');
            // Usar a função getFinancialSummary que agora retorna os dados corretos
            const financialData = await getFinancialSummary(dataInicio, dataFim);
            
            resumoProcessado = {
              servicos: {
                quantidade: financialData.services_count || 0,
                valor_bruto: financialData.services_total_value || 0,
                lucro_profissional: financialData.professional_profit || 0,
                lucro_salao: financialData.salon_profit || 0
              },
              produtos: {
                quantidade: financialData.products_count || 0,
                valor_bruto: financialData.products_total_value || 0,
                lucro: financialData.products_profit || 0
              },
              lucroTotal: financialData.lucro_liquido || 0
            };
          }
        } else {
          // Para períodos mais longos, usar getFinancialSummary diretamente
          const financialData = await getFinancialSummary(dataInicio, dataFim);
          console.log("Dados financeiros obtidos:", financialData);
          
          resumoProcessado = {
            servicos: {
              quantidade: financialData.services_count || 0,
              valor_bruto: financialData.services_total_value || 0,
              lucro_profissional: financialData.professional_profit || 0,
              lucro_salao: financialData.salon_profit || 0
            },
            produtos: {
              quantidade: financialData.products_count || 0,
              valor_bruto: financialData.products_total_value || 0,
              lucro: financialData.products_profit || 0
            },
            lucroTotal: financialData.lucro_liquido || 0
          };
        }

        // Atualizar o cache e o estado
        cacheRef.current = {
          periodoInicio: periodoInicio ? periodoInicio.toISOString().split('T')[0] : null,
          periodoFim: periodoFim ? periodoFim.toISOString().split('T')[0] : null,
          dados: resumoProcessado,
          timestamp: Date.now()
        };

        setResumo(resumoProcessado);
        setHasError(false);
      } catch (error) {
        console.error("Erro geral ao processar dados:", error);
        setHasError(true);
        if (onError) onError("Erro inesperado ao processar dados do resumo financeiro");
      } finally {
        setIsLoading(false);
        requestInProgressRef.current = false;
      }
    };

    fetchResumo();
  }, [periodoInicio, periodoFim, onError, isCacheValid]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (hasError || !resumo) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>Não foi possível carregar o resumo financeiro.</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-4 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-md text-sm hover:bg-indigo-200 transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  // Acesso seguro aos valores com defaults para evitar erros
  const servicosQuantidade = getSafeValue(resumo, 'servicos.quantidade', 0);
  const servicosValorBruto = getSafeValue(resumo, 'servicos.valor_bruto', 0);
  const servicosLucroProfissional = getSafeValue(resumo, 'servicos.lucro_profissional', 0);
  const servicosLucroSalao = getSafeValue(resumo, 'servicos.lucro_salao', 0);
  
  const produtosQuantidade = getSafeValue(resumo, 'produtos.quantidade', 0);
  const produtosValorBruto = getSafeValue(resumo, 'produtos.valor_bruto', 0);
  const produtosLucro = getSafeValue(resumo, 'produtos.lucro', 0);
  
  const lucroTotal = getSafeValue(resumo, 'lucroTotal', 0);

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Resumo Detalhado</h2>
      
      {/* 1. Serviços Realizados */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-md font-medium text-gray-700">Serviços Realizados</h3>
        </div>
        <div className="flex justify-between p-2 bg-gray-50 rounded">
          <span>Total:</span>
          <span className="font-medium">{safeFormatCurrency(totalServiceRevenue !== undefined ? totalServiceRevenue : servicosValorBruto)}</span>
        </div>
        <div className="flex justify-between p-2 mt-1 bg-gray-50 rounded">
          <span>Lucro do Salão (Serviços)</span>
          <span className="font-medium">{safeFormatCurrency(salonProfit !== undefined ? salonProfit : servicosLucroSalao)}</span>
        </div>
        <div className="flex justify-between p-2 mt-1 bg-gray-50 rounded">
          <span>Lucro dos Profissionais</span>
          <span className="font-medium">{safeFormatCurrency(
            lucroProfissionais !== undefined ? lucroProfissionais : 
            (professionalProfit !== undefined ? professionalProfit : servicosLucroProfissional)
          )}</span>
        </div>
      </div>
      
      {/* 2. Vendas de Produtos */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-md font-medium text-gray-700">Vendas de Produtos</h3>
        </div>
        <div className="flex justify-between p-2 bg-gray-50 rounded">
          <span>Total:</span>
          <span className="font-medium">{safeFormatCurrency(totalProductRevenue !== undefined ? totalProductRevenue : produtosValorBruto)}</span>
        </div>
        <div className="flex justify-between p-2 mt-1 bg-gray-50 rounded">
          <span>Lucro sobre Produtos</span>
          <span className="font-medium">{safeFormatCurrency(produtosLucro)}</span>
        </div>
      </div>
          
      {/* 3. Lucro Total Consolidado */}
      <div className="mb-4">
        <h3 className="text-md font-medium text-gray-700 mb-2">Lucro Total (Serviços + Produtos)</h3>
        <div className="flex justify-between p-2 bg-gray-50 rounded">
          <span>Lucro do Salão (Serviços)</span>
          <span className="font-medium">{safeFormatCurrency(salonProfit !== undefined ? salonProfit : servicosLucroSalao)}</span>
        </div>
        <div className="flex justify-between p-2 mt-1 bg-gray-50 rounded">
          <span>Lucro sobre Produtos</span>
          <span className="font-medium">{safeFormatCurrency(produtosLucro)}</span>
        </div>
        <div className="flex justify-between p-2 mt-1 bg-gray-50 rounded font-medium">
          <span>LUCRO TOTAL</span>
          <span className={`${lucroTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {safeFormatCurrency(lucroTotal)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ResumoFinanceiroDetalhado); 