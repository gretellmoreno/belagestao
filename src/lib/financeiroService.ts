import { supabase } from './supabaseClient';

// Interfaces para os novos históricos detalhados
export interface AppointmentHistoryItem {
  atendimento_date: string;
  professional_name: string;
  client_name: string;
  payment_method_name: string;
  net_value: number;
  salon_profit: number;
  professional_profit: number;
}

export interface ProductHistoryItem {
  sale_date: string;
  client_name: string;
  product_name: string;
  quantity: number;
  gross_total: number;
  net_profit: number;
  payment_method_name: string;
}

/**
 * Obtém o resumo financeiro diário para uma data específica usando a RPC em tempo real
 * @param dataSelecionada Data no formato YYYY-MM-DD
 * @returns Dados do relatório financeiro diário
 */
export const getDailyFinancialReport = async (dataSelecionada: string) => {
  try {
    // Chamar a RPC get_realtime_financial_report com o parâmetro de data
    const { data, error } = await supabase
      .rpc('get_realtime_financial_report', { 
        _date: dataSelecionada 
      });
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      console.warn('Nenhum dado retornado pela função get_realtime_financial_report');
      return {
        services_total_value: 0,
        products_total_value: 0,
        faturamento_total: 0,
        lucro_liquido: 0,
        salon_profit: 0,
        professional_profit: 0,
        products_profit: 0,
        total_services_count: 0,
        total_products_count: 0,
        margem_percent: 0
      };
    }
    
    // Mapear os campos retornados conforme especificado
    const reportData = data[0];
    return {
      services_total_value: reportData.services_total_value || 0,  // Total em Atendimentos
      products_total_value: reportData.products_total_value || 0,  // Total em Produtos
      faturamento_total: reportData.faturamento_total || 0,        // Faturamento Total
      lucro_liquido: reportData.lucro_liquido || 0,               // Lucro Líquido
      salon_profit: reportData.salon_profit || 0,                 // Lucro do Salão (Serviços)
      professional_profit: reportData.professional_profit || 0,   // Lucro dos Profissionais
      products_profit: reportData.products_profit || 0,           // Lucro sobre Produtos
      total_services_count: reportData.total_services_count || 0,
      total_products_count: reportData.total_products_count || 0,
      margem_percent: reportData.margem_percent || 0
    };
  } catch (error) {
    console.error('Erro ao obter relatório financeiro diário em tempo real:', error);
    throw error;
  }
};

/**
 * Obtém o resumo financeiro do período especificado usando a RPC get_financial_summary
 * @param dataInicio Data de início no formato YYYY-MM-DD
 * @param dataFim Data de fim no formato YYYY-MM-DD
 * @returns Dados do resumo financeiro completo
 */
export const getFinancialSummary = async (dataInicio: string, dataFim: string) => {
  try {
    console.log(`Buscando resumo financeiro para período: ${dataInicio} até ${dataFim}`);
    
    // Chamar a RPC get_financial_summary conforme especificado
    const { data, error } = await supabase
      .rpc('get_financial_summary', { data_inicio: dataInicio, data_fim: dataFim });
    
    if (error) throw error;
    
    if (!data || data.length === 0) {
      console.warn('Nenhum dado retornado pela função get_financial_summary');
      return {
        // Novos campos retornados pela RPC
        services_total_value: 0,
        services_count: 0,
        salon_profit: 0,
        professional_profit: 0,
        products_total_value: 0,
        products_count: 0,
        products_profit: 0,
        faturamento_total: 0,
        lucro_liquido: 0,
        margem_percent: 0
      };
    }
    
    const rpt = data[0];
    console.log('RPC get_financial_summary:', data[0]);
    console.log('Resumo Financeiro:', rpt);
    
    // Mapear os campos conforme especificação
    const processedData = {
      // Total em Atendimentos ← rpt.services_total_value
      services_total_value: Number(rpt.services_total_value) || 0,
      services_count: Number(rpt.services_count) || 0,
      
      // Lucro do Salão (Serviços) ← rpt.salon_profit
      salon_profit: Number(rpt.salon_profit) || 0,
      
      // Lucro dos Profissionais ← rpt.professional_profit
      professional_profit: Number(rpt.professional_profit) || 0,
      lucroProfissionais: Number(rpt.professional_profit) || 0,
      
      // Total em Produtos ← rpt.products_total_value
      products_total_value: Number(rpt.products_total_value) || 0,
      products_count: Number(rpt.products_count) || 0,
      products_profit: Number(rpt.products_profit) || 0,
      
      // Faturamento Total ← rpt.faturamento_total
      faturamento_total: Number(rpt.faturamento_total) || 0,
      
      // Lucro Líquido ← rpt.lucro_liquido
      lucro_liquido: Number(rpt.lucro_liquido) || 0,
      
      // Margem (%) ← rpt.margem_percent
      margem_percent: Number(rpt.margem_percent) || 0
    };
    
    console.log('Dados processados do resumo financeiro:', processedData);
    
    return processedData;
  } catch (error) {
    console.error('Erro ao obter resumo financeiro:', error);
    throw error;
  }
};

