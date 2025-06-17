import { useState, useEffect, useCallback, useRef } from 'react';
import { startOfDay, endOfDay, subDays, format, isSameDay } from 'date-fns';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'react-toastify';
import { PaymentMethod, PaymentMethodFormState } from '../types/paymentTypes';
import { getFinancialSummary, getAppointmentsHistory, getProductsHistory, AppointmentHistoryItem, ProductHistoryItem } from '../lib/financeiroService';

// Interfaces
export interface Professional {
  id: string;
  name: string;
}

export interface Service {
  id: string;
  name: string;
  price: number;
  commission: number;
}

export interface Client {
  id: string | number;
  name: string;
}

export interface SoldProductRaw {
  id?: string;
  name?: string;
  price?: number;
  quantity?: number | string;
  total?: number;
  cost_price?: number;
}

export interface FinanceiroAppointment {
  id: string;
  date: string; 
  client_id: string;
  client_name?: string;
  professional_id: string;
  professional_name?: string;
  services?: unknown[];
  products?: unknown[];
  services_data?: unknown[];
  products_data?: unknown[];
  payment_method_id?: string;
  services_total_value?: number;
  created_at?: string;
  updated_at?: string;
  status?: string;
  net_value?: number;
  commission_rate?: number;
  clients: {
    id: string;
    name: string;
  };
  total_value: number;
  payment_fee: number;
  payment_method: string;
  payment_methods?: {
    id: string | number;
    name: string;
    fee: number;
  };
}

export interface FormattedAppointment {
  id: string;
  client: {
    id: string;
    name: string;
  };
  services: Array<{
    name: string;
    commission: number;
    price: number;
  }>;
  service_names: string[];
  date: string;
  time: string;
  total_value: number;
  payment_method: string;
  payment_fee: number;
  payment_fee_percent: number;
  commission_rate?: number;
  products: SoldProductRaw[];
  cash_closing_id?: string | null;
}

export interface EmployeeAdvance {
  id: string;
  amount: number;
  date: string;
  professional_id: string;
  professional: {
    id: string;
    name: string;
  };
  discounted?: boolean;
  closure_date?: string;
}

export interface ProductSale {
  id: string;
  sale_date: string;
  product_name: string;
  payment_method_id: string;
  quantity: number;
  unit_price: number;
  gross_total: number;
  net_profit: number;
  professional_id?: string | null;
  professional_name?: string;
  appointment_id?: string | null;
  
  date?: string;
  price?: number;
  cost_price?: number;
  payment_method?: string;
  source?: 'appointment' | 'sale';
}

export interface CashClosing {
  id: string;
  date: string;
  time?: string;
  professional_id: string;
  professional?: Professional;
  client?: Client;
  total_value: number;
  net_value?: number;
  services_total_value?: number;
  salon_profit?: number;
  payment_method?: string;
  payment_method_id?: string;
  appointment_id?: string;
  products?: SoldProductRaw[];
  commission_rate?: number;
  commission?: number;
  payment_fee?: number;
}

export interface HistoricalData {
  loading: boolean;
  totalAppointments: number;
  totalProductSales: number;
  totalCommissions: number;
  salonProfit: number;
  lucroProfissionais: number;
  totalProductProfit: number;
  totalSales: number;
  cashClosings: CashClosing[];
  productSales: ProductSale[];
  totalServiceRevenue: number;
  totalProductRevenue: number;
  totalTaxes: number;
  totalProfit: number;
  profitMargin: number;
  appointmentsHistory: AppointmentHistoryItem[];
  productsHistory: ProductHistoryItem[];
  appointmentsHistoryLoading: boolean;
  productsHistoryLoading: boolean;
}

export interface DateRangeType {
  startDate: Date | null;
  endDate: Date | null;
}

// Adicionar interfaces para os tipos

interface ProductData {
  id?: string;
  quantity?: number;
  price?: number;
  originalPrice?: number;
  cost_price?: number;
}

interface ProductsData {
  [key: string]: ProductData;
}

export interface AppointmentConfirmation {
  products_data?: ProductsData;
  commission_rate?: number;
  created_at?: string;
  appointment_id?: string;
  appointment_services?: unknown[];
}

// Interface para o payment_method
export interface PaymentMethodType {
  id: string;
  name: string;
  fee: number;
}

// Interface para o appointment_service
export interface AppointmentServiceType {
  id: string;
  service_id: string;
  custom_price: number;
  payment_method_id?: string;
  payment_fee?: number;
  salon_profit?: number;
  net_service_value?: number;
  net_value?: number;
  professional_profit?: number;
  commission_rate?: number;
  service?: {
    id: string;
    name: string;
  };
  payment_method?: PaymentMethodType;
}

// Hook principal
const useFinanceiroData = () => {
  // Estados para abas e navegação
  const [activeTab, setActiveTab] = useState<'resumo' | 'taxas' | 'caixa' | 'historico'>('historico');
  const [activeHistoryTab, setActiveHistoryTab] = useState<'resumo' | 'atendimentos' | 'produtos'>('resumo');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  // Estados para modais
  const [showNewValeModal, setShowNewValeModal] = useState(false);
  const [showNewPaymentMethodModal, setShowNewPaymentMethodModal] = useState(false);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [isEditingPaymentMethod, setIsEditingPaymentMethod] = useState(false);
  const [editingPaymentMethodId, setEditingPaymentMethodId] = useState<string | null>(null);
  const [isEditingVale, setIsEditingVale] = useState(false);
  const [editingValeId, setEditingValeId] = useState<string | null>(null);

  // Estados para dados
  const [vales, setVales] = useState<EmployeeAdvance[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [selectedProfessional, setSelectedProfessional] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  // Estados para formulários
  const [newVale, setNewVale] = useState<{
    date: string;
    amount: string;
    professional_id: string;
  }>({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    professional_id: '',
  });
  
  const [newPaymentMethod, setNewPaymentMethod] = useState<PaymentMethodFormState>({
    name: '',
    fee: '',
  });

  // Estado para filtro de período - configurado para mostrar apenas o dia atual
  const [dateRange, setDateRange] = useState<DateRangeType>({
    startDate: startOfDay(new Date()),
    endDate: endOfDay(new Date()),
  });

  // Estado para dados históricos
  const [historicalData, setHistoricalData] = useState<HistoricalData>({
    loading: true,
    totalAppointments: 0,
    totalProductSales: 0,
    totalCommissions: 0,
    salonProfit: 0,
    lucroProfissionais: 0,
    totalProductProfit: 0,
    totalSales: 0,
    cashClosings: [],
    productSales: [],
    totalServiceRevenue: 0,
    totalProductRevenue: 0,
    totalTaxes: 0,
    totalProfit: 0,
    profitMargin: 0,
    appointmentsHistory: [],
    productsHistory: [],
    appointmentsHistoryLoading: true,
    productsHistoryLoading: true,
  });

  // Referência para controlar se os dados já foram carregados
  const dataLoadedRef = useRef({
    initial: false,
    historical: false
  });

  // Função para atualizar o relatório financeiro com base na data selecionada
  const refreshFinanceiro = useCallback(async (date: string) => {
    try {
      console.log('Atualizando relatório financeiro para a data:', date);
      
      // Chamar a RPC get_realtime_financial_report
      const { data, error } = await supabase
        .rpc('get_realtime_financial_report', { _date: date });
      
      if (error) {
        console.error('Erro ao obter relatório financeiro em tempo real:', error);
        throw error;
      }
      
      if (!data || data.length === 0) {
        console.warn('Nenhum dado retornado pelo relatório em tempo real');
        return;
      }
      
      // Mapear os dados do relatório para o formato do estado
      const rpt = data[0];
      console.log('Dados do relatório em tempo real obtidos:', rpt);
      console.log('🔍 Valor específico de professional_profit:', rpt.professional_profit);
      
      setHistoricalData({
        loading: false,
        totalAppointments: 0,
        totalProductSales: 0,
        totalCommissions: rpt.professional_profit || 0,         // Lucro dos Profissionais
        salonProfit: rpt.salon_profit || 0,
        lucroProfissionais: rpt.professional_profit || 0,
        totalProductProfit: rpt.products_profit || 0,           // Lucro sobre Produtos
        totalSales: rpt.faturamento_total || 0,                 // Faturamento Total
        cashClosings: [],
        productSales: [],
        totalServiceRevenue: rpt.services_total_value || 0,     // Total em Atendimentos
        totalProductRevenue: rpt.products_total_value || 0,     // Total em Produtos
        totalTaxes: 0,
        totalProfit: rpt.lucro_liquido || 0,                    // Lucro Líquido
        profitMargin: rpt.margem_percent || 0,
        appointmentsHistory: [],
        productsHistory: [],
        appointmentsHistoryLoading: true,
        productsHistoryLoading: true,
      });
      
      console.log('✅ Relatório financeiro em tempo real atualizado com sucesso');
      console.log('💰 Lucro dos Profissionais mapeado:', rpt.professional_profit || 0);
    } catch (error) {
      console.error('Erro ao atualizar relatório financeiro em tempo real:', error);
      toast.error('Não foi possível atualizar o relatório financeiro');
    }
  }, []);
  
  // Função para buscar dados históricos - movida para antes do uso
  const fetchHistoricalData = useCallback(async () => {
    if (!dateRange.startDate || !dateRange.endDate) return;

    try {
      setHistoricalData(prev => ({ ...prev, loading: true }));
      setIsUpdating(true);

      // Formatar datas para o formato YYYY-MM-DD para o Supabase
      const formattedStartDate = format(startOfDay(dateRange.startDate), 'yyyy-MM-dd');
      const formattedEndDate = format(endOfDay(dateRange.endDate), 'yyyy-MM-dd');

      // Verificar se é relatório de um único dia
      if (isSameDay(dateRange.startDate, dateRange.endDate)) {
        console.log('Buscando relatório financeiro diário para:', formattedStartDate);
        
        // Utilizar a função de relatório diário
        try {
          await refreshFinanceiro(formattedStartDate);
          setIsUpdating(false);
          return;
        } catch (error) {
          console.warn('Erro ao obter relatório diário, tentando método alternativo:', error);
          // Continue com o método existente se o relatório diário falhar
        }
      }
      
      // Usar a função getFinancialSummary que agora usa a nova RPC unificada
      console.log(`Buscando dados financeiros para o período: ${formattedStartDate} até ${formattedEndDate}`);

      const financialSummary = await getFinancialSummary(formattedStartDate, formattedEndDate);
      
      console.log('Resumo financeiro obtido:', financialSummary);
      
      // Extrair dados já processados com os novos nomes de campos
      const totalAtendimentos = financialSummary.services_total_value;
      const lucroSalao = financialSummary.salon_profit;
      const lucroProfissionais = financialSummary.professional_profit;
      const totalProdutos = financialSummary.products_total_value;
      const lucroProdutos = financialSummary.products_profit;
      const faturamentoTotal = financialSummary.faturamento_total;
      const lucroLiquido = financialSummary.lucro_liquido;
      const margemLucro = financialSummary.margem_percent;

      // Atualizar o estado com os novos dados
      setHistoricalData({
        loading: false,
        totalAppointments: financialSummary.services_count || 0,
        totalProductSales: financialSummary.products_count || 0,
        totalCommissions: lucroProfissionais,
        salonProfit: lucroSalao,
        lucroProfissionais: lucroProfissionais,
        totalProductProfit: lucroProdutos,
        totalSales: faturamentoTotal,
        cashClosings: [],
        productSales: [],
        totalServiceRevenue: totalAtendimentos,
        totalProductRevenue: totalProdutos,
        totalTaxes: 0,
        totalProfit: lucroLiquido,
        profitMargin: margemLucro,
        appointmentsHistory: [],
        productsHistory: [],
        appointmentsHistoryLoading: true,
        productsHistoryLoading: true,
      });

      console.log('Relatório financeiro processado com sucesso:', {
        totalAtendimentos,
        lucroSalao,
        lucroProfissionais,
        totalProdutos,
        lucroProdutos,
        faturamentoTotal,
        lucroLiquido,
        margemLucro
      });

    } catch (error) {
      console.error('Erro ao processar dados financeiros:', error);
      toast.error('Erro ao processar relatório financeiro. Verifique o console para mais detalhes.');
      
      setHistoricalData(prev => ({
        ...prev,
        loading: false
      }));
    } finally {
      setIsUpdating(false);
    }
  }, [dateRange, refreshFinanceiro]);

  // Função para buscar histórico detalhado de atendimentos
  const fetchAppointmentsHistory = useCallback(async () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      console.warn('🚫 fetchAppointmentsHistory: Datas não definidas', { startDate: dateRange.startDate, endDate: dateRange.endDate });
      return;
    }

    try {
      console.log('🚀 Iniciando fetchAppointmentsHistory...');
      setHistoricalData(prev => ({ ...prev, appointmentsHistoryLoading: true }));

      const formattedStartDate = format(startOfDay(dateRange.startDate), 'yyyy-MM-dd');
      const formattedEndDate = format(endOfDay(dateRange.endDate), 'yyyy-MM-dd');

      console.log('📅 Datas formatadas para RPC:', { formattedStartDate, formattedEndDate });

      const appointmentsHistory = await getAppointmentsHistory(formattedStartDate, formattedEndDate);

      console.log('📊 Resultado do getAppointmentsHistory:', appointmentsHistory);

      setHistoricalData(prev => ({
        ...prev,
        appointmentsHistory,
        appointmentsHistoryLoading: false
      }));

      console.log(`✅ Histórico de atendimentos carregado no estado: ${appointmentsHistory.length} registros`);
    } catch (error) {
      console.error('❌ Erro ao carregar histórico de atendimentos:', error);
      toast.error('Erro ao carregar histórico de atendimentos');
      
      setHistoricalData(prev => ({
        ...prev,
        appointmentsHistory: [],
        appointmentsHistoryLoading: false
      }));
    }
  }, [dateRange]);

  // Função para buscar histórico detalhado de produtos
  const fetchProductsHistory = useCallback(async () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      console.warn('🚫 fetchProductsHistory: Datas não definidas', { startDate: dateRange.startDate, endDate: dateRange.endDate });
      return;
    }

    try {
      console.log('🚀 Iniciando fetchProductsHistory...');
      setHistoricalData(prev => ({ ...prev, productsHistoryLoading: true }));

      const formattedStartDate = format(startOfDay(dateRange.startDate), 'yyyy-MM-dd');
      const formattedEndDate = format(endOfDay(dateRange.endDate), 'yyyy-MM-dd');

      console.log('📅 Datas formatadas para RPC:', { formattedStartDate, formattedEndDate });

      const productsHistory = await getProductsHistory(formattedStartDate, formattedEndDate);

      console.log('📊 Resultado do getProductsHistory:', productsHistory);

      setHistoricalData(prev => ({
        ...prev,
        productsHistory,
        productsHistoryLoading: false
      }));

      console.log(`✅ Histórico de produtos carregado no estado: ${productsHistory.length} registros`);
    } catch (error) {
      console.error('❌ Erro ao carregar histórico de produtos:', error);
      toast.error('Erro ao carregar histórico de produtos');
      
      setHistoricalData(prev => ({
        ...prev,
        productsHistory: [],
        productsHistoryLoading: false
      }));
    }
  }, [dateRange]);

  // Efeito para carregar dados iniciais apenas uma vez
  useEffect(() => {
    const fetchData = async () => {
      if (dataLoadedRef.current.initial) return;
      
      try {
        setIsUpdating(true);
        await Promise.all([
          fetchProfessionals(),
          fetchVales(),
          fetchPaymentMethods(),
        ]);
        dataLoadedRef.current.initial = true;
      } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
        toast.error('Erro ao carregar dados. Por favor, tente novamente.');
      } finally {
        setIsUpdating(false);
      }
    };

    fetchData();
  }, []); // Dependências vazias para executar apenas uma vez

  // Efeito para carregar dados históricos apenas quando necessário
  useEffect(() => {
    console.log('🔍 useEffect histórico executado:', { 
      activeTab, 
      historicalLoaded: dataLoadedRef.current.historical,
      shouldLoad: activeTab === 'historico' && !dataLoadedRef.current.historical
    });
    
    const fetchHistoricalDataIfNeeded = async () => {
      if (activeTab === 'historico' && !dataLoadedRef.current.historical) {
        console.log('📊 Carregando dados históricos pela primeira vez...');
        await fetchHistoricalData();
        dataLoadedRef.current.historical = true;
        console.log('✅ Dados históricos carregados e marcados como loaded');
      } else {
        console.log('⏭️ Não carregando dados históricos:', {
          activeTab,
          alreadyLoaded: dataLoadedRef.current.historical
        });
      }
    };

    fetchHistoricalDataIfNeeded();
  }, [activeTab, fetchHistoricalData]); // Adicionada dependência do fetchHistoricalData

  // Efeito para atualizar dados históricos quando o período muda
  useEffect(() => {
    console.log('📅 useEffect período histórico executado:', {
      activeTab,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      shouldUpdate: activeTab === 'historico' && dateRange.startDate && dateRange.endDate
    });
    
    if (activeTab === 'historico' && dateRange.startDate && dateRange.endDate) {
      console.log('🔄 Atualizando dados históricos devido a mudança de período...');
      fetchHistoricalData();
    } else {
      console.log('⏭️ Não atualizando dados históricos:', {
        activeTab,
        hasDateRange: !!(dateRange.startDate && dateRange.endDate)
      });
    }
  }, [dateRange.startDate, dateRange.endDate, activeTab, fetchHistoricalData]); // Adicionada dependência do fetchHistoricalData

  // Event listeners para atualização em tempo real
  useEffect(() => {
    // Handler para quando um atendimento é atualizado/finalizado
    const handleAppointmentUpdated = (event: CustomEvent) => {
      const { status, date, forceRefresh } = event.detail;
      
      console.log('Evento de atendimento atualizado recebido:', event.detail);
      
      // Se o atendimento foi finalizado e estamos visualizando o período que inclui essa data
      if (status === 'finalizado' || forceRefresh) {
        const appointmentDate = new Date(date);
        
        // Verificar se a data do atendimento está dentro do período selecionado
        if (dateRange.startDate && dateRange.endDate) {
          if (appointmentDate >= dateRange.startDate && appointmentDate <= dateRange.endDate) {
            console.log('Atendimento finalizado dentro do período selecionado, atualizando relatório');
            
            // Se for um único dia, usar refreshFinanceiro, senão usar fetchHistoricalData
            if (isSameDay(dateRange.startDate, dateRange.endDate)) {
              const formattedDate = format(appointmentDate, 'yyyy-MM-dd');
              refreshFinanceiro(formattedDate);
            } else {
              fetchHistoricalData();
            }
          }
        }
      }
    };

    // Handler para quando uma venda de produto é criada
    const handleProductSaleCreated = (event: CustomEvent) => {
      const { status, date } = event.detail;
      
      console.log('Evento de venda de produto criado recebido:', event.detail);
      
      // Se a venda foi completada e estamos visualizando o período que inclui essa data
      if (status === 'completed') {
        const saleDate = new Date(date);
        
        // Verificar se a data da venda está dentro do período selecionado
        if (dateRange.startDate && dateRange.endDate) {
          if (saleDate >= dateRange.startDate && saleDate <= dateRange.endDate) {
            console.log('Venda de produto criada dentro do período selecionado, atualizando relatório');
            
            // Se for um único dia, usar refreshFinanceiro, senão usar fetchHistoricalData
            if (isSameDay(dateRange.startDate, dateRange.endDate)) {
              const formattedDate = format(saleDate, 'yyyy-MM-dd');
              refreshFinanceiro(formattedDate);
            } else {
              fetchHistoricalData();
            }
          }
        }
      }
    };

    // Adicionar os event listeners
    window.addEventListener('appointmentUpdated', handleAppointmentUpdated as EventListener);
    window.addEventListener('productSaleCreated', handleProductSaleCreated as EventListener);

    // Cleanup
    return () => {
      window.removeEventListener('appointmentUpdated', handleAppointmentUpdated as EventListener);
      window.removeEventListener('productSaleCreated', handleProductSaleCreated as EventListener);
    };
  }, [dateRange, refreshFinanceiro, fetchHistoricalData]);

  // Função para buscar profissionais
  const fetchProfessionals = async () => {
    try {
      const { data, error } = await supabase
        .from('professionals')
        .select('*')
        .order('name');

      if (error) throw error;
      setProfessionals(data || []);
    } catch (error) {
      console.error('Erro ao buscar profissionais:', error);
      toast.error('Não foi possível carregar a lista de profissionais.');
    }
  };

  // Função para buscar vales
  const fetchVales = async () => {
    try {
      const { data, error } = await supabase
        .from("professional_advances")
        .select(`
          id,
          value,
          created_at,
          professional_id,
          discounted,
          closure_date,
          professionals (
            name
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      console.log('Dados dos vales obtidos:', data);
      
      // Converter os dados para o formato esperado pela interface EmployeeAdvance
      const formattedVales: EmployeeAdvance[] = (data || []).map(vale => {
        // Usar cast explícito para trabalhar com a resposta do Supabase
        type ProfessionalData = { name: string };
        const profData = vale.professionals as unknown as ProfessionalData;
        const professionalName = profData?.name || 'Profissional não especificado';
        
        return {
          id: vale.id,
          amount: vale.value,
          date: vale.created_at,
          professional_id: vale.professional_id,
          professional: {
            id: vale.professional_id || '',
            name: professionalName
          },
          discounted: vale.discounted || false,
          closure_date: vale.closure_date
        };
      });
      
      setVales(formattedVales);
    } catch (error) {
      console.error('Erro ao buscar vales:', error);
      toast.error('Não foi possível carregar os vales registrados.');
    }
  };

  // Função para buscar métodos de pagamento
  const fetchPaymentMethods = async () => {
    try {
      console.log('Buscando métodos de pagamento do Supabase...');
      
      // Primeiro, vou verificar a estrutura da tabela payment_methods
      const { data: tableInfo, error: tableError } = await supabase
        .from('payment_methods')
        .select('*')
        .limit(1);
        
      if (tableError) {
        console.error('Erro ao verificar estrutura da tabela payment_methods:', tableError);
      } else {
        console.log('Estrutura da tabela payment_methods:', tableInfo && tableInfo.length > 0 ? Object.keys(tableInfo[0]) : 'Tabela vazia');
      }
      
      const { data: paymentMethodsData, error } = await supabase
        .from('payment_methods')
        .select('id, name, fee')
        .order('name');

      if (error) {
        console.error('Erro na consulta de métodos de pagamento:', error);
        throw error;
      }
      
      console.log('Métodos de pagamento carregados com sucesso:', paymentMethodsData);
      console.log('Total de métodos encontrados:', paymentMethodsData?.length || 0);
      
      if (paymentMethodsData && paymentMethodsData.length > 0) {
        console.log('Exemplo do primeiro método:', paymentMethodsData[0]);
      } else {
        console.log('Nenhum método de pagamento encontrado na tabela');
      }
      
      setPaymentMethods(paymentMethodsData || []);
      return paymentMethodsData || [];
    } catch (error) {
      console.error('Erro ao buscar métodos de pagamento:', error);
      return [];
    }
  };

  // Função para validar e salvar um novo vale ou atualizar um existente
  const handleSaveVale = async () => {
    setIsUpdating(true);
    setFormErrors({});
    
    // Validar os campos
    const errors: Record<string, string> = {};
    
    if (!newVale.date) {
      errors.date = 'A data é obrigatória';
    }
    
    if (!newVale.professional_id) {
      errors.professional_id = 'Selecione um profissional';
    }
    
    // Validação mais robusta do valor
    let numericAmount = 0;
    if (!newVale.amount) {
      errors.amount = 'Informe um valor válido';
    } else {
      // Tentar converter para número, garantindo que seja um valor válido
      try {
        // Se o valor já for um número ou uma string numérica, converter diretamente
        numericAmount = Number(newVale.amount);
        
        // Se não for um número válido, tentar outras abordagens
        if (isNaN(numericAmount)) {
          // Tentar tratar como string formatada (remover R$, trocar , por ., etc)
          const cleanValue = newVale.amount
            .replace(/[R$\s]/g, '') // Remover R$ e espaços
            .replace(/\./g, '')     // Remover pontos (separadores de milhar)
            .replace(',', '.');     // Substituir vírgula por ponto
            
          numericAmount = Number(cleanValue);
        }
        
        // Verificar novamente se o valor é válido
        if (isNaN(numericAmount) || numericAmount <= 0) {
          errors.amount = 'Valor inválido';
        }
      } catch (e) {
        console.error('Erro ao converter valor:', e);
        errors.amount = 'Formato de valor inválido';
      }
    }
    
    console.log('Valor a ser salvo:', numericAmount);
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setIsUpdating(false);
      return;
    }
    
    try {
      if (isEditingVale && editingValeId) {
        // Atualizar vale existente
        const { error } = await supabase
          .from('professional_advances')
          .update({
            professional_id: newVale.professional_id,
            value: numericAmount,
            created_at: newVale.date,
          })
          .eq('id', editingValeId);
          
        if (error) throw error;
        toast.success('Vale atualizado com sucesso!');
      } else {
        // Criar novo vale
        const { error } = await supabase
          .from('professional_advances')
          .insert([{
            professional_id: newVale.professional_id,
            value: numericAmount,
            created_at: newVale.date,
          }]);
          
        if (error) throw error;
        toast.success('Vale registrado com sucesso!');
      }
      
      // Limpar formulário e fechar modal
      setNewVale({
        date: new Date().toISOString().split('T')[0],
        amount: '',
        professional_id: '',
      });
      setIsEditingVale(false);
      setEditingValeId(null);
      setShowNewValeModal(false);
      
      // Atualizar lista de vales
      await fetchVales();
    } catch (error) {
      console.error('Erro ao salvar vale:', error);
      toast.error(`Erro ao ${isEditingVale ? 'atualizar' : 'registrar'} o vale. Tente novamente.`);
    } finally {
      setIsUpdating(false);
    }
  };
  
  // Função para tratar o fechamento do modal de vales
  const handleCloseValeModal = () => {
    setNewVale({
      date: new Date().toISOString().split('T')[0],
      amount: '',
      professional_id: '',
    });
    setIsEditingVale(false);
    setEditingValeId(null);
    setFormErrors({});
    setShowNewValeModal(false);
  };
  
  // Função para editar um vale existente
  const handleEditVale = (vale: EmployeeAdvance) => {
    setIsEditingVale(true);
    setEditingValeId(vale.id);
    setNewVale({
      date: vale.date,
      amount: String(vale.amount),
      professional_id: vale.professional_id,
    });
    setShowNewValeModal(true);
  };
  
  // Função para deletar um vale (REMOVIDO - vales não podem mais ser excluídos)
  const handleDeleteVale = async (valeId: string) => {
    toast.error('Vales não podem ser excluídos. Eles são marcados como descontados durante o fechamento de caixa.');
  };
  
  // Função para lidar com a gestão de períodos
  const applyQuickPeriod = (days: number) => {
    if (days === 0) {
      // Hoje
      setDateRange({
        startDate: startOfDay(new Date()),
        endDate: endOfDay(new Date())
      });
    } else if (days === 7) {
      // Última semana
      setDateRange({
        startDate: startOfDay(subDays(new Date(), 6)),
        endDate: endOfDay(new Date())
      });
    } else if (days === 30) {
      // Último mês
      setDateRange({
        startDate: startOfDay(subDays(new Date(), 29)),
        endDate: endOfDay(new Date())
      });
    }
    setShowPeriodModal(false);
  };
  
  // Função para tratar métodos de pagamento
  const handleSavePaymentMethod = async () => {
    setIsUpdating(true);
    setFormErrors({});
    
    // Validar os campos
    const errors: Record<string, string> = {};
    
    if (!newPaymentMethod.name.trim()) {
      errors.name = 'O nome é obrigatório';
    }
    
    if (!newPaymentMethod.fee) {
      errors.fee = 'A taxa é obrigatória';
    } else {
      // Garantir conversão correta de vírgula para ponto
      const feeValue = parseFloat(newPaymentMethod.fee.toString().replace(/[^\d,.-]/g, '').replace(',', '.'));
      if (isNaN(feeValue) || feeValue < 0 || feeValue > 100) {
        errors.fee = 'Informe uma taxa válida (0-100%)';
      }
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setIsUpdating(false);
      return;
    }
    
    try {
      // Converter valor para número, garantindo formato decimal correto
      const feeValue = parseFloat(newPaymentMethod.fee.toString().replace(/[^\d,.-]/g, '').replace(',', '.'));
      
      if (isEditingPaymentMethod && editingPaymentMethodId) {
        // Atualizar método de pagamento existente
        const { error } = await supabase
          .from('payment_methods')
          .update({
            name: newPaymentMethod.name.trim(),
            fee: feeValue,
          })
          .eq('id', editingPaymentMethodId);
          
        if (error) throw error;
        toast.success('Método de pagamento atualizado com sucesso!');
      } else {
        // Criar novo método de pagamento
        const { error } = await supabase
          .from('payment_methods')
          .insert([{
            name: newPaymentMethod.name.trim(),
            fee: feeValue,
          }]);
          
        if (error) throw error;
        toast.success('Método de pagamento registrado com sucesso!');
      }
      
      // Limpar formulário e fechar modal
      setNewPaymentMethod({
        name: '',
        fee: '',
      });
      setIsEditingPaymentMethod(false);
      setEditingPaymentMethodId(null);
      setShowNewPaymentMethodModal(false);
      
      // Atualizar lista de métodos de pagamento
      await fetchPaymentMethods();
    } catch (error) {
      console.error('Erro ao salvar método de pagamento:', error);
      toast.error(`Erro ao ${isEditingPaymentMethod ? 'atualizar' : 'registrar'} o método de pagamento. Tente novamente.`);
    } finally {
      setIsUpdating(false);
    }
  };
  
  // Função para visualizar caixa de um profissional específico
  const handleProfessionalCashDetail = (professionalId: string | null) => {
    if (!professionalId) return;
    setSelectedProfessional(professionalId);
    // Qualquer lógica adicional necessária ao selecionar um profissional
  };
  
  // Função para fechar o modal de método de pagamento
  const handleClosePaymentMethodModal = () => {
    setNewPaymentMethod({
      name: '',
      fee: '',
    });
    setIsEditingPaymentMethod(false);
    setEditingPaymentMethodId(null);
    setFormErrors({});
    setShowNewPaymentMethodModal(false);
  };
  
  // Função para iniciar a edição de um método de pagamento
  const handleEditPaymentMethod = (paymentMethodId: string) => {
    // Encontrar o método de pagamento pelo ID
    const paymentMethod = paymentMethods.find(method => method.id === paymentMethodId);
    if (!paymentMethod) return;
    
    // Configurar o estado para edição
    setIsEditingPaymentMethod(true);
    setEditingPaymentMethodId(paymentMethodId);
    setNewPaymentMethod({
      name: paymentMethod.name,
      fee: String(paymentMethod.fee || '0'),
    });
    setShowNewPaymentMethodModal(true);
  };
  
  // Função para excluir um método de pagamento
  const handleDeletePaymentMethod = async (paymentMethodId: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este método de pagamento?')) {
      return;
    }
    
    setIsUpdating(true);
    
    try {
      const { error } = await supabase
        .from('payment_methods')
        .delete()
        .eq('id', paymentMethodId);
        
      if (error) throw error;
      
      toast.success('Método de pagamento excluído com sucesso!');
      await fetchPaymentMethods();
    } catch (error) {
      console.error('Erro ao excluir método de pagamento:', error);
      toast.error('Erro ao excluir método de pagamento. Tente novamente.');
    } finally {
      setIsUpdating(false);
    }
  };

  return {
    activeTab,
    activeHistoryTab,
    isUpdating,
    showMobileMenu,
    showNewValeModal,
    showNewPaymentMethodModal,
    showPeriodModal,
    isEditingPaymentMethod,
    editingPaymentMethodId,
    isEditingVale,
    editingValeId,
    vales,
    paymentMethods,
    professionals,
    selectedProfessional,
    formErrors,
    newVale,
    newPaymentMethod,
    dateRange,
    historicalData,
    handleSaveVale,
    handleCloseValeModal,
    handleEditVale,
    handleDeleteVale,
    applyQuickPeriod,
    handleSavePaymentMethod,
    setActiveHistoryTab,
    setDateRange,
    setShowPeriodModal,
    setShowMobileMenu,
    setShowNewValeModal,
    setShowNewPaymentMethodModal,
    fetchHistoricalData,
    handleProfessionalCashDetail,
    handleEditPaymentMethod,
    handleDeletePaymentMethod,
    handleClosePaymentMethodModal,
    setSelectedProfessional,
    setActiveTab,
    setNewVale,
    setNewPaymentMethod,
    fetchPaymentMethods,
    refreshFinanceiro,
    fetchAppointmentsHistory,
    fetchProductsHistory
  };
};

export default useFinanceiroData;