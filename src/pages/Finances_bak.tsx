import React, { useState, useEffect } from 'react';
import { 
  DollarSign, Save, Receipt, Calendar, User, CreditCard, Filter, ChevronDown, 
  FileText, Percent, CalendarRange, History, Info, AlertTriangle, CheckCircle, 
  XCircle, AlertCircle, ClipboardList, Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { NumericFormat } from 'react-number-format';
import '../styles/loader.css';
import DatePicker from 'react-datepicker';

interface Professional {
  id: string;
  name: string;
}

interface Service {
  id: string;
  name: string;
  price: number;
  commission: number;
}

interface Client {
  id: string;
  name: string;
}

interface AppointmentData {
  id: string;
  date: string;
  time: string;
  client_id: string;
  clients: {
    id: string;
    name: string;
  };
  total_value: number;
  payment_fee: number;
  payment_method: string;
  payment_method_id: string;
  payment_method_name: string;
  commission_rate: number;
  products: SoldProductRaw[];
  services: Array<{
    name: string;
  }>;
}

interface FormattedAppointment {
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

// Dados do vale de adiantamento
interface EmployeeAdvance {
  id: string;
  amount: number;
  date: string;
  cash_closing_id?: string | null;
}

interface ServiceInfo {
  id: string;
  name: string;
  price: number;
  commission: number;
}

interface PaymentMethod {
  id: string;
  name: string;
  fee: number;
}

interface Product {
      id: string;
      name: string;
  price: number;
  cost_price: number;
}

interface SoldProduct {
  id: string;
  price: number;
  quantity: number;
  name?: string;
  cost_price: number;
}

interface SoldProductRaw {
  id: string;
  price: number | string;
  quantity: number | string;
  name?: string;
  cost_price?: number;
}

interface Appointment {
  id: string | number;
  date: string;
  time: string;
  total_value: number;
  payment_method: string;
  payment_method_id: string | number;
  payment_method_name: string;
  products: SoldProductRaw[];
  professional: {
    id: string | number;
    name: string;
  };
  client: {
    id: string | number;
    name: string;
  };
}

interface ProductSale {
  id: string;
  name: string;
  quantity: number;
  price: number;
  cost_price: number;
  date: string;
  client?: {
    id: string;
    name: string;
  };
  source: 'appointment' | 'sale';
}

interface HistoricalData {
  advances: {
    id: string;
    amount: number;
    date: string;
    professional: {
      id: string;
      name: string;
    };
  }[];
  cashClosings: Appointment[];
  productSales: ProductSale[];
  totalAdvances: number;
  totalEarnings: number;
  totalCommissions: number;
  totalPaymentFees: number;
  totalProductProfit: number;
  loading: boolean;
}

interface CashClosing {
  id: string;
  professional_id: string;
  date: string;
  total_earnings: number;
  total_payment_fees: number;
  total_commissions: number;
  total_advances: number;
  net_income: number;
  period_start: string;
  period_end: string;
}

interface AppointmentResponse {
  id: string | number;
  date: string;
  time: string;
  total_value: number;
  payment_method: string;
  payment_method_id: string | number;
  payment_method_name: string;
  products: SoldProductRaw[];
  professional: {
    id: string | number;
    name: string;
  };
  client: {
    id: string | number;
    name: string;
  };
}

interface AppointmentService {
  id: string;
  service_id: string;
  payment_method_id: string;
  payment_method: PaymentMethod;
  services: {
    id: string;
    name: string;
    price: number;
    commission: number;
  };
}

interface AppointmentWithServices {
  id: string;
  date: string;
  time: string;
  total_value: number;
  status: string;
  cash_closing_id: string | null;
  professional_id: string;
  payment_method_name: string;
  services: any[];
  services_data: Record<string, { commission: number; price: number }> | null;
  products: Array<{ id: string; name: string; quantity: number; price: number }>;
  clients: Client;
  appointment_services: AppointmentService[];
}

type ViewType = 'caixa' | 'historico';

export default function Finances() {
  // Estados compartilhados
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  
  // Estados do formulário de vales
  const [selectedProfessional, setSelectedProfessional] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [vales, setVales] = useState<Array<{
    id: string;
    amount: number;
    date: string;
    professional: {
      id: string;
      name: string;
    };
  }>>([]);
  const [loadingVales, setLoadingVales] = useState(false);
  const [editingVale, setEditingVale] = useState<string | null>(null);

  // Estados para o caixa do profissional
  const [activeTab, setActiveTab] = useState('historico');
  const [cashSelectedProfessional, setCashSelectedProfessional] = useState('');
  const [cashStartDate, setCashStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [cashEndDate, setCashEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [appointments, setAppointments] = useState<FormattedAppointment[]>([]);
  const [employeeAdvances, setEmployeeAdvances] = useState<EmployeeAdvance[]>([]);
  const [loadingCash, setLoadingCash] = useState(false);
  const [cashMessage, setCashMessage] = useState({ type: '', text: '' });
  const [showClosedCashModal, setShowClosedCashModal] = useState(false);
  const [closedCashHistory, setClosedCashHistory] = useState<Array<{
    id: string;
    date: string;
    professional_id: string;
    total_earnings: number;
    total_payment_fees: number;
    total_commissions: number;
    total_advances: number;
    net_income: number;
    period_start: string;
    period_end: string;
    professional: {
      name: string;
    }
  }>>([]);
  const [loadingClosedCash, setLoadingClosedCash] = useState(false);
  
  // Estados para taxas de pagamento
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);
  const [newPaymentMethod, setNewPaymentMethod] = useState({ name: '', fee: '0' });
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<PaymentMethod | null>(null);
  const [savingPaymentMethod, setSavingPaymentMethod] = useState(false);
  const [paymentMethodMessage, setPaymentMethodMessage] = useState({ type: '', text: '' });

  // Novo estado para dados históricos
  const [historicalData, setHistoricalData] = useState<HistoricalData>({
    advances: [],
    cashClosings: [],
    productSales: [],
    totalAdvances: 0,
    totalEarnings: 0,
    totalCommissions: 0,
    totalPaymentFees: 0,
    totalProductProfit: 0,
    loading: false
  });

  // Adicionar novo estado para controlar os vales selecionados
  const [selectedAdvances, setSelectedAdvances] = useState<string[]>([]);

  // Adicionar novo estado para controlar a aba ativa do histórico
  const [activeHistoryTab, setActiveHistoryTab] = useState('resumo');

  // Adicionar novos estados para filtros
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const [historyProfessional, setHistoryProfessional] = useState('');
  const [historyClientSearch, setHistoryClientSearch] = useState('');
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);

  // Adicionar novo estado para datas fechadas
  const [closedDates, setClosedDates] = useState<string[]>([]);

  const [view, setView] = useState<ViewType>('caixa');

  useEffect(() => {
    fetchProfessionals();
    fetchVales();
  }, []);

  useEffect(() => {
    if (activeTab === 'taxas') {
      fetchPaymentMethods();
    } else if (activeTab === 'historico') {
      fetchHistoricalData();
    }
  }, [activeTab]);

  // Efeito para buscar datas fechadas quando mudar o profissional ou datas
  useEffect(() => {
    if (cashSelectedProfessional && cashStartDate && cashEndDate) {
      fetchClosedDates(cashSelectedProfessional, cashStartDate, cashEndDate);
    }
  }, [cashSelectedProfessional, cashStartDate, cashEndDate]);

  // Limpar mensagem de sucesso automaticamente
  useEffect(() => {
    if (message.type === 'success') {
      const timer = setTimeout(() => {
        setMessage({ type: '', text: '' });
      }, 3000); // 3 segundos

      return () => clearTimeout(timer);
    }
  }, [message]);

  // Limpar mensagem de caixa automaticamente
  useEffect(() => {
    if (cashMessage.type === 'success') {
      const timer = setTimeout(() => {
        setCashMessage({ type: '', text: '' });
      }, 3000); // 3 segundos

      return () => clearTimeout(timer);
    }
  }, [cashMessage]);

  useEffect(() => {
    if (!historicalData.cashClosings) return;

    let filtered = [...historicalData.cashClosings];

    // Filtrar por data
    if (historyStartDate) {
      filtered = filtered.filter(app => app.date >= historyStartDate);
    }
    if (historyEndDate) {
      filtered = filtered.filter(app => app.date <= historyEndDate);
    }

    // Filtrar por profissional
    if (historyProfessional) {
      filtered = filtered.filter(app => String(app.professional?.id) === historyProfessional);
    }

    // Filtrar por cliente
    if (historyClientSearch) {
      filtered = filtered.filter(app => 
        app.client?.name.toLowerCase().includes(historyClientSearch.toLowerCase())
      );
    }

    setFilteredAppointments(filtered);
  }, [historicalData.cashClosings, historyStartDate, historyEndDate, historyProfessional, historyClientSearch]);

  async function fetchProfessionals() {
    try {
      const { data, error } = await supabase
        .from('professionals')
        .select('id, name')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setProfessionals(data || []);
    } catch (error) {
      console.error('Erro ao buscar profissionais:', error);
    }
  }

  async function fetchVales() {
    setLoadingVales(true);
    try {
      const { data, error } = await supabase
        .from('employee_advances')
        .select(`
          id,
          amount,
          date,
          professional:professionals (
            id,
            name
          )
        `)
        .order('date', { ascending: false })
        .returns<{
          id: string;
          amount: number;
          date: string;
          professional: {
            id: string;
            name: string;
          };
        }[]>();

      if (error) throw error;
      setVales(data || []);
    } catch (error) {
      console.error('Erro ao buscar vales:', error);
    } finally {
      setLoadingVales(false);
    }
  }

  async function handleEditVale(valeId: string) {
    const vale = vales.find(v => v.id === valeId);
    if (vale) {
      setEditingVale(valeId);
      setSelectedProfessional(vale.professional.id);
      setAmount(vale.amount.toString().replace('.', ','));
      setDate(vale.date);
    }
  }

  async function handleDeleteVale(valeId: string) {
    if (!window.confirm('Tem certeza que deseja excluir este vale?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('employee_advances')
        .delete()
        .eq('id', valeId);

      if (error) throw error;
      
      setMessage({ type: 'success', text: 'Vale excluído com sucesso!' });
      fetchVales();
    } catch (error) {
      console.error('Erro ao excluir vale:', error);
      setMessage({ type: 'error', text: 'Erro ao excluir vale. Tente novamente.' });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const numericAmount = parseFloat(amount.replace(/[^\d,]/g, '').replace(',', '.'));
      
      if (editingVale) {
        // Atualizar vale existente
      const { error } = await supabase
        .from('employee_advances')
          .update({
            professional_id: selectedProfessional,
            amount: numericAmount,
            date: date,
          })
          .eq('id', editingVale);

      if (error) throw error;
        setMessage({ type: 'success', text: 'Vale atualizado com sucesso!' });
      } else {
        // Criar novo vale
        const { error } = await supabase
          .from('employee_advances')
          .insert([{
            professional_id: selectedProfessional,
            amount: numericAmount,
            date: date,
          }]);

        if (error) throw error;
      setMessage({ type: 'success', text: 'Vale registrado com sucesso!' });
      }

      setSelectedProfessional('');
      setAmount('');
      setDate(format(new Date(), 'yyyy-MM-dd'));
      setEditingVale(null);
      fetchVales();
    } catch (error) {
      console.error('Erro ao salvar vale:', error);
      setMessage({ type: 'error', text: `Erro ao ${editingVale ? 'atualizar' : 'registrar'} o vale. Tente novamente.` });
    } finally {
      setSaving(false);
    }
  }

  async function fetchCashDetails() {
    try {
      setLoadingCash(true);
      setCashMessage({ type: '', text: '' });

      if (!cashSelectedProfessional || !cashStartDate || !cashEndDate) {
        setCashMessage({ type: 'error', text: 'Selecione um profissional e um período' });
        setLoadingCash(false);
        return;
      }

      // Buscar os atendimentos do profissional selecionado
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments_with_payment_method')
        .select(`
          id,
          date,
          time,
          total_value,
          status,
          cash_closing_id,
          professional_id,
          payment_method_id,
          payment_method_name,
          services,
          services_data,
          products,
          clients (
            id,
            name
          ),
          appointment_services (
            id,
            service_id,
            payment_method_id,
            payment_method:payment_methods (
              id,
              name,
              fee
            ),
            services (
              id,
              name,
              price,
              commission
            )
          )
        `)
        .eq('professional_id', cashSelectedProfessional)
        .gte('date', cashStartDate)
        .lte('date', cashEndDate)
        .in('status', ['realizado', 'finalizado', 'concluído'])
        .order('date', { ascending: true });

      if (appointmentsError) {
        console.error('Erro na consulta de atendimentos:', appointmentsError);
        setCashMessage({ type: 'error', text: 'Erro ao buscar atendimentos' });
        setLoadingCash(false);
        return;
      }

      // Se não houver atendimentos, mostrar mensagem e limpar os dados
      if (!appointmentsData || appointmentsData.length === 0) {
        setAppointments([]);
        setEmployeeAdvances([]);
        setCashMessage({ type: 'info', text: 'Nenhum atendimento encontrado para o período selecionado' });
        setLoadingCash(false);
        return;
      }

      console.log('Total de atendimentos encontrados:', appointmentsData.length);
      
      // Filtrar atendimentos que não passaram por fechamento de caixa
      const filteredAppointments = appointmentsData.filter(
        appointment => appointment.cash_closing_id === null
      );
      
      console.log('Atendimentos pendentes de fechamento:', filteredAppointments.length);
      
      // Se todos os atendimentos do período já tiverem sido fechados
      if (filteredAppointments.length === 0) {
        setAppointments([]);
        setEmployeeAdvances([]);
        setCashMessage({ 
          type: 'info', 
          text: 'Todos os atendimentos deste período já foram processados no fechamento de caixa. Verifique o histórico de caixas fechados.' 
        });
        setLoadingCash(false);
        return;
      }

      // Se existem alguns atendimentos que já foram processados e outros não
      const processedAppointments = appointmentsData.filter(
        appointment => appointment.cash_closing_id !== null
      );
      
      if (processedAppointments.length > 0) {
        setCashMessage({
          type: 'warning',
          text: `Atenção: ${processedAppointments.length} atendimento(s) deste período já foram processados anteriormente e não aparecem na lista abaixo. Apenas os ${filteredAppointments.length} atendimento(s) pendentes são exibidos.`
        });
      }

      // Buscar os métodos de pagamento para obter as taxas
      const { data: paymentMethodsData, error: paymentMethodsError } = await supabase
        .from('payment_methods')
        .select('*');

      if (paymentMethodsError) {
        console.error('Erro ao buscar métodos de pagamento:', paymentMethodsError);
        setCashMessage({ type: 'error', text: 'Erro ao buscar métodos de pagamento' });
        setLoadingCash(false);
        return;
      }

      // Antes de processar atendimentos, carregar todos os serviços do banco para referência
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select('*');

      if (servicesError) {
        console.error('Erro ao buscar serviços:', servicesError);
        // Não vamos interromper o fluxo, apenas registrar o erro
      }

      // Processar os atendimentos
      const formattedAppointments = [];
      let hasProcessingErrors = false;
      
      for (const appointment of filteredAppointments as unknown as AppointmentWithServices[]) {
        try {
          // Obter o método de pagamento do primeiro serviço
          const firstService = appointment.appointment_services?.[0];
          const paymentMethod = firstService?.payment_method;

          // Obter a taxa de pagamento
          let actualPaymentFee = 0;
          let paymentFeePercent = 0;
          
          if (paymentMethod) {
            actualPaymentFee = Number(paymentMethod.fee) / 100;
            paymentFeePercent = Number(paymentMethod.fee);
          }

          // Processar os serviços - primeiro tentar services_data (customizados), depois appointment_services
          let services: Array<{name: string, commission: number, price: number}> = [];
          let totalServicesValue = 0;
          
          if (appointment.services_data && typeof appointment.services_data === 'object') {
            // Usar serviços customizados do encerramento do atendimento
            services = Object.entries(appointment.services_data).map(([name, data]: [string, any]) => ({
              name: name,
              commission: data.commission || 0,
              price: data.price || 0
            }));
            // Calcular valor total dos serviços
            totalServicesValue = services.reduce((sum, service) => sum + service.price, 0);
          } else if (appointment.appointment_services && Array.isArray(appointment.appointment_services)) {
            // Usar serviços da tabela de relacionamento appointment_services
            services = appointment.appointment_services.map((as: any) => ({
              name: as.services?.name || 'Serviço não encontrado',
              commission: as.services?.commission || 0,
              price: as.services?.price || 0
            }));
            // Calcular valor total dos serviços
            totalServicesValue = services.reduce((sum, service) => sum + service.price, 0);
          }

          // Calcular a comissão média baseada apenas nos serviços
          const averageCommissionRate = services.length > 0 
            ? services.reduce((sum: number, service: { commission: number }) => sum + service.commission, 0) / services.length 
            : 0;

          // Processar produtos separadamente (mantemos o processamento mas não incluímos no valor total)
          let products: Array<{id: string, name: string, quantity: number, price: number}> = [];
          
          if (appointment.products && Array.isArray(appointment.products)) {
            products = appointment.products.map((p: any) => ({
              id: p.id || 'produto-' + Math.random().toString(36).substring(2, 9),
              name: p.name || 'Produto não identificado',
              quantity: p.quantity || 1,
              price: p.price || 0
            }));
          }

          // Obter o cliente
          let clientId = '';
          let clientName = 'Cliente não identificado';
          
          try {
            if (appointment.clients) {
              clientId = appointment.clients.id || '';
              clientName = appointment.clients.name || 'Cliente não identificado';
            }
          } catch (clientErr) {
            console.error('Erro ao processar dados do cliente:', clientErr);
            hasProcessingErrors = true;
          }

          formattedAppointments.push({
            id: appointment.id,
            date: appointment.date,
            time: appointment.time || '00:00',
            client: {
              id: clientId,
              name: clientName
            },
            services: services,
            service_names: services.map((s: { name: string }) => s.name),
            total_value: totalServicesValue,
            payment_method: appointment.payment_method_name || 'Não especificado',
            payment_fee: actualPaymentFee,
            payment_fee_percent: paymentFeePercent,
            commission_rate: averageCommissionRate,
            products: products,
            cash_closing_id: appointment.cash_closing_id
          });
        } catch (err) {
          console.error('Erro ao processar atendimento:', err, appointment);
          hasProcessingErrors = true;
        }
      }

      if (formattedAppointments.length === 0) {
        setCashMessage({ type: 'info', text: 'Nenhum atendimento válido encontrado para fechamento no período selecionado' });
        setLoadingCash(false);
        return;
      }

      if (hasProcessingErrors) {
        setCashMessage(prev => {
          // Adicionar aviso sobre erros de processamento, preservando mensagens anteriores
          const text = prev.text 
            ? `${prev.text}. Alguns atendimentos podem ter informações incompletas` 
            : 'Alguns atendimentos podem ter informações incompletas';
          return { ...prev, text, type: 'warning' };
        });
      }

      console.log('Atendimentos formatados para fechamento:', formattedAppointments.length);
      
      // Atualizar o estado com os dados formatados
      setAppointments(formattedAppointments);
      
      // Buscar vales do período
      const { data: advancesData, error: advancesError } = await supabase
        .from('employee_advances')
        .select('id, amount, date, cash_closing_id')
        .eq('professional_id', cashSelectedProfessional)
        .gte('date', cashStartDate)
        .lte('date', cashEndDate)
        .is('cash_closing_id', null)
        .order('date', { ascending: true });

      if (advancesError) {
        console.error('Erro ao buscar vales:', advancesError);
        setCashMessage(prev => ({
          type: 'warning',
          text: prev.text ? `${prev.text}. Erro ao buscar vales` : 'Erro ao buscar vales'
        }));
      }

      console.log('Vales não processados encontrados:', advancesData?.length || 0);
      
      setEmployeeAdvances(advancesData || []);
      setLoadingCash(false);

    } catch (error) {
      console.error('Erro ao buscar detalhes do caixa:', error);
      setCashMessage({ type: 'error', text: 'Erro ao buscar detalhes do caixa. Por favor, tente novamente.' });
      setAppointments([]);
      setEmployeeAdvances([]);
      setLoadingCash(false);
    }
  }

  // Função para calcular a comissão
  const calcularComissao = (valor: number, taxa: number) => {
    // A taxa é a comissão do profissional
    return valor * (taxa / 100);
  };

  // Calcular o valor total das comissões do profissional
  const calcularTotalComissoes = () => {
    return appointments.reduce((total, appointment) => {
      const comissao = calcularComissao(appointment.total_value, appointment.commission_rate || 0);
      return total + comissao;
    }, 0);
  };

  // Calcular a média ponderada das comissões do profissional
  const calcularMediaComissoes = () => {
    if (!appointments.length) return 0;
    
    const totalValor = appointments.reduce((sum, appointment) => sum + appointment.total_value, 0);
    const totalComissao = calcularTotalComissoes();
    
    return totalValor > 0 ? (totalComissao / totalValor) * 100 : 0;
  };

  // Calcular totais
  const totalEarnings = appointments
    .filter(app => !closedDates.includes(app.date))
    .reduce((sum, appointment) => sum + appointment.total_value, 0);

  const totalPaymentFees = appointments
    .filter(app => !closedDates.includes(app.date))
    .reduce((sum, appointment) => sum + (appointment.total_value * (appointment.payment_fee_percent / 100)), 0);

  // Valor após taxas de pagamento
  const totalAfterPaymentFees = totalEarnings - totalPaymentFees;

  // Parte que fica com o salão (100% - taxa de comissão do profissional)
  const totalSalonShare = appointments
    .filter(app => !closedDates.includes(app.date))
    .reduce((sum, appointment) => {
      const afterFees = appointment.total_value - (appointment.total_value * (appointment.payment_fee_percent / 100));
      const salonShare = afterFees * ((100 - (appointment.commission_rate || 0)) / 100);
      return sum + salonShare;
    }, 0);

  // Parte que fica com o profissional
  const totalProfessionalShare = totalAfterPaymentFees - totalSalonShare;

  const totalAdvances = employeeAdvances
    .filter(advance => selectedAdvances.includes(advance.id))
    .reduce((sum, advance) => sum + advance.amount, 0);

  // Valor líquido do profissional (após descontar vales)
  const netIncome = totalProfessionalShare - totalAdvances;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(value);
  };

  // Funções para gerenciar taxas de pagamento
  async function fetchPaymentMethods() {
    setLoadingPaymentMethods(true);
    setPaymentMethodMessage({ type: '', text: '' });

    try {
      // Verificar si la tabla existe primero
      const { error: tableCheckError } = await supabase
        .from('payment_methods')
        .select('*', { count: 'exact', head: true });
      
      if (tableCheckError && tableCheckError.code === '42P01') {
        // La tabla no existe, mostrar un mensaje informativo
        console.info('La tabla payment_methods no existe todavía. Necesita ejecutar la migración SQL.');
        setPaymentMethodMessage({ 
          type: 'info', 
          text: 'É necessário configurar a tabela de métodos de pagamento. Por favor, contate o administrador do sistema.' 
        });
        setPaymentMethods([
          // Valores predeterminados mientras la tabla no exista
          { id: 'default-1', name: 'Dinheiro', fee: 0 },
          { id: 'default-2', name: 'Pix', fee: 0 },
          { id: 'default-3', name: 'Cartão de Crédito', fee: 3 },
          { id: 'default-4', name: 'Cartão de Débito', fee: 2 }
        ]);
        setLoadingPaymentMethods(false);
        return;
      }

      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .order('name');

      if (error) throw error;
      setPaymentMethods(data || []);
    } catch (error) {
      console.error('Erro ao buscar métodos de pagamento:', error);
      setPaymentMethodMessage({ type: 'error', text: 'Erro ao carregar métodos de pagamento.' });
    } finally {
      setLoadingPaymentMethods(false);
    }
  }

  async function handlePaymentMethodSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavingPaymentMethod(true);
    setPaymentMethodMessage({ type: '', text: '' });

    try {
      const numericFee = parseFloat(newPaymentMethod.fee.replace(/[^\d,]/g, '').replace(',', '.'));
      
      if (editingPaymentMethod) {
        // Atualizar método existente
        const { error } = await supabase
          .from('payment_methods')
          .update({
            name: newPaymentMethod.name,
            fee: numericFee
          })
          .eq('id', editingPaymentMethod.id);

        if (error) throw error;
        setPaymentMethodMessage({ type: 'success', text: 'Método de pagamento atualizado com sucesso!' });
      } else {
        // Criar novo método
        const { error } = await supabase
          .from('payment_methods')
          .insert([{
            name: newPaymentMethod.name,
            fee: numericFee
          }]);

        if (error) throw error;
        setPaymentMethodMessage({ type: 'success', text: 'Método de pagamento criado com sucesso!' });
      }

      // Resetar o formulário e atualizar a lista
      setNewPaymentMethod({ name: '', fee: '0' });
      setEditingPaymentMethod(null);
      fetchPaymentMethods();
    } catch (error) {
      console.error('Erro ao salvar método de pagamento:', error);
      setPaymentMethodMessage({ type: 'error', text: 'Erro ao salvar método de pagamento. Tente novamente.' });
    } finally {
      setSavingPaymentMethod(false);
    }
  }

  function handleEditPaymentMethod(method: PaymentMethod) {
    setEditingPaymentMethod(method);
    setNewPaymentMethod({
      name: method.name,
      fee: method.fee.toString()
    });
  }

  async function handleDeletePaymentMethod(id: string) {
    if (!window.confirm('Tem certeza que deseja excluir este método de pagamento?')) {
      return;
    }

    setPaymentMethodMessage({ type: '', text: '' });

    try {
      const { error } = await supabase
        .from('payment_methods')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setPaymentMethodMessage({ type: 'success', text: 'Método de pagamento excluído com sucesso!' });
      fetchPaymentMethods();
    } catch (error) {
      console.error('Erro ao excluir método de pagamento:', error);
      setPaymentMethodMessage({ type: 'error', text: 'Erro ao excluir método de pagamento. Tente novamente.' });
    }
  }

  // Função para buscar dados históricos
  async function fetchHistoricalData() {
    setHistoricalData(prev => ({ ...prev, loading: true }));
    
    try {
      // Buscar histórico de vales
      const { data: advancesData, error: advancesError } = await supabase
        .from('employee_advances')
        .select(`
          id,
          amount,
          date,
          professional:professionals (
            id,
            name
          )
        `)
        .order('date', { ascending: false })
        .returns<{
          id: string;
          amount: number;
          date: string;
          professional: {
            id: string;
            name: string;
          };
        }[]>();

      if (advancesError) throw advancesError;

      // Buscar histórico de atendimentos com produtos
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments_with_payment_method')
        .select(`
          id,
          date,
          time,
          total_value,
          payment_method,
          payment_method_id,
          payment_method_name,
          commission_rate,
          products,
          professional:professionals (
            id,
            name
          ),
          client:clients (
            id,
            name
          )
        `)
        .eq('status', 'realizado')
        .order('date', { ascending: false });

      if (appointmentsError) throw appointmentsError;

      // Processar os dados para garantir o formato correto
      const processedAppointments = (appointmentsData as any[])?.map(appointment => ({
        id: appointment.id,
        date: appointment.date,
        time: appointment.time,
        total_value: Number(appointment.total_value || 0),
        payment_method: appointment.payment_method || 'Não especificado',
        payment_method_id: appointment.payment_method_id,
        payment_method_name: appointment.payment_method_name || 'Não especificado',
        commission_rate: Number(appointment.commission_rate || 0),
        products: appointment.products || [],
        professional: {
          id: Number(appointment.professional?.id || 0),
          name: appointment.professional?.name || ''
        },
        client: {
          id: Number(appointment.client?.id || 0),
          name: appointment.client?.name || ''
        }
      }));

      // Buscar vendas diretas de produtos
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          id,
          date,
          total,
          fee,
          products,
          client:clients (
            id,
            name
          )
        `)
        .order('date', { ascending: false });

      if (salesError) throw salesError;

      // Buscar todos os produtos para calcular o lucro
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, price, cost_price')
        .returns<Product[]>();

      if (productsError) throw productsError;

      // Criar um mapa de produtos para fácil acesso
      const productsMap = new Map(
        productsData?.map(product => [product.id, product]) || []
      );

      // Calcular lucro sobre produtos e atualizar os dados dos produtos vendidos
      let totalProductProfit = 0;

      // Processar produtos vendidos em atendimentos
      const updatedAppointments = processedAppointments?.map(appointment => {
        if (appointment.products && Array.isArray(appointment.products)) {
          const updatedProducts = appointment.products.map((soldProduct: SoldProductRaw): SoldProduct => {
            const product = productsMap.get(soldProduct.id);
            if (product) {
              // Garantir que os valores sejam números e preservar o preço unitário
              const price = Number(soldProduct.price) || product.price || 0;
              const quantity = Number(soldProduct.quantity) || 0;
              const costPrice = Number(product.cost_price) || 0;
              const profit = (price - costPrice) * quantity;
              totalProductProfit += profit;

              return {
                id: soldProduct.id,
                name: product.name,
                price: price,
                quantity: quantity,
                cost_price: costPrice
              };
            }
            return {
              id: soldProduct.id,
              name: soldProduct.name || 'Produto não encontrado',
              price: Number(soldProduct.price) || 0,
              quantity: Number(soldProduct.quantity) || 0,
              cost_price: 0
            };
          });
          return { ...appointment, products: updatedProducts };
        }
        return appointment;
      });

      // Processar vendas diretas de produtos
      const updatedSales = salesData?.map(sale => {
        if (sale.products && Array.isArray(sale.products)) {
          const updatedProducts = sale.products.map((soldProduct: SoldProductRaw): SoldProduct => {
            const product = productsMap.get(soldProduct.id);
            if (product) {
              // Garantir que os valores sejam números e preservar o preço unitário
              const price = Number(soldProduct.price) || product.price || 0;
              const quantity = Number(soldProduct.quantity) || 0;
              const costPrice = Number(product.cost_price) || 0;
              const profit = (price - costPrice) * quantity;
              totalProductProfit += profit;

              return {
                id: soldProduct.id,
                name: product.name,
                price: price,
                quantity: quantity,
                cost_price: costPrice
              };
            }
            return {
              id: soldProduct.id,
              name: soldProduct.name || 'Produto não encontrado',
              price: Number(soldProduct.price) || 0,
              quantity: Number(soldProduct.quantity) || 0,
              cost_price: 0
            };
          });
          return { ...sale, products: updatedProducts };
        }
        return sale;
      });

      // Combinar produtos vendidos de ambas as fontes para a exibição
      const allProductSales = [
        ...(updatedAppointments?.flatMap(app => 
          (app.products || []).map((product: SoldProductRaw) => ({
            ...product,
            date: app.date,
            client: app.client,
            source: 'appointment' as const
          }))
        ) || []),
        ...(updatedSales?.flatMap(sale => 
          (sale.products || []).map((product: SoldProductRaw) => ({
            ...product,
            date: sale.date,
            client: sale.client,
            source: 'sale' as const
          }))
        ) || [])
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Calcular totais
      const totalAdvances = advancesData?.reduce((sum, advance) => sum + Number(advance.amount), 0) || 0;
      const totalEarnings = (
        (processedAppointments?.reduce((sum, app) => sum + Number(app.total_value || 0), 0) || 0) +
        (salesData?.reduce((sum, sale) => sum + Number(sale.total || 0), 0) || 0)
      );
      const totalCommissions = processedAppointments?.reduce((sum, app) => sum + (Number(app.total_value || 0) * 0.3), 0) || 0;
      const totalPaymentFees = (
        (processedAppointments?.reduce((sum, app) => sum + (Number(app.total_value || 0) * 0.03), 0) || 0) +
        (salesData?.reduce((sum, sale) => sum + Number(sale.fee || 0), 0) || 0)
      );

      setHistoricalData({
        advances: advancesData || [],
        cashClosings: updatedAppointments || [],
        productSales: allProductSales,
        totalAdvances,
        totalEarnings,
        totalCommissions,
        totalPaymentFees,
        totalProductProfit,
        loading: false
      });
    } catch (error) {
      console.error('Erro ao buscar dados históricos:', error);
      setHistoricalData(prev => ({ ...prev, loading: false }));
    }
  }

  async function deleteProcessedAdvances(advances: EmployeeAdvance[]) {
    try {
      const advanceIds = advances.map(advance => advance.id);
      const { error } = await supabase
        .from('employee_advances')
        .delete()
        .in('id', advanceIds);

      if (error) throw error;
      
      // Atualizar a lista de vales após a exclusão
      fetchVales();
      
    } catch (error) {
      console.error('Erro ao excluir vales processados:', error);
    }
  }

  async function markAdvancesAsProcessed(advances: EmployeeAdvance[], cashClosingId: string) {
    try {
      const advanceIds = advances.map(advance => advance.id);
      const { error } = await supabase
        .from('employee_advances')
        .update({ cash_closing_id: cashClosingId })
        .in('id', advanceIds);

      if (error) throw error;
      
      // Atualizar o estado local dos vales
      setEmployeeAdvances(prevAdvances => 
        prevAdvances.map(advance => 
          advanceIds.includes(advance.id)
            ? { ...advance, cash_closing_id: cashClosingId }
            : advance
        )
      );
      
      // Atualizar a lista de vales após a atualização
      fetchVales();
      
    } catch (error) {
      console.error('Erro ao marcar vales como processados:', error);
    }
  }

  async function handleCloseCash() {
    try {
      if (!window.confirm('Tem certeza que deseja fechar o caixa para este período?')) {
        return;
      }

      setLoadingCash(true);

      // Validar se há atendimentos selecionados
      if (appointments.length === 0) {
        setCashMessage({ type: 'error', text: 'Não há atendimentos para fechar o caixa' });
        setLoadingCash(false);
        return;
      }

      // Calcular valores totais
      const totalEarningValue = appointments
        .filter(app => !closedDates.includes(app.date))
        .reduce((sum, app) => sum + app.total_value, 0);

      const totalPaymentFeesValue = appointments
        .filter(app => !closedDates.includes(app.date))
        .reduce((sum, app) => sum + (app.total_value * (app.payment_fee_percent / 100)), 0);

      // Valor após taxas de pagamento
      const totalAfterFeesValue = totalEarningValue - totalPaymentFeesValue;

      // Parte que fica com o salão
      const totalSalonShareValue = appointments
        .filter(app => !closedDates.includes(app.date))
        .reduce((sum, app) => {
          const afterFees = app.total_value - (app.total_value * (app.payment_fee_percent / 100));
          const salonShare = afterFees * ((100 - (app.commission_rate || 0)) / 100);
          return sum + salonShare;
        }, 0);

      // Parte que fica com o profissional
      const totalProfessionalShareValue = totalAfterFeesValue - totalSalonShareValue;

      const totalAdvancesValue = employeeAdvances
        .filter(adv => selectedAdvances.includes(adv.id))
        .reduce((sum, adv) => sum + adv.amount, 0);

      const netIncomeValue = totalProfessionalShareValue - totalAdvancesValue;

      // Criar registro de fechamento de caixa
      const { data: cashClosing, error: cashClosingError } = await supabase
        .from('cash_closings')
        .insert({
          professional_id: cashSelectedProfessional,
          date: format(new Date(), 'yyyy-MM-dd'),
          total_earnings: totalEarningValue,
          total_payment_fees: totalPaymentFeesValue,
          total_commissions: totalSalonShareValue,
          total_advances: totalAdvancesValue,
          net_income: netIncomeValue,
          period_start: cashStartDate,
          period_end: cashEndDate
        })
        .select()
        .single();

      if (cashClosingError) {
        console.error('Erro ao criar fechamento de caixa:', cashClosingError);
        setCashMessage({ type: 'error', text: 'Erro ao fechar o caixa' });
        setLoadingCash(false);
        return;
      }

      // Atualizar os atendimentos com o ID do fechamento de caixa
      const appointmentIds = appointments
        .filter(app => !closedDates.includes(app.date))
        .map(app => app.id);

      const { error: updateError } = await supabase
        .from('appointments')
        .update({ cash_closing_id: cashClosing.id })
        .in('id', appointmentIds);

      if (updateError) {
        console.error('Erro ao atualizar atendimentos:', updateError);
        setCashMessage({ type: 'error', text: 'Erro ao atualizar atendimentos' });
        setLoadingCash(false);
        return;
      }

      // Atualizar o estado local dos atendimentos
      setAppointments(prevAppointments => 
        prevAppointments.map(app => 
          appointmentIds.includes(app.id) 
            ? { ...app, cash_closing_id: cashClosing.id }
            : app
        )
      );

      // Excluir vales selecionados, se houverem
      if (selectedAdvances.length > 0) {
        await markAdvancesAsProcessed(
          employeeAdvances.filter(adv => selectedAdvances.includes(adv.id)),
          cashClosing.id
        );
      }

      setCashMessage({ type: 'success', text: 'Caixa fechado com sucesso!' });
      
      // Atualizar dados
      fetchCashDetails();
      fetchVales();

      // Atualizar o histórico de fechamentos de caixa
      fetchClosedCashHistory(cashSelectedProfessional);
    } catch (error) {
      console.error('Erro ao fechar caixa:', error);
      setCashMessage({ type: 'error', text: 'Erro ao fechar o caixa' });
      setLoadingCash(false);
    }
  }

  async function fetchClosedCashHistory(professionalId: string) {
    setLoadingClosedCash(true);
    console.log('Buscando historial de caixas para profissional:', professionalId);
    
    try {
      // Simplificar la consulta para diagnosticar problemas
      const { data, error } = await supabase
        .from('cash_closings')
        .select('*')
        .eq('professional_id', professionalId)
        .order('date', { ascending: false });

      if (error) {
        console.error('Erro detalhado ao buscar histórico:', error);
        throw error;
      }

      console.log('Dados recebidos do histórico:', data);

      // Processar os dados de forma mais simples
      const processedData = (data || []).map(item => ({
        id: item.id,
        date: item.date,
        professional_id: item.professional_id,
        total_earnings: Number(item.total_earnings) || 0,
        total_payment_fees: Number(item.total_payment_fees) || 0,
        total_commissions: Number(item.total_commissions) || 0,
        total_advances: Number(item.total_advances) || 0,
        net_income: Number(item.net_income) || 0,
        period_start: item.period_start,
        period_end: item.period_end,
        professional: {
          name: 'Profissional' // Placeholder que será atualizado depois
        }
      }));

      setClosedCashHistory(processedData);
      
      // Se precisarmos dos nomes dos profissionais, podemos buscá-los separadamente
      if (processedData.length > 0) {
        const { data: profData } = await supabase
          .from('professionals')
          .select('id, name')
          .eq('id', professionalId)
          .single();
          
        if (profData) {
          const updatedData = processedData.map(item => ({
            ...item,
            professional: {
              name: profData.name
            }
          }));
          setClosedCashHistory(updatedData);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar histórico de caixa:', error);
    } finally {
      setLoadingClosedCash(false);
    }
  }

  // Função para verificar datas já fechadas
  async function fetchClosedDates(professionalId: string, startDate: string, endDate: string) {
    try {
      const { data, error } = await supabase
        .from('cash_closings')
        .select('period_start, period_end')
        .eq('professional_id', professionalId)
        .gte('period_start', startDate)
        .lte('period_end', endDate);

      if (error) throw error;

      // Criar array com todas as datas fechadas
      const allClosedDates = data?.flatMap(period => {
        const dates = [];
        let currentDate = new Date(period.period_start);
        const endDate = new Date(period.period_end);
        while (currentDate <= endDate) {
          dates.push(format(currentDate, 'yyyy-MM-dd'));
          currentDate.setDate(currentDate.getDate() + 1);
        }
        return dates;
      }) || [];

      setClosedDates(allClosedDates);
    } catch (error) {
      console.error('Erro ao buscar datas fechadas:', error);
    }
  }

  return (
    <div className="finances-container">
      {/* ... existing code ... */}
      
      {view === 'caixa' && (
        <div className="cash-view">
          {/* Conteúdo da view de caixa */}
        </div>
      )}
      
      {view === 'historico' && (
        <div className="history-view">
          {/* Conteúdo da view de histórico */}
        </div>
      )}
    </div>
  );
}