/**
 * Obtém o resumo de vendas de produtos do período especificado
 * @param dataInicio Data de início no formato YYYY-MM-DD 
 * @param dataFim Data de fim no formato YYYY-MM-DD
 * @returns Dados do resumo de vendas de produtos
 */
export const getProductSalesSummary = async (dataInicio: string, dataFim: string) => {
  try {
    // Buscar vendas de produtos concluídas no período
    const { data: ps, error: prodError } = await supabase
      .from('product_sales')
      .select('gross_total, net_profit')
      .eq('status', 'completed')
      .gte('sale_date', dataInicio)
      .lte('sale_date', dataFim);
    
    if (prodError) throw prodError;
    
    if (!ps || ps.length === 0) {
      return {
        totalProdutos: 0,
        lucroProdutos: 0
      };
    }
    
    // Calcular os totais somando os valores retornados
    const totalProdutos = ps.reduce((sum, x) => sum + Number(x.gross_total), 0);
    const lucroProdutos = ps.reduce((sum, x) => sum + Number(x.net_profit), 0);
    
    return {
      totalProdutos,
      lucroProdutos
    };
  } catch (error) {
    console.error('Erro ao obter resumo de vendas de produtos:', error);
    throw error;
  }
};

/**
 * Obtém o resumo financeiro completo para o período especificado
 * @param dataInicio Data de início no formato YYYY-MM-DD
 * @param dataFim Data de fim no formato YYYY-MM-DD
 * @returns Dados consolidados do resumo financeiro
 */
export const getFullFinancialSummary = async (dataInicio: string, dataFim: string) => {
  try {
    // Agora podemos usar apenas a função getFinancialSummary que já retorna todos os dados
    const financialData = await getFinancialSummary(dataInicio, dataFim);
    
    // Retornar dados no formato esperado pelos componentes
    return {
      // Dados de serviços
      services_total_value: financialData.services_total_value,
      services_count: financialData.services_count,
      services_profit: financialData.salon_profit,
      professionals_profit: financialData.professional_profit,
      
      // Dados de produtos
      products_total_value: financialData.products_total_value,
      products_count: financialData.products_count,
      products_profit: financialData.products_profit,
      
      // Totais consolidados
      faturamento_total: financialData.faturamento_total,
      lucro_liquido: financialData.lucro_liquido,
      margem_percent: financialData.margem_percent
    };
  } catch (error) {
    console.error('Erro ao obter resumo financeiro completo:', error);
    throw error;
  }
};

/**
 * Obtém o histórico detalhado de atendimentos para o período especificado
 * @param dataInicio Data de início no formato YYYY-MM-DD
 * @param dataFim Data de fim no formato YYYY-MM-DD
 * @returns Array com histórico de atendimentos
 */
export const getAppointmentsHistory = async (dataInicio: string, dataFim: string): Promise<AppointmentHistoryItem[]> => {
  try {
    console.log('🔍 Atendimentos RPC params:', { data_inicio: dataInicio, data_fim: dataFim });
    
    const { data, error } = await supabase
      .rpc('get_appointments_history', { 
        data_inicio: dataInicio, 
        data_fim: dataFim 
      });
    
    console.log('🔍 Atendimentos RPC result:', { data, error });
    
    if (error) {
      console.error('❌ Erro ao buscar histórico de atendimentos:', error);
      throw error;
    }
    
    if (!data || data.length === 0) {
      console.warn('⚠️ Nenhum atendimento encontrado para o período especificado');
      return [];
    }
    
    console.log(`✅ Histórico de atendimentos obtido: ${data.length} registros`, data);
    return data as AppointmentHistoryItem[];
  } catch (error) {
    console.error('❌ Erro ao obter histórico de atendimentos:', error);
    throw error;
  }
};

/**
 * Obtém o histórico detalhado de vendas de produtos para o período especificado
 * @param dataInicio Data de início no formato YYYY-MM-DD
 * @param dataFim Data de fim no formato YYYY-MM-DD
 * @returns Array com histórico de vendas de produtos
 */
export const getProductsHistory = async (dataInicio: string, dataFim: string): Promise<ProductHistoryItem[]> => {
  try {
    console.log('🔍 Produtos RPC params:', { data_inicio: dataInicio, data_fim: dataFim });
    
    const { data, error } = await supabase
      .rpc('get_products_history', { 
        data_inicio: dataInicio, 
        data_fim: dataFim 
      });
    
    console.log('🔍 Produtos RPC result:', { data, error });
    
    if (error) {
      console.error('❌ Erro ao buscar histórico de produtos:', error);
      throw error;
    }
    
    if (!data || data.length === 0) {
      console.warn('⚠️ Nenhuma venda de produto encontrada para o período especificado');
      return [];
    }
    
    console.log(`✅ Histórico de produtos obtido: ${data.length} registros`, data);
    return data as ProductHistoryItem[];
  } catch (error) {
    console.error('❌ Erro ao obter histórico de produtos:', error);
    throw error;
  }
}; 