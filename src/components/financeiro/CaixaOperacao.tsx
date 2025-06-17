import React, { useState, useCallback, useEffect } from 'react';
import { 
  DollarSign, 
  User, 
  Calendar, 
  Filter, 
  X, 
  History, 
  ArrowLeft, 
  CalendarRange, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  ChevronUp,  
  Save, 
  Printer, 
  Search, 
  Check, 
  AlertCircle
} from 'lucide-react';
import { Professional } from '../../hooks/useFinanceiroData';
import { formatCurrency } from '../../lib/financeiroUtils';
import { supabase } from '../../lib/supabaseClient';
import { format, parseISO, addDays, subDays, differenceInDays, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Modal from '../shared/Modal';
import { safeUuidEq } from '../../lib/supabaseClient';
import DatePicker, { registerLocale } from 'react-datepicker';

// Registrar localização para o DatePicker
registerLocale('pt-BR', ptBR);

interface CaixaOperacaoProps {
  professionals: Professional[];
  isUpdating: boolean;
  handleProfessionalCashDetail: (professionalId: string) => void;
}

// Interface para os fechamentos
interface Fechamento {
  id: string;
  professional_id: string;
  professional_name?: string;
  start_date?: string;
  end_date?: string;
  closure_date: string;
  quantidade_servicos: number;
  service_names?: string;
  gross_service_value: number;
  payment_fee: number;
  commission_amount: number;
  net_service_value: number;
  client_names?: string[];
  servicos_detalhes?: ServicoDetalhe[];
  total_commission?: number;
  vales_descontados?: string[];
  total_vales_descontados?: number;
  valor_final_liquido?: number;
  // Novos campos para vales
  vales_detalhes?: ValeDescontado[];
}

// Interface para o modal
interface HistoricoModalProps {
  isOpen: boolean;
  onClose: () => void;
  fechamentos: Fechamento[];
  profissionalNome: string;
  limparHistorico: () => Promise<boolean>;
}

// Interface para detalhes dos serviços dentro do fechamento
interface ServicoDetalhe {
  id: string;
  service_name: string;
  net_service_value: number;
  client_name?: string;
  gross_service_value?: number;
  payment_fee?: number;
}

// Interface para vales descontados
interface ValeDescontado {
  id: string;
  value: number;
  created_at: string;
  closure_date: string;
}

// Interface para representar um atendimento (compatibilidade)
interface Atendimento {
  id: string;
  client_name?: string;
  service_name?: string;
  created_at: string;
  total_value: number;
  commission_value: number;
}

// Interface para representar um fechamento de caixa individual de um profissional
interface ProfessionalClosure {
  id: string;
  professional_id: string;
  appointment_service_id?: string;
  appointment_service?: AppointmentService;
  gross_service_value: number;
  discounted_service_value: number;
  payment_fee_value: number;
  payment_fee: number; // Alias para payment_fee_value
  commission_percentage: number;
  commission_value: number;
  commission_amount: number; // Alias para commission_value
  net_service_value: number;
  created_at: string;
  service_names?: string;
  client_name?: string;
  appointment_id?: string;
  closed?: boolean;
}

// Interface para dados brutos do Supabase (para substituir any)
interface SupabaseRawService {
  id: string;
  appointment_id: string;
  service_id: string;
  created_at: string;
  custom_price: number | null;
  payment_method_id: string | null;
  payment_fee: number | null;
  commission_rate: number | null;
  salon_profit: number | null;
  professional_profit: number | null;
  net_service_value: number | null;
  closed?: boolean;
  service: {
    id: string;
    name: string;
    price: number;
  } | null;
  payment_method: {
    id: string;
    name: string;
    fee: number;
  } | null;
  appointment: {
    id: string;
    status: string;
    date: string;
    client_id: string;
    professional_id: string;
    updated_at: string;
    clients: {
      id: string;
      name: string;
    } | null;
  };
}

// Interface para representar os vales pendentes
interface ValePendente {
  id: string;
  value: number;
  created_at: string;
  professional_id: string;
  professional: {
    name: string;
  };
  selecionado: boolean;
}

// Atualizar a interface AppointmentService para incluir todos os campos necessários
interface AppointmentService {
  id: string;
  service_id: string;
  appointment_id: string;
  professional_id: string;
  custom_price: number;
  payment_method_id: string | null;
  payment_fee: number | null;
  salon_profit: number;
  net_service_value: number;
  professional_profit: number; // Campo obrigatório para cálculo do valor líquido
  commission_rate: number;
  commission_amount: number;
  created_at: string;
  closed?: boolean; // Indicador se o serviço já foi incluído em um fechamento de caixa
  service: {
    id: string;
    name: string;
    price: number;
  } | null;
  payment_method: {
    id: string;
    name: string;
    fee: number;
  } | null;
  appointments: {
    id: string;
    status: string;
    date: string;
    client_id: string;
    professional_id: string;
    clients: {
      id: string;
      name: string;
    } | null;
  } | null;
}

// Interfaces para tipagem dos dados retornados pelo Supabase
interface SupabaseServiceResult {
  id: string;
  appointment_id: string;
  service_id: string;
  created_at: string;
  custom_price: number | null;
  payment_method_id: string | null;
  payment_fee: number | null;
  commission_rate: number | null;
  salon_profit: number | null;
  professional_profit: number | null;
  net_service_value: number | null;
  closed?: boolean;
  service: {
    id: string;
    name: string;
    price: number;
  } | null;
  payment_method: {
    id: string;
    name: string;
    fee: number;
  } | null;
  appointment: {
    id: string;
    status: string;
    date: string;
    client_id: string;
    professional_id: string;
    updated_at: string;
    clients: {
      id: string;
      name: string;
    } | null;
  };
}

// Componente do Modal de Histórico
const HistoricoModal: React.FC<HistoricoModalProps> = ({ 
  isOpen, 
  onClose, 
  fechamentos, 
  profissionalNome,
  limparHistorico
}) => {
  const [isLimparHistoricoModalOpen, setIsLimparHistoricoModalOpen] = useState(false);
  const [mostrarDetalhes, setMostrarDetalhes] = useState<{ [key: string]: boolean }>({});
  const [fechamentoAtualIndex, setFechamentoAtualIndex] = useState(0);
  
  // Estados para controle de swipe
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  
  // Distância mínima para considerar um swipe
  const minSwipeDistance = 50;
  
  const handleLimparHistorico = async () => {
    const sucesso = await limparHistorico();
    if (sucesso) {
      setIsLimparHistoricoModalOpen(false);
      onClose();
    }
  };

  const toggleDetalhes = (id: string) => {
    setMostrarDetalhes(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const irParaProximo = () => {
    if (fechamentoAtualIndex < fechamentos.length - 1) {
      setFechamentoAtualIndex(fechamentoAtualIndex + 1);
    }
  };

  const irParaAnterior = () => {
    if (fechamentoAtualIndex > 0) {
      setFechamentoAtualIndex(fechamentoAtualIndex - 1);
    }
  };

  // Funções de controle de swipe
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null); // Reset do touch end
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && fechamentoAtualIndex < fechamentos.length - 1) {
      // Swipe para a esquerda = próximo fechamento
      irParaProximo();
    }
    
    if (isRightSwipe && fechamentoAtualIndex > 0) {
      // Swipe para a direita = fechamento anterior
      irParaAnterior();
    }
  };

  // Funções para suporte a mouse (desktop)
  const [mouseStart, setMouseStart] = useState<number | null>(null);
  const [mouseEnd, setMouseEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const onMouseDown = (e: React.MouseEvent) => {
    setMouseEnd(null);
    setMouseStart(e.clientX);
    setIsDragging(true);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setMouseEnd(e.clientX);
  };

  const onMouseUp = () => {
    if (!isDragging || !mouseStart || !mouseEnd) {
      setIsDragging(false);
      return;
    }
    
    const distance = mouseStart - mouseEnd;
    const isLeftDrag = distance > minSwipeDistance;
    const isRightDrag = distance < -minSwipeDistance;

    if (isLeftDrag && fechamentoAtualIndex < fechamentos.length - 1) {
      irParaProximo();
    }
    
    if (isRightDrag && fechamentoAtualIndex > 0) {
      irParaAnterior();
    }
    
    setIsDragging(false);
  };

  const onMouseLeave = () => {
    setIsDragging(false);
  };

  const fechamentoAtual = fechamentos[fechamentoAtualIndex];

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="bg-white px-4 py-5 sm:p-6 w-full max-w-2xl mx-auto">
        {/* Header compacto */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center min-w-0">
            <History className="h-5 w-5 mr-2 text-gray-500 flex-shrink-0" />
            <div className="min-w-0">
              <h3 className="text-lg font-medium text-gray-900 truncate">
                <span className="hidden sm:inline">Histórico - {profissionalNome}</span>
                <span className="sm:hidden">Histórico</span>
              </h3>
              {fechamentos.length > 0 && (
                <p className="text-xs text-gray-500">
                  {fechamentoAtualIndex + 1} de {fechamentos.length} fechamentos
                </p>
              )}
            </div>
          </div>
          
          {/* Controles de navegação compactos */}
          {fechamentos.length > 1 && (
            <div className="flex items-center space-x-2 ml-3">
              <button
                onClick={irParaAnterior}
                disabled={fechamentoAtualIndex === 0}
                className={`p-1.5 rounded-md ${
                  fechamentoAtualIndex === 0
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                } transition-colors`}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-gray-500 px-2">
                {fechamentoAtualIndex + 1}/{fechamentos.length}
              </span>
              <button
                onClick={irParaProximo}
                disabled={fechamentoAtualIndex === fechamentos.length - 1}
                className={`p-1.5 rounded-md ${
                  fechamentoAtualIndex === fechamentos.length - 1
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                } transition-colors`}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
        
        {/* Indicador de swipe para mobile */}
        {fechamentos.length > 1 && (
          <div className="block sm:hidden text-center mb-3">
            <p className="text-xs text-gray-400">👈 Deslize para navegar 👉</p>
          </div>
        )}
        
        {/* Conteúdo do fechamento atual com suporte a swipe */}
        <div 
          className="max-h-[60vh] overflow-y-auto select-none"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          style={{ 
            cursor: isDragging ? 'grabbing' : fechamentos.length > 1 ? 'grab' : 'default',
            userSelect: 'none'
          }}
        >
          {fechamentos.length > 0 && fechamentoAtual ? (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* Cabeçalho do fechamento */}
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 text-gray-500 mr-2" />
                  <span className="text-sm font-medium text-gray-900">
                    {format(parseISO(fechamentoAtual.closure_date), 'dd/MM/yyyy')}
                  </span>
                  <span className="text-xs text-gray-500 ml-2">
                    {format(parseISO(fechamentoAtual.closure_date), 'HH:mm')}
                  </span>
                  {fechamentoAtual.quantidade_servicos > 1 && (
                    <span className="ml-3 inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                      {fechamentoAtual.quantidade_servicos} serviços
                    </span>
                  )}
                </div>
                <button 
                  onClick={() => toggleDetalhes(fechamentoAtual.id)}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {mostrarDetalhes[fechamentoAtual.id] ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              </div>
              
              {/* Conteúdo do fechamento */}
              <div className="px-4 py-3">
                {/* Nome dos serviços */}
                <div className="text-sm font-medium mb-3 text-gray-900">
                  {fechamentoAtual.service_names || <span className="text-gray-500 italic">Serviços não especificados</span>}
                </div>
                
                {/* Valores em grid compacto */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-sm mb-3">
                  <div className="bg-gray-50 p-2 rounded">
                    <span className="text-gray-500 text-xs block">Valor Bruto:</span>
                    <span className="text-gray-900 font-medium text-xs">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(fechamentoAtual.gross_service_value)}
                    </span>
                  </div>
                  <div className="bg-red-50 p-2 rounded">
                    <span className="text-gray-500 text-xs block">Taxa:</span>
                    <span className="text-red-600 font-medium text-xs">
                      -{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(fechamentoAtual.payment_fee)}
                    </span>
                  </div>
                  <div className="bg-blue-50 p-2 rounded">
                    <span className="text-gray-500 text-xs block">Comissão:</span>
                    <span className="text-blue-600 font-medium text-xs">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(fechamentoAtual.commission_amount)}
                    </span>
                  </div>
                  <div className="bg-green-50 p-2 rounded">
                    <span className="text-gray-500 text-xs block">Valor Líquido:</span>
                    <span className="text-green-600 font-medium text-xs">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(fechamentoAtual.net_service_value)}
                    </span>
                  </div>
                  {/* Vales descontados se houver */}
                  {fechamentoAtual.total_vales_descontados && fechamentoAtual.total_vales_descontados > 0 && (
                    <>
                      <div className="bg-orange-50 p-2 rounded">
                        <span className="text-gray-500 text-xs block">Vale Descontado:</span>
                        <span className="text-orange-600 font-medium text-xs">
                          -{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(fechamentoAtual.total_vales_descontados)}
                        </span>
                      </div>
                      <div className="bg-emerald-50 p-2 rounded border border-emerald-200">
                        <span className="text-gray-500 text-xs block">Valor Final:</span>
                        <span className="text-emerald-700 font-bold text-xs">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(fechamentoAtual.valor_final_liquido || fechamentoAtual.net_service_value)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
                
                {/* Clientes compacto */}
                {fechamentoAtual.client_names && fechamentoAtual.client_names.length > 0 && (
                  <div className="flex items-start text-xs text-gray-600 mb-3">
                    <User className="h-3 w-3 mr-2 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-gray-500">
                        {fechamentoAtual.client_names.length === 1 ? 'Cliente:' : 'Clientes:'}
                      </span>
                      <span className="ml-1 text-gray-700 font-medium">
                        {fechamentoAtual.client_names.join(', ')}
                      </span>
                    </div>
                  </div>
                )}
                
                {/* Detalhes dos serviços individuais - colapsável */}
                {mostrarDetalhes[fechamentoAtual.id] && fechamentoAtual.servicos_detalhes && fechamentoAtual.servicos_detalhes.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <h4 className="text-xs font-medium text-gray-700 mb-2">Detalhes dos Serviços</h4>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {fechamentoAtual.servicos_detalhes.map((servico: any, index: number) => (
                        <div key={servico.id} className="bg-gray-50 p-2 rounded border-l-2 border-gray-300">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-medium text-gray-800 text-xs">
                              {index + 1}. {servico.service_name}
                            </span>
                            <span className="text-green-600 font-medium text-xs">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(servico.net_service_value)}
                            </span>
                          </div>
                          {servico.client_name && (
                            <div className="text-gray-500 text-xs">
                              Cliente: {servico.client_name}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Detalhes dos vales descontados - colapsável */}
                {mostrarDetalhes[fechamentoAtual.id] && fechamentoAtual.vales_detalhes && fechamentoAtual.vales_detalhes.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <h4 className="text-xs font-medium text-gray-700 mb-2">Vales Descontados</h4>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {fechamentoAtual.vales_detalhes.map((vale: ValeDescontado, index: number) => (
                        <div key={vale.id} className="bg-orange-50 p-2 rounded border-l-2 border-orange-300">
                          <div className="flex justify-between items-start">
                            <span className="font-medium text-gray-800 text-xs">
                              {index + 1}. Vale de Adiantamento
                            </span>
                            <span className="text-orange-600 font-medium text-xs">
                              -{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(vale.value)}
                            </span>
                          </div>
                          <div className="text-gray-500 text-xs mt-1">
                            Criado em: {format(parseISO(vale.created_at), 'dd/MM/yyyy')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="h-8 w-8 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Nenhum fechamento encontrado para este profissional.</p>
            </div>
          )}
        </div>
        
        {/* Navegação com swipe indicators */}
        {fechamentos.length > 1 && (
          <div className="flex justify-center mt-4 space-x-1">
            {fechamentos.map((_, index) => (
              <button
                key={index}
                onClick={() => setFechamentoAtualIndex(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === fechamentoAtualIndex 
                    ? 'bg-indigo-600' 
                    : 'bg-gray-300 hover:bg-gray-400'
                }`}
              />
            ))}
          </div>
        )}
        
        {/* Botões de ação compactos */}
        <div className="mt-6 pt-4 border-t border-gray-200 flex flex-col sm:flex-row sm:justify-between gap-3">
          <button
            type="button"
            onClick={() => setIsLimparHistoricoModalOpen(true)}
            className="px-3 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 transition-colors order-2 sm:order-1"
          >
            <span className="hidden sm:inline">Limpar Histórico</span>
            <span className="sm:hidden">Limpar</span>
          </button>
          <button
            type="button"
            className="px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors order-1 sm:order-2"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>
      </div>
      
      {/* Modal de confirmação simplificado */}
      {isLimparHistoricoModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Confirmar limpeza</h3>
            <p className="text-sm text-gray-600 mb-6">
              Tem certeza que deseja limpar todo o histórico de fechamentos para este profissional? 
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsLimparHistoricoModalOpen(false)}
                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors order-2 sm:order-1"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleLimparHistorico}
                className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 transition-colors order-1 sm:order-2"
              >
                <span className="hidden sm:inline">Limpar Histórico</span>
                <span className="sm:hidden">Limpar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

export const CaixaOperacao: React.FC<CaixaOperacaoProps> = ({
  professionals,
  isUpdating,
  handleProfessionalCashDetail
}): JSX.Element => {
  // Estados locais para o filtro
  const [selectedProfessional, setSelectedProfessional] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  // Estado para controlar a abertura do modal de seleção de período
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [showProfessionalModal, setShowProfessionalModal] = useState(false);
  
  // Estados para os resultados
  const [loadingResults, setLoadingResults] = useState(false);
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [totalComissao, setTotalComissao] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [selectedProfessionalName, setSelectedProfessionalName] = useState('');
  // Adicionar estado para armazenar o total líquido dos fechamentos
  const [totalLiquidoFechamentos, setTotalLiquidoFechamentos] = useState(0);
  
  // Estados para fechamento de caixa
  const [isFechamentoPendente, setIsFechamentoPendente] = useState(false);
  const [loadingFechamento, setLoadingFechamento] = useState(false);
  const [fechamentosAnteriores, setFechamentosAnteriores] = useState<Fechamento[]>([]);
  const [showHistorico, setShowHistorico] = useState(false);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [isHistoricoModalOpen, setIsHistoricoModalOpen] = useState(false);
  // Adicionar estado para controlar se está visualizando detalhes de um fechamento histórico
  const [isVisualizandoHistorico, setIsVisualizandoHistorico] = useState(false);
  
  // Adicionar estados para os vales
  const [valesPendentes, setValesPendentes] = useState<ValePendente[]>([]);
  const [totalValesSelecionados, setTotalValesSelecionados] = useState(0);
  
  // Estado para armazenar os fechamentos de caixa
  const [professionalClosures, setProfessionalClosures] = useState<ProfessionalClosure[]>([]);
  
  // Função para verificar se um atendimento já foi incluído em algum fechamento anterior
  const verificarAtendimentoJaFechado = useCallback(async (atendimentoId: string): Promise<boolean> => {
    try {
      // Consultar a tabela appointment_services para verificar se o serviço do atendimento já está fechado
      const { data, error } = await supabase
        .from('appointment_services')
        .select('id')
        .eq('appointment_id', atendimentoId)
        .eq('closed', true)
        .limit(1);
        
      if (error) {
        console.error('Erro ao verificar atendimento:', error);
        return false;
      }
      
      // Se encontrou algum registro, o atendimento já foi incluído em um fechamento
      return data && data.length > 0;
    } catch (err) {
      console.error('Erro ao verificar se atendimento já foi fechado:', err);
      return false;
    }
  }, []);
  
  // Função para salvar um fechamento no localStorage
  const salvarFechamentoLocal = useCallback((fechamento: any) => {
    try {
      // Buscar fechamentos anteriores do localStorage
      const fechamentosStr = localStorage.getItem('fechamentos_caixa');
      const fechamentos = fechamentosStr ? JSON.parse(fechamentosStr) : [];
      
      // Adicionar o novo fechamento
      fechamentos.push(fechamento);
      
      // Salvar de volta no localStorage
      localStorage.setItem('fechamentos_caixa', JSON.stringify(fechamentos));
      
      console.log('Fechamento salvo localmente:', fechamento);
      return true;
    } catch (error) {
      console.error('Erro ao salvar fechamento local:', error);
      return false;
    }
  }, []);

  // Atualizar a função fetchCaixaData para buscar de appointment_services
  const fetchCaixaData = async (customStartDate?: Date, customEndDate?: Date) => {
    if (!selectedProfessional) return;
    
    setLoadingResults(true);
    setShowResults(false);
    
    try {
      // Encontrar o nome do profissional selecionado
      const professional = professionals.find(p => p.id === selectedProfessional);
      if (professional) {
        setSelectedProfessionalName(professional.name);
      }
      
      // Usar as datas personalizadas se fornecidas, senão usar os estados
      let fixedStartDate = customStartDate ? new Date(customStartDate) : new Date(startDate);
      let fixedEndDate = customEndDate ? new Date(customEndDate) : new Date(endDate);
      
      // Verificar se as datas estão em um futuro distante (possível erro)
      let datesFixed = false;
      const currentYear = new Date().getFullYear();
      
      // Se o ano for maior que o ano atual + 1, pode ser um erro
      if (fixedStartDate.getFullYear() > currentYear + 1) {
        console.warn(`Data de início parece estar em um futuro distante (${fixedStartDate.getFullYear()}). Ajustando para ${currentYear}.`);
        fixedStartDate.setFullYear(currentYear);
        datesFixed = true;
      }
      
      if (fixedEndDate.getFullYear() > currentYear + 1) {
        console.warn(`Data de fim parece estar em um futuro distante (${fixedEndDate.getFullYear()}). Ajustando para ${currentYear}.`);
        fixedEndDate.setFullYear(currentYear);
        datesFixed = true;
      }
      
      // Garantir que a data inicial seja o início do dia (00:00:00)
      fixedStartDate.setHours(0, 0, 0, 0);
      
      // Garantir que a data final tenha a hora final do dia
      fixedEndDate.setHours(23, 59, 59, 999);
      
      // Converter datas para formato ISO
      const startDateISO = fixedStartDate.toISOString();
      const endDateISO = fixedEndDate.toISOString();
      
      // Formato de data somente, sem horas, para o log
      const startDateOnly = startDateISO.split('T')[0];
      const endDateOnly = endDateISO.split('T')[0];
      
      console.log('Buscando fechamentos para profissional:', {
        professionalId: selectedProfessional,
        professionalName: professional?.name,
        dataAjustada: datesFixed ? 'Sim' : 'Não',
        startDate: startDateISO,
        endDate: endDateISO,
        startDateOnly,
        endDateOnly,
        criterio: 'Filtrando por data do agendamento (appointment.date)'
      });
      
      // CONSULTA CORRIGIDA: Usar o relacionamento correto com appointments e incluir cliente
      const { data: appointmentServicesData, error: servicesError } = await supabase
        .from("appointment_services")
        .select(`
          id, 
          appointment_id,
          service_id,
          created_at,
          custom_price,
          payment_method_id,
          payment_fee,
          commission_rate,
          salon_profit,
          professional_profit,
          net_service_value,
          closed,
          service:services(id, name, price),
          payment_method:payment_methods(id, name, fee),
          appointment:appointments!inner(id, status, date, client_id, professional_id, updated_at, clients(id, name))
        `)
        .eq("appointment.professional_id", selectedProfessional)
        .eq("appointment.status", "finalizado")
        .gte("appointment.date", startDateISO.split('T')[0])
        .lte("appointment.date", endDateISO.split('T')[0])
        .is("closed", false);
        
      if (servicesError) {
        console.error('Erro na consulta de serviços do Supabase:', servicesError);
        throw servicesError;
      }
      
      console.log(`Serviços encontrados: ${appointmentServicesData?.length || 0}`);
      
      // Corrigir o filtro e conversão de tipos para os dados do Supabase
      const validServices: AppointmentService[] = [];
      
      (appointmentServicesData || []).forEach((rawService: any) => {
        // Verificar se o serviço tem um atendimento finalizado
        if (rawService.appointment && rawService.appointment.status === "finalizado") {
          try {
            // Construir o objeto com verificações de segurança
            const processedService: AppointmentService = {
              id: rawService.id || '',
              service_id: rawService.service_id || '',
              appointment_id: rawService.appointment_id || '',
              professional_id: rawService.appointment?.professional_id || '',
              custom_price: Number(rawService.custom_price || 0),
              payment_method_id: rawService.payment_method_id || null,
              payment_fee: Number(rawService.payment_fee || 0),
              salon_profit: Number(rawService.salon_profit || 0),
              net_service_value: Number(rawService.net_service_value || 0),
              professional_profit: Number(rawService.professional_profit || 0),
              commission_rate: Number(rawService.commission_rate || 0),
              commission_amount: Number(rawService.professional_profit || 0),
              created_at: rawService.created_at || '',
              closed: rawService.closed || false,
              service: rawService.service ? {
                id: rawService.service.id || '',
                name: rawService.service.name || 'Serviço não especificado',
                price: Number(rawService.service.price || 0)
              } : null,
              payment_method: rawService.payment_method ? {
                id: rawService.payment_method.id || '',
                name: rawService.payment_method.name || '',
                fee: Number(rawService.payment_method.fee || 0)
              } : null,
              appointments: rawService.appointment ? {
                id: rawService.appointment.id || '',
                status: rawService.appointment.status || '',
                date: rawService.appointment.date || '',
                client_id: rawService.appointment.client_id || '',
                professional_id: rawService.appointment.professional_id || '',
                clients: rawService.appointment.clients || null
              } : null
            };
            
            validServices.push(processedService);
          } catch (error) {
            console.error('Erro ao processar serviço:', error, rawService);
          }
        }
      });
      
      console.log(`Serviços válidos após processamento: ${validServices.length}`);
      
      // Transformar os dados de serviços em um formato compatível com ProfessionalClosure
      const closures: ProfessionalClosure[] = validServices.map(service => {
        // Calcular valores financeiros
        const grossValue = service.custom_price || 0;
        const paymentFee = service.payment_fee || 0;
        // Usar diretamente professional_profit como valor líquido
        const professionalProfit = service.professional_profit || 0;
        const commission = service.professional_profit || 
                          (grossValue - (service.salon_profit || 0) - paymentFee);
        const commissionRate = service.commission_rate || 
                              (grossValue > 0 ? (commission / grossValue) * 100 : 0);
        
        return {
          id: service.id,
          professional_id: service.professional_id,
          appointment_service_id: service.id,
          appointment_service: service,
          gross_service_value: grossValue,
          discounted_service_value: grossValue, // Sem desconto, mesmo valor
          payment_fee_value: paymentFee,
          payment_fee: paymentFee, // Alias para payment_fee_value
          commission_percentage: commissionRate,
          commission_value: commission,
          commission_amount: commission, // Alias para commission_value
          net_service_value: professionalProfit, // Usar professional_profit como valor líquido
          created_at: service.created_at,
          service_names: service.service?.name || 'Serviço não especificado',
          client_name: service.appointments?.clients?.name || 'Cliente não especificado',
          appointment_id: service.appointment_id,
          closed: false // Por padrão, não fechado
        };
      });
      
      // Ordenar por data (mais recente primeiro)
      const sortedClosures = [...closures].sort((a, b) => {
        // Ordenar por data (decrescente)
        const dateComparison = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        
        // Se as datas forem iguais, ordenar por nome do serviço (crescente)
        if (dateComparison === 0) {
          return (a.service_names || '').localeCompare(b.service_names || '');
        }
        
        return dateComparison;
      });
      
      setProfessionalClosures(sortedClosures);
      
      // Calcular o total líquido dos fechamentos
      if (sortedClosures.length > 0) {
        // Somar os valores de professional_profit em vez de net_service_value
        const total = sortedClosures.reduce((sum, closure) => sum + (closure.net_service_value || 0), 0);
        setTotalLiquidoFechamentos(total);
      } else {
        setTotalLiquidoFechamentos(0);
      }
      
      // Exibimos apenas os fechamentos da tabela professional_closures
      setAtendimentos([]);
      setTotalComissao(0);
      setIsFechamentoPendente(sortedClosures.length > 0);
      
    } catch (error) {
      console.error('Erro ao buscar dados de fechamento:', error);
      alert('Erro ao buscar dados de fechamento. Verifique o console para mais detalhes.');
    } finally {
      setLoadingResults(false);
      setShowResults(true);
    }
  };

  // Adicionar listener para evento de atualização de atendimento - agora DEPOIS da declaração da função fetchCaixaData
  useEffect(() => {
    // Função que será executada quando um atendimento for atualizado
    const handleAppointmentUpdated = (event: Event) => {
      const customEvent = event as CustomEvent;
      // Verificar se o status do atendimento é 'finalizado'
      if (customEvent.detail?.status === 'finalizado' && selectedProfessional) {
        console.log('CaixaOperacao: Atendimento finalizado detectado, atualizando dados do caixa');
        // Refazer a busca de dados
        fetchCaixaData();
      }
    };

    // Adicionar o listener ao window
    window.addEventListener('appointmentUpdated', handleAppointmentUpdated);

    // Remover o listener quando o componente for desmontado
    return () => {
      window.removeEventListener('appointmentUpdated', handleAppointmentUpdated);
    };
  }, [selectedProfessional, fetchCaixaData]);
  
  // Função para formatar o texto do período selecionado
  const getDateRangeText = (): string => {
    const start = format(startDate, 'dd/MM/yyyy');
    const end = format(endDate, 'dd/MM/yyyy');
    
    // Verificar se é o dia atual
    const today = new Date();
    const isToday = 
      startDate.getDate() === today.getDate() && 
      startDate.getMonth() === today.getMonth() && 
      startDate.getFullYear() === today.getFullYear() &&
      endDate.getDate() === today.getDate() && 
      endDate.getMonth() === today.getMonth() && 
      endDate.getFullYear() === today.getFullYear();
      
    if (isToday) return `Hoje (${start})`;
    
    // Verificar se é o mesmo dia
    if (start === end) return `${start}`;
    
    return `${start} - ${end}`;
  };

  // Função para aplicar períodos rápidos
  const applyQuickPeriod = (days: number) => {
    const today = new Date();
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    
    let start;
    if (days === 0) {
      // Hoje
      start = new Date(today);
      start.setHours(0, 0, 0, 0);
    } else {
      // Período específico (7, 15, 30 dias)
      start = new Date(today);
      start.setDate(start.getDate() - days);
      start.setHours(0, 0, 0, 0);
    }
    
    console.log(`Período rápido selecionado: ${days} dias - De ${format(start, 'dd/MM/yyyy')} a ${format(end, 'dd/MM/yyyy')}`);
    
    // Atualizar os estados de data
    setStartDate(start);
    setEndDate(end);
    
    // Aplicar o filtro automaticamente se um profissional já estiver selecionado
    if (selectedProfessional) {
      // Chamar a função externa para compatibilidade
      handleProfessionalCashDetail(selectedProfessional);
      
      // Buscar os dados para exibir
      fetchCaixaData(start, end)
        .catch(error => {
          console.error("Erro ao processar dados do caixa após seleção de período rápido:", error);
          setLoadingResults(false);
        });
    }
  };

  // Função para aplicar os filtros e buscar os dados
  const handleApplyFilter = () => {
    if (selectedProfessional) {
      // Ajustar datas para o ano atual (evita problemas com datas futuras)
      let fixedStartDate = new Date(startDate);
      let fixedEndDate = new Date(endDate);
      
      const currentYear = new Date().getFullYear();
      
      // Forçar o ajuste para o ano atual para todos os profissionais
      if (fixedStartDate.getFullYear() !== currentYear) {
        console.warn(`Ajustando data de início de ${fixedStartDate.getFullYear()} para ${currentYear}`);
        fixedStartDate.setFullYear(currentYear);
        setStartDate(fixedStartDate);
      }
      
      if (fixedEndDate.getFullYear() !== currentYear) {
        console.warn(`Ajustando data de fim de ${fixedEndDate.getFullYear()} para ${currentYear}`);
        fixedEndDate.setFullYear(currentYear);
        setEndDate(fixedEndDate);
      }
      
      // Garantir que a data inicial seja o início do dia (00:00:00)
      fixedStartDate.setHours(0, 0, 0, 0);
      
      // Ajustar hora final para incluir todo o dia
      fixedEndDate.setHours(23, 59, 59, 999);
      
      console.log(`Aplicando filtro com datas personalizadas: ${format(fixedStartDate, 'dd/MM/yyyy HH:mm:ss')} a ${format(fixedEndDate, 'dd/MM/yyyy HH:mm:ss')}`);
      
      // Chamar a função externa para compatibilidade
      handleProfessionalCashDetail(selectedProfessional);
      
      // Buscar os dados para exibir - passando as datas já processadas para evitar reprocessamento
      fetchCaixaData(fixedStartDate, fixedEndDate)
        .catch(error => {
          console.error("Erro ao processar dados do caixa:", error);
          setLoadingResults(false);
        });
    }
  };

  // Função para verificar se o banco de dados está vazio
  const verificarBancoVazio = async () => {
    try {
      console.log('Verificando se existem fechamentos salvos...');
      
      // Como a tabela cash_closings não existe mais, vamos verificar apenas no localStorage
      const fechamentosStr = localStorage.getItem('fechamentos_caixa');
      const fechamentos = fechamentosStr ? JSON.parse(fechamentosStr) : [];
      
      console.log(`Encontrados ${fechamentos.length} fechamentos no localStorage`);
      
      return fechamentos.length === 0; // Só está vazio se não houver nenhum fechamento
    } catch (error) {
      console.error('Erro ao verificar fechamentos:', error);
      // Em caso de erro, assumir que não está vazio para ser seguro
      return false;
    }
  };

  // Função para limpar histórico de fechamentos
  const limparHistoricoFechamentos = async () => {
    try {
      // Como a tabela cash_closings não existe mais, vamos limpar apenas o localStorage
      
      // Limpar do localStorage
      try {
        // Buscar fechamentos existentes
        const fechamentosStr = localStorage.getItem('fechamentos_caixa');
        if (fechamentosStr) {
          const todos = JSON.parse(fechamentosStr);
          
          if (selectedProfessional) {
            // Filtrar apenas os de outros profissionais
            const filtrados = todos.filter((f: any) => f.professional_id !== selectedProfessional);
            localStorage.setItem('fechamentos_caixa', JSON.stringify(filtrados));
            console.log(`Fechamentos do profissional ${selectedProfessional} removidos do localStorage`);
          } else {
            // Limpar todos
            localStorage.removeItem('fechamentos_caixa');
            console.log('Todos os fechamentos foram removidos do localStorage');
          }
        }
      } catch (localError) {
        console.error('Erro ao limpar localStorage:', localError);
      }
      
      // Limpar o estado
      setFechamentosAnteriores([]);
      
      alert('Histórico de fechamentos limpo com sucesso!');
      return true;
    } catch (e) {
      console.error('Erro ao limpar histórico:', e);
      alert('Erro ao limpar histórico de fechamentos.');
      return false;
    }
  };

  // Função para buscar os fechamentos anteriores deste profissional
  const fetchFechamentosAnteriores = async () => {
    try {
      setLoadingHistorico(true);
      
      try {
        // Consulta corrigida para usar o professional_id via relacionamento com appointments
        const { data, error } = await supabase
          .from('appointment_services')
          .select(`
            id,
            appointment_id,
            custom_price,
            payment_fee,
            commission_rate,
            salon_profit,
            professional_profit,
            net_service_value,
            closed,
            closure_date,
            created_at,
            service:services(id, name, price),
            appointment:appointments!inner(id, professional_id, clients(id, name))
          `)
          .eq('closed', true)
          .order('closure_date', { ascending: false });
          
        if (error) {
          console.error('Erro ao buscar histórico de fechamentos:', error);
          throw error;
        }
        
        // Buscar vales descontados do mesmo profissional
        const { data: valesData, error: valesError } = await supabase
          .from('professional_advances')
          .select(`
            id,
            value,
            created_at,
            closure_date,
            professional_id
          `)
          .eq('professional_id', selectedProfessional)
          .eq('discounted', true)
          .not('closure_date', 'is', null)
          .order('closure_date', { ascending: false });
          
        if (valesError) {
          console.error('Erro ao buscar vales descontados:', valesError);
        }
        
        // Filtrar apenas os do profissional selecionado
        const filteredData = (data || []).filter((item: any) => {
          return item.appointment && 
                 typeof item.appointment === 'object' &&
                 item.appointment.professional_id === selectedProfessional;
        });
        
        if (filteredData.length > 0 || (valesData && valesData.length > 0)) {
          // NOVO AGRUPAMENTO: Agrupar por proximidade de tempo (mesma operação de fechamento)
          const fechamentosAgrupados: { [key: string]: any[] } = {};
          const valesAgrupados: { [key: string]: any[] } = {};
          
          // Primeiro, formatar cada serviço
          const servicosFormatados = filteredData.map((item: any) => {
            // Extrair o nome do serviço com segurança
            let serviceName = 'Serviço';
            if (item.service && typeof item.service === 'object') {
              serviceName = item.service.name || 'Serviço';
            }
            
            // Extrair o nome do cliente, se disponível
            let clientName = '';
            if (item.appointment && 
                item.appointment.clients && 
                typeof item.appointment.clients === 'object') {
              clientName = item.appointment.clients.name || '';
            }
            
            return {
              id: item.id,
              appointment_id: item.appointment_id,
              service_id: item.service?.id,
              service_name: serviceName,
              service_names: serviceName,
              client_name: clientName,
              created_at: item.created_at,
              closure_date: item.closure_date || item.created_at,
              closure_timestamp: new Date(item.closure_date || item.created_at).getTime(),
              custom_price: Number(item.custom_price || 0),
              gross_service_value: Number(item.custom_price || 0),
              payment_fee: Number(item.payment_fee || 0),
              commission_rate: Number(item.commission_rate || 0),
              commission_amount: Number(item.professional_profit || 0),
              professional_profit: Number(item.professional_profit || 0),
              net_service_value: Number(item.professional_profit || item.net_service_value || 0)
            };
          });
          
          // Formatar vales descontados
          const valesFormatados = (valesData || []).map((vale: any) => ({
            id: vale.id,
            value: Number(vale.value || 0),
            created_at: vale.created_at,
            closure_date: vale.closure_date,
            closure_timestamp: new Date(vale.closure_date).getTime()
          }));
          
          // Ordenar por timestamp de fechamento
          servicosFormatados.sort((a, b) => b.closure_timestamp - a.closure_timestamp);
          valesFormatados.sort((a, b) => b.closure_timestamp - a.closure_timestamp);
          
          // Agrupar serviços que foram fechados na mesma operação (tolerância de 5 minutos)
          const TOLERANCIA_FECHAMENTO = 5 * 60 * 1000; // 5 minutos em millisegundos
          let grupoAtual: any[] = [];
          let timestampGrupoAtual = 0;
          let contadorGrupo = 1;
          
          servicosFormatados.forEach((servico) => {
            // Se é o primeiro serviço ou está dentro da tolerância de tempo
            if (grupoAtual.length === 0 || Math.abs(servico.closure_timestamp - timestampGrupoAtual) <= TOLERANCIA_FECHAMENTO) {
              grupoAtual.push(servico);
              if (timestampGrupoAtual === 0) {
                timestampGrupoAtual = servico.closure_timestamp;
              }
            } else {
              // Finalizar grupo anterior
              if (grupoAtual.length > 0) {
                const chaveGrupo = `fechamento_${contadorGrupo}_${new Date(timestampGrupoAtual).toISOString().substring(0, 16)}`;
                fechamentosAgrupados[chaveGrupo] = [...grupoAtual];
                contadorGrupo++;
              }
              
              // Iniciar novo grupo
              grupoAtual = [servico];
              timestampGrupoAtual = servico.closure_timestamp;
            }
          });
          
          // Adicionar o último grupo
          if (grupoAtual.length > 0) {
            const chaveGrupo = `fechamento_${contadorGrupo}_${new Date(timestampGrupoAtual).toISOString().substring(0, 16)}`;
            fechamentosAgrupados[chaveGrupo] = [...grupoAtual];
          }
          
          // Agrupar vales nas mesmas chaves de fechamento
          valesFormatados.forEach((vale) => {
            let valeAgrupado = false;
            
            // Tentar encontrar um grupo de fechamento que corresponda ao vale
            Object.entries(fechamentosAgrupados).forEach(([chaveGrupo, servicos]) => {
              if (!valeAgrupado && servicos.length > 0) {
                const timestampGrupo = servicos[0].closure_timestamp;
                
                // Se o vale foi descontado dentro da tolerância de tempo do fechamento
                if (Math.abs(vale.closure_timestamp - timestampGrupo) <= TOLERANCIA_FECHAMENTO) {
                  if (!valesAgrupados[chaveGrupo]) {
                    valesAgrupados[chaveGrupo] = [];
                  }
                  valesAgrupados[chaveGrupo].push(vale);
                  valeAgrupado = true;
                }
              }
            });
            
            // Se o vale não foi agrupado com nenhum fechamento, criar um grupo só para ele
            if (!valeAgrupado) {
              const chaveVale = `vale_${contadorGrupo}_${new Date(vale.closure_timestamp).toISOString().substring(0, 16)}`;
              valesAgrupados[chaveVale] = [vale];
              fechamentosAgrupados[chaveVale] = []; // Grupo vazio de serviços
              contadorGrupo++;
            }
          });
          
          // Agora, criar um único item de fechamento para cada grupo
          const historicoAgrupado = Object.entries(fechamentosAgrupados).map(([chaveGrupo, servicos]) => {
            const valesDoGrupo = valesAgrupados[chaveGrupo] || [];
            
            // Calcular totais consolidados dos serviços
            const valorBrutoTotal = servicos.reduce((sum, s) => sum + s.gross_service_value, 0);
            const taxaTotal = servicos.reduce((sum, s) => sum + s.payment_fee, 0);
            const comissaoTotal = servicos.reduce((sum, s) => sum + s.commission_amount, 0);
            const valorLiquidoTotal = servicos.reduce((sum, s) => sum + s.net_service_value, 0);
            
            // Calcular total dos vales descontados
            const totalValesDescontados = valesDoGrupo.reduce((sum, v) => sum + v.value, 0);
            
            // Calcular valor líquido final (serviços - vales)
            const valorFinalLiquido = valorLiquidoTotal - totalValesDescontados;
            
            // Listar todos os nomes de serviços únicos
            const servicosNomes = [...new Set(servicos.map(s => s.service_name))].join(', ');
            
            // Listar todos os nomes de clientes únicos
            const clientesNomes = [...new Set(servicos.map(s => s.client_name).filter(Boolean))];
            
            // Usar a data do primeiro item do grupo (serviço ou vale)
            let dataFechamento;
            if (servicos.length > 0) {
              dataFechamento = servicos[servicos.length - 1].closure_date; // Último do array = mais antigo por conta da ordenação
            } else if (valesDoGrupo.length > 0) {
              dataFechamento = valesDoGrupo[0].closure_date;
            } else {
              dataFechamento = new Date().toISOString();
            }
            
            return {
              id: chaveGrupo,
              professional_id: selectedProfessional,
              closure_date: dataFechamento,
              service_names: servicosNomes || (valesDoGrupo.length > 0 ? 'Desconto de Vale' : 'Operação vazia'),
              client_names: clientesNomes,
              servicos_detalhes: servicos,
              vales_detalhes: valesDoGrupo,
              gross_service_value: valorBrutoTotal,
              payment_fee: taxaTotal,
              commission_amount: comissaoTotal,
              net_service_value: valorLiquidoTotal,
              total_vales_descontados: totalValesDescontados,
              valor_final_liquido: valorFinalLiquido,
              quantidade_servicos: servicos.length
            };
          });
          
          // Ordenar grupos por data mais recente
          historicoAgrupado.sort((a, b) => {
            return new Date(b.closure_date).getTime() - new Date(a.closure_date).getTime();
          });
          
          console.log(`Histórico agrupado: ${historicoAgrupado.length} fechamentos consolidados de ${filteredData.length} serviços individuais e ${valesData?.length || 0} vales`);
          setFechamentosAnteriores(historicoAgrupado);
        } else {
          setFechamentosAnteriores([]);
        }
        
        setIsHistoricoModalOpen(true);
      } catch (dbError) {
        console.error('Erro ao buscar do banco de dados:', dbError);
        
        // Tentar buscar do localStorage como fallback
        try {
          const fechamentosStr = localStorage.getItem('fechamentos_caixa');
          if (fechamentosStr) {
            const todosFechamentos = JSON.parse(fechamentosStr);
            // Filtrar apenas os deste profissional
            const fechamentosProfissional = todosFechamentos.filter((f: any) => 
              f.professional_id === selectedProfessional
            );
            
            if (fechamentosProfissional.length > 0) {
              // Mapear para o formato esperado
              const fechamentosFormatados = fechamentosProfissional.map((f: any) => ({
                id: f.id,
                closure_date: f.created_at,
                service_names: f.service_names || 'Serviços diversos',
                client_names: f.client_names || [],
                gross_service_value: f.total_commission || 0,
                payment_fee: 0, // Não temos esse dado no localStorage
                commission_amount: 0, // Não temos esse dado no localStorage
                net_service_value: f.valor_liquido_final || 0,
                quantidade_servicos: f.appointment_count || 0,
                total_vales_descontados: f.total_vales_descontados || 0,
                valor_final_liquido: f.valor_liquido_final || 0,
                // Detalhes extras se disponíveis
                servicos_detalhes: f.details ? JSON.parse(f.details) : [],
                vales_detalhes: [] // Não temos esses dados no localStorage
              }));
              
              setFechamentosAnteriores(fechamentosFormatados);
            } else {
              setFechamentosAnteriores([]);
            }
          } else {
            setFechamentosAnteriores([]);
          }
        } catch (e) {
          console.error('Erro ao buscar do localStorage:', e);
          setFechamentosAnteriores([]);
        }
        
        setIsHistoricoModalOpen(true);
      }
    } catch (error) {
      console.error('Erro ao buscar fechamentos anteriores:', error);
      alert('Erro ao carregar o histórico de fechamentos.');
      setFechamentosAnteriores([]);
    } finally {
      setLoadingHistorico(false);
    }
  };

  // Função para salvar um fechamento no banco de dados e no localStorage
  const salvarFechamento = async (fechamento: any) => {
    try {
      // Salvar no localStorage para compatibilidade
      salvarFechamentoLocal(fechamento);
      
      console.log('Fechamento salvo apenas no localStorage para fins de histórico');
      return true;
    } catch (error) {
      console.error('Erro ao salvar fechamento:', error);
      return false;
    }
  };

  // Atualizar a função handleFecharCaixa
  const handleFecharCaixa = async () => {
    if (!selectedProfessional) return;
    
    // Se não tiver vales selecionados e não tiver fechamentos, não precisa fechar caixa
    if (totalValesSelecionados === 0 && professionalClosures.length === 0) {
      alert("Não há vales ou fechamentos para processar.");
      return;
    }
    
    if (!window.confirm(`Deseja fechar o caixa?`)) {
      return;
    }
    
    setLoadingFechamento(true);
    try {
      // Verificar e ajustar datas no futuro
      let fixedStartDate = new Date(startDate);
      let fixedEndDate = new Date(endDate);
      
      const currentYear = new Date().getFullYear();
      
      // Se o ano for maior que o ano atual + 1, ajustar para o ano atual
      if (fixedStartDate.getFullYear() > currentYear + 1) {
        fixedStartDate.setFullYear(currentYear);
      }
      
      if (fixedEndDate.getFullYear() > currentYear + 1) {
        fixedEndDate.setFullYear(currentYear);
      }
      
      // Filtrar apenas os vales que foram selecionados
      const valesParaProcessar = valesPendentes.filter(vale => vale.selecionado);
      
      // Calcular valores totais para o fechamento
      const valorBrutoTotal = professionalClosures.reduce((sum, closure) => sum + Number(closure.gross_service_value || 0), 0);
      const taxaTotal = professionalClosures.reduce((sum, closure) => sum + Number(closure.payment_fee || 0), 0);
      const comissaoTotal = professionalClosures.reduce((sum, closure) => sum + Number(closure.commission_amount || 0), 0);
      const valorLiquidoTotal = professionalClosures.reduce((sum, closure) => sum + Number(closure.net_service_value || 0), 0);
      
      // Listar todos os serviços incluídos neste fechamento
      const servicosNomes = [...new Set(professionalClosures.map(closure => 
        closure.service_names || (closure.appointment_service?.service?.name || "Serviço")
      ))].join(', ');
      
      // Extrair nomes dos clientes (se disponíveis)
      const clientesNomes = [...new Set(professionalClosures
        .filter(closure => closure.appointment_service)
        .map(closure => {
          const appointmentService = closure.appointment_service;
          if (appointmentService && 
              appointmentService.appointments && 
              appointmentService.appointments.clients) {
            return appointmentService.appointments.clients.name || '';
          }
          return '';
        })
        .filter(Boolean)
      )];
      
      // Criar um único registro de fechamento de caixa para o localStorage
      const fechamentoData = {
        id: `fechamento_${Date.now()}`, // ID único para o fechamento 
        professional_id: selectedProfessional,
        professional_name: selectedProfessionalName,
        start_date: fixedStartDate.toISOString(),
        end_date: fixedEndDate.toISOString(),
        total_commission: valorLiquidoTotal,
        vales_descontados: valesParaProcessar.length > 0 ? valesParaProcessar.map(v => v.id) : [],
        total_vales_descontados: totalValesSelecionados,
        valor_liquido_final: valorLiquidoTotal - totalValesSelecionados,
        appointment_service_ids: professionalClosures.length > 0 ? 
          professionalClosures.map(c => c.appointment_service_id).filter(Boolean) : [],
        appointment_count: professionalClosures.length,
        status: 'fechado',
        created_at: new Date().toISOString(),
        details: JSON.stringify(professionalClosures),
        service_names: servicosNomes,
        client_names: clientesNomes
      };
      
      // CORREÇÃO: Usar a função RPC centralizada em vez de PATCH direto
      if (professionalClosures.length > 0) {
        try {
          console.log(`Fechando caixa via RPC para profissional ${selectedProfessional} na data ${fixedStartDate.toISOString().split('T')[0]}`);
          
          // Chamar a função RPC close_professional_cashbox
          const { data: rpcResult, error: rpcError } = await supabase.rpc('close_professional_cashbox', {
            _start_date: fixedStartDate.toISOString().split('T')[0],
            _end_date: fixedEndDate.toISOString().split('T')[0],
            _professional_id: selectedProfessional
          });
          
          if (rpcError) {
            console.error('Erro na função RPC close_professional_cashbox:', rpcError);
            throw rpcError;
          } else {
            console.log('Caixa fechado com sucesso via RPC:', rpcResult);
          }
        } catch (error) {
          console.error('Erro ao fechar caixa via RPC:', error);
          throw error;
        }
      }
      
      // Salvar no localStorage para compatibilidade
      salvarFechamentoLocal(fechamentoData);
      
      // Se houver vales selecionados para descontar, marcá-los como descontados ao invés de deletar
      if (valesParaProcessar.length > 0) {
        for (const vale of valesParaProcessar) {
          const { error } = await supabase
            .from('professional_advances')
            .update({
              discounted: true,
              closure_date: new Date().toISOString()
            })
            .eq('id', vale.id);
          
          if (error) {
            console.error(`Erro ao marcar vale ${vale.id} como descontado:`, error);
          }
        }
      }
      
      console.log(`Fechamento de caixa registrado com ID ${fechamentoData.id}, contendo ${professionalClosures.length} serviços e ${valesParaProcessar.length} vales descontados.`);
      
      // Limpar o estado dos vales
      setValesPendentes([]);
      setTotalValesSelecionados(0);
      
      // Exibir mensagem de sucesso e atualizar a interface
      alert(`Caixa fechado com sucesso!`);
      setIsFechamentoPendente(false);
      
      // Buscar fechamentos atualizados
      fetchFechamentosAnteriores();
      
      // Recarregar os dados para atualizar a interface
      fetchCaixaData(fixedStartDate, fixedEndDate);
    } catch (error) {
      console.error('Erro ao fechar caixa:', error);
      alert('Erro ao fechar caixa. Verifique o console para mais detalhes.');
    } finally {
      setLoadingFechamento(false);
    }
  };

  // Função assíncrona para buscar os detalhes de um serviço pelo ID
  const fetchServiceDetails = async (serviceId: string) => {
    try {
      // Validar se o serviceId é um UUID válido
      const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serviceId);
      
      if (!isValidUUID) {
        console.log(`Ignorando busca de serviço com ID inválido: ${serviceId}`);
        return null;
      }
      
      const query = supabase.from('services').select('name, price, commission');
      const { data, error } = await safeUuidEq(query, 'id', serviceId).single();
        
      if (error) {
        console.error('Erro ao buscar detalhes do serviço:', error);
        return null;
      }
      
      return data;
    } catch (e) {
      console.error('Exceção ao buscar serviço:', e);
      return null;
    }
  };

  // Função para buscar vales pendentes do profissional
  const fetchValesPendentes = async (professionalId: string) => {
    console.log('Buscando vales pendentes para o profissional:', professionalId);
    if (!professionalId) return;
    
    try {
      const { data, error } = await supabase
        .from('professional_advances')
        .select('id, value, created_at, professional_id, professionals(name)')
        .eq('professional_id', professionalId)
        .or('discounted.is.null,discounted.eq.false'); // Apenas vales não descontados
        
      if (error) {
        console.error('Erro ao buscar vales:', error);
        return;
      }
      
      console.log('Vales encontrados:', data);
      
      if (data && data.length > 0) {
        // Mapear os dados para o formato ValePendente
        const valesComSelecao = data.map(vale => ({
          id: vale.id,
          value: Number(vale.value),
          created_at: vale.created_at,
          professional_id: vale.professional_id,
          professional: {
            name: ((vale.professionals as any)?.name) || 'Profissional não especificado'
          },
          selecionado: false // Inicialmente nenhum vale está selecionado
        }));
        
        setValesPendentes(valesComSelecao);
        
        // Calcular o total dos vales selecionados inicialmente
        const total = valesComSelecao.reduce((sum, vale) => 
          vale.selecionado ? sum + Number(vale.value) : sum, 0
        );
        setTotalValesSelecionados(total);
        
        console.log('Vales formatados para o componente:', valesComSelecao);
      } else {
        setValesPendentes([]);
        setTotalValesSelecionados(0);
      }
    } catch (e) {
      console.error('Erro inesperado ao buscar vales:', e);
    }
  };
  
  // Função para alternar a seleção de um vale
  const toggleValeSelecao = (valeId: string) => {
    const novosVales = valesPendentes.map(vale => {
      if (vale.id === valeId) {
        return { ...vale, selecionado: !vale.selecionado };
      }
      return vale;
    });
    
    setValesPendentes(novosVales);
    
    // Recalcular o total dos vales selecionados
    const novoTotal = novosVales.reduce((sum, vale) => 
      vale.selecionado ? sum + Number(vale.value) : sum, 0
    );
    setTotalValesSelecionados(novoTotal);
  };

  // Efeito para buscar vales pendentes quando um profissional for selecionado
  useEffect(() => {
    if (selectedProfessional) {
      fetchValesPendentes(selectedProfessional);
    } else {
      setValesPendentes([]);
      setTotalValesSelecionados(0);
    }
  }, [selectedProfessional]);

  // Estilos personalizados para o calendário - simplificados
  const calendarStyles = `
    .period-calendar {
      font-size: 1rem !important;
      width: 320px !important;
      max-width: 100% !important;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05) !important;
      border: 1px solid #e5e7eb !important;
      margin-top: 8px !important;
      z-index: 1000 !important;
    }
    
    .period-calendar .react-datepicker__month-container {
      width: 320px !important;
      max-width: 100% !important;
    }
    
    .period-calendar .react-datepicker__day {
      width: 2.2rem !important;
      height: 2.2rem !important;
      line-height: 2.2rem !important;
      margin: 0.2rem !important;
      font-size: 0.95rem !important;
    }
    
    .period-calendar .react-datepicker__day-name {
      width: 2.2rem !important;
      margin: 0.2rem !important;
      font-size: 0.85rem !important;
    }
    
    .period-calendar .react-datepicker__header {
      padding-top: 1rem !important;
      padding-bottom: 1rem !important;
    }
    
    .period-calendar .react-datepicker__current-month {
      font-size: 1.1rem !important;
      margin-bottom: 0.7rem !important;
    }
    
    .period-calendar .react-datepicker__navigation {
      top: 1.2rem !important;
    }
    
    .date-selector-input {
      cursor: pointer !important;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236366F1'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'%3E%3C/path%3E%3C/svg%3E") !important;
      background-repeat: no-repeat !important;
      background-position: right 10px center !important;
      background-size: 20px 20px !important;
      padding-right: 35px !important;
      transition: all 0.2s !important;
    }
    
    .date-selector-input:hover {
      border-color: #9ca3af !important;
    }
    
    .date-selector-input:focus {
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1) !important;
      border-color: #6366f1 !important;
      outline: none !important;
    }
  `;

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{calendarStyles}</style>
      
      {/* Container principal otimizado para mobile */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-6">
        
        {/* Header responsivo */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col gap-4 sm:xl:flex-row sm:xl:justify-between sm:xl:items-center sm:gap-6">
            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 flex items-center">
                <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500 mr-2 sm:mr-3" />
                <span className="hidden sm:inline">Caixa por Profissional</span>
                <span className="sm:hidden">Caixa</span>
              </h3>
              <p className="text-gray-500 mt-1 text-xs sm:text-sm">
                <span className="hidden sm:inline">Gerencie fechamentos e histórico financeiro</span>
                <span className="sm:hidden">Fechamentos e histórico</span>
              </p>
            </div>
          
            {/* Botão de histórico responsivo */}
            <button
              type="button"
              className="inline-flex items-center justify-center px-3 py-2 sm:px-4 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors w-full sm:w-auto"
              onClick={() => {
                if (selectedProfessional) {
                  fetchFechamentosAnteriores();
                } else {
                  alert('Por favor, selecione um profissional para ver o histórico de fechamentos.');
                }
              }}
            >
              <History className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Ver Histórico</span>
              <span className="sm:hidden">Histórico</span>
            </button>
          </div>
        </div>
        
        {/* Seção de filtros otimizada para mobile */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex items-center mb-3 sm:mb-4">
            <Filter className="h-4 w-4 text-gray-500 mr-2" />
            <h4 className="text-sm sm:text-base font-medium text-gray-900">Filtros</h4>
          </div>
              
          {/* Layout responsivo - stack em mobile, grid em desktop */}
          <div className="flex flex-col gap-3 sm:grid sm:grid-cols-1 lg:grid-cols-12 lg:gap-4 lg:items-end">
            
            {/* Seleção de profissional responsiva */}
            <div className="lg:col-span-4">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                Profissional
              </label>
              <button
                type="button"
                onClick={() => setShowProfessionalModal(true)}
                className="w-full px-3 py-3 sm:py-2 border border-gray-300 rounded-md text-sm flex items-center justify-between bg-white hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center min-w-0">
                  <User className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                  {selectedProfessional ? (
                    <span className="text-gray-900 truncate">
                      {professionals.find(p => p.id === selectedProfessional)?.name}
                    </span>
                  ) : (
                    <span className="text-gray-500">
                      <span className="hidden sm:inline">Selecionar profissional</span>
                      <span className="sm:hidden">Selecionar</span>
                    </span>
                  )}
                </div>
                <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
              </button>
            </div>
            
            {/* Seleção de período responsiva */}
            <div className="lg:col-span-5">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                Período
              </label>
              <button
                type="button"
                onClick={() => setShowPeriodModal(true)}
                className="w-full flex items-center justify-between px-3 py-3 sm:py-2 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center min-w-0">
                  <CalendarRange className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                  <span className="hidden sm:inline">Período:</span>
                </div>
                <span className="text-gray-900 bg-gray-100 px-2 py-1 rounded text-xs truncate ml-2">
                  {getDateRangeText()}
                </span>
              </button>
            </div>
          
            {/* Botão de buscar responsivo */}
            <div className="lg:col-span-3">
              <button
                type="button"
                className="w-full inline-flex items-center justify-center px-4 py-3 sm:py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                onClick={handleApplyFilter}
                disabled={!selectedProfessional || loadingResults}
              >
                {loadingResults ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="hidden sm:inline">Buscando...</span>
                    <span className="sm:hidden">...</span>
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Buscar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        
        {/* Modal de seleção de profissional otimizado para mobile */}
        {showProfessionalModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white rounded-t-lg sm:rounded-lg shadow-xl w-full sm:max-w-md sm:mx-4 max-h-[90vh] sm:max-h-[80vh] flex flex-col">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-medium text-gray-900">
                  <span className="hidden sm:inline">Selecionar Profissional</span>
                  <span className="sm:hidden">Profissional</span>
                </h3>
                <button 
                  onClick={() => setShowProfessionalModal(false)}
                  className="text-gray-400 hover:text-gray-500 p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="overflow-y-auto flex-1 p-4">
                <div className="space-y-2">
                  {professionals.map((professional) => (
                    <button
                      key={professional.id}
                      onClick={() => {
                        setSelectedProfessional(professional.id);
                        setSelectedProfessionalName(professional.name);
                        setShowProfessionalModal(false);
                        
                        let fixedStartDate = new Date(startDate);
                        let fixedEndDate = new Date(endDate);
                        
                        fixedStartDate.setHours(0, 0, 0, 0);
                        fixedEndDate.setHours(23, 59, 59, 999);
                        
                        handleProfessionalCashDetail(professional.id);
                        
                        fetchCaixaData(fixedStartDate, fixedEndDate)
                          .catch(error => {
                            console.error("Erro ao processar dados do caixa após seleção de profissional:", error);
                            setLoadingResults(false);
                          });
                      }}
                      className={`
                        w-full px-3 py-4 sm:py-3 text-left hover:bg-gray-50 transition-colors rounded-md flex items-center
                        ${selectedProfessional === professional.id 
                          ? 'bg-indigo-50 border border-indigo-200' 
                          : 'border border-transparent'
                        }
                      `}
                    >
                      <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center mr-3 flex-shrink-0">
                        <User className="h-4 w-4 text-gray-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 text-sm sm:text-base truncate">{professional.name}</div>
                      </div>
                      {selectedProfessional === professional.id && (
                        <Check className="h-4 w-4 text-indigo-600 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Modal de seleção de período otimizado para mobile */}
        {showPeriodModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white rounded-t-lg sm:rounded-lg shadow-xl w-full sm:max-w-lg sm:mx-4 max-h-[90vh] sm:max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-base sm:text-lg font-medium text-gray-900">
                  <span className="hidden sm:inline">Selecionar Período</span>
                  <span className="sm:hidden">Período</span>
                </h3>
                <button 
                  onClick={() => setShowPeriodModal(false)}
                  className="text-gray-400 hover:text-gray-500 p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="p-4 overflow-y-auto flex-1">
                {/* Seleção rápida de período para mobile */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Períodos Rápidos</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      onClick={() => {
                        applyQuickPeriod(0);
                        setShowPeriodModal(false);
                      }}
                      className="px-3 py-3 sm:py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      Hoje
                    </button>
                    <button
                      onClick={() => {
                        applyQuickPeriod(7);
                        setShowPeriodModal(false);
                      }}
                      className="px-3 py-3 sm:py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      7 dias
                    </button>
                    <button
                      onClick={() => {
                        applyQuickPeriod(15);
                        setShowPeriodModal(false);
                      }}
                      className="px-3 py-3 sm:py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      15 dias
                    </button>
                    <button
                      onClick={() => {
                        applyQuickPeriod(30);
                        setShowPeriodModal(false);
                      }}
                      className="px-3 py-3 sm:py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      30 dias
                    </button>
                  </div>
                </div>
                
                {/* Seleção personalizada responsiva */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Período Personalizado</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Data Inicial</label>
                      <DatePicker
                        selected={startDate}
                        onChange={(date: Date) => setStartDate(date)}
                        dateFormat="dd/MM/yyyy"
                        locale={ptBR}
                        className="w-full px-3 py-3 sm:py-2 border border-gray-300 rounded-md text-sm date-selector-input"
                        onChangeRaw={e => e.preventDefault()}
                        showMonthDropdown
                        showYearDropdown
                        dropdownMode="select"
                        calendarClassName="period-calendar"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Data Final</label>
                      <DatePicker
                        selected={endDate}
                        onChange={(date: Date) => setEndDate(date)}
                        dateFormat="dd/MM/yyyy"
                        locale={ptBR}
                        className="w-full px-3 py-3 sm:py-2 border border-gray-300 rounded-md text-sm date-selector-input"
                        onChangeRaw={e => e.preventDefault()}
                        showMonthDropdown
                        showYearDropdown
                        dropdownMode="select"
                        calendarClassName="period-calendar"
                        minDate={startDate}
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Botões de ação responsivos */}
              <div className="p-4 border-t border-gray-200 flex flex-col sm:flex-row gap-3 sm:justify-end">
                <button
                  onClick={() => setShowPeriodModal(false)}
                  className="px-4 py-3 sm:py-2 text-sm border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors order-2 sm:order-1"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    setShowPeriodModal(false);
                    
                    if (selectedProfessional) {
                      let fixedStartDate = new Date(startDate);
                      let fixedEndDate = new Date(endDate);
                      
                      fixedStartDate.setHours(0, 0, 0, 0);
                      fixedEndDate.setHours(23, 59, 59, 999);
                      
                      handleProfessionalCashDetail(selectedProfessional);
                      
                      fetchCaixaData(fixedStartDate, fixedEndDate)
                        .catch(error => {
                          console.error("Erro ao processar dados do caixa após seleção de período personalizado:", error);
                          setLoadingResults(false);
                        });
                    }
                  }}
                  className="px-4 py-3 sm:py-2 text-sm border border-transparent rounded-md text-white bg-indigo-600 hover:bg-indigo-700 transition-colors order-1 sm:order-2"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Estado de carregamento otimizado para mobile */}
        {loadingResults && !showResults && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 sm:p-12">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 rounded-full mb-4">
                <svg className="animate-spin h-5 w-5 sm:h-6 sm:w-6 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
                <span className="hidden sm:inline">Carregando dados</span>
                <span className="sm:hidden">Carregando</span>
              </h3>
              <p className="text-xs sm:text-sm text-gray-500">
                <span className="hidden sm:inline">Processando informações...</span>
                <span className="sm:hidden">Processando...</span>
              </p>
            </div>
          </div>
        )}
        
        {/* Seção de Resultados otimizada para mobile */}
        {showResults && (
          <div className="space-y-4 sm:space-y-6">
            {/* Header dos resultados responsivo */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
              <div className="flex flex-col gap-3 sm:xl:flex-row sm:xl:justify-between sm:xl:items-center sm:gap-4">
                <div>
                  <h4 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
                    <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-gray-500 mr-2" />
                    <span className="hidden sm:inline">
                      {isVisualizandoHistorico ? (
                        <>Histórico de Fechamento: <span className="text-indigo-600">{selectedProfessionalName}</span></>
                      ) : (
                        <>Fechamento de Caixa: <span className="text-indigo-600">{selectedProfessionalName}</span></>
                      )}
                    </span>
                    <span className="sm:hidden text-indigo-600">{selectedProfessionalName}</span>
                  </h4>
                  <p className="text-gray-500 mt-1 text-xs sm:text-sm">
                    {isVisualizandoHistorico ? (
                      <span className="hidden sm:inline">Fechamentos já processados</span>
                    ) : (
                      <span className="hidden sm:inline">Fechamentos do período selecionado</span>
                    )}
                    <span className="sm:hidden">
                      {isVisualizandoHistorico ? 'Histórico' : 'Período atual'}
                    </span>
                  </p>
                </div>
              </div>
            </div>
            
            {/* Tabela de Fechamentos otimizada para mobile */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 bg-gray-50">
                <h5 className="text-sm sm:text-base font-medium text-gray-800 flex items-center">
                  <Printer className="h-4 w-4 text-gray-500 mr-2" />
                  <span className="hidden sm:inline">
                    {isVisualizandoHistorico ? 'Fechamentos Concluídos' : 'Serviços do Período'}
                  </span>
                  <span className="sm:hidden">
                    {isVisualizandoHistorico ? 'Concluídos' : 'Serviços'}
                  </span>
                </h5>
              </div>
              
              {professionalClosures.length > 0 ? (
                <>
                  {/* Versão mobile - Cards */}
                  <div className="block sm:hidden">
                    <div className="divide-y divide-gray-200">
                      {professionalClosures.map((closure) => (
                        <div key={closure.id} className="p-4 hover:bg-gray-50">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {closure.service_names || 'Serviço não especificado'}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {closure.client_name || 'Cliente não especificado'}
                              </p>
                            </div>
                            <div className="text-right ml-3">
                              <p className="text-sm font-semibold text-green-600">
                                {formatCurrency(closure.net_service_value)}
                              </p>
                              <p className="text-xs text-gray-500">
                                {format(parseISO(closure.created_at), 'dd/MM')}
                              </p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="bg-gray-50 p-2 rounded text-center">
                              <span className="block text-gray-500">Bruto</span>
                              <span className="font-medium text-gray-900">
                                {formatCurrency(closure.gross_service_value)}
                              </span>
                            </div>
                            <div className="bg-red-50 p-2 rounded text-center">
                              <span className="block text-gray-500">Taxa</span>
                              <span className="font-medium text-red-600">
                                -{formatCurrency(closure.payment_fee_value)}
                              </span>
                            </div>
                            <div className="bg-blue-50 p-2 rounded text-center">
                              <span className="block text-gray-500">Comissão</span>
                              <span className="font-medium text-gray-900">
                                {closure.commission_percentage}%
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Versão desktop - Tabela */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Data
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Cliente
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Serviço
                          </th>
                          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Valor Bruto
                          </th>
                          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Taxa
                          </th>
                          <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            % Comissão
                          </th>
                          <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Valor Líquido
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {professionalClosures.map((closure) => (
                          <tr key={closure.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {format(parseISO(closure.created_at), 'dd/MM/yyyy')}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {closure.client_name || <span className="text-gray-400 italic">Cliente não especificado</span>}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {closure.service_names || <span className="text-gray-400 italic">Serviço não especificado</span>}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900 text-right">
                              {formatCurrency(closure.gross_service_value)}
                            </td>
                            <td className="px-6 py-4 text-sm text-red-600 text-right">
                              -{formatCurrency(closure.payment_fee_value)}
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900 text-center">
                              {closure.commission_percentage}%
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-green-600 text-right">
                              {formatCurrency(closure.net_service_value)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Total dos fechamentos responsivo */}
                  <div className="bg-green-50 border-t border-green-200 p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                      <span className="text-base sm:text-lg font-semibold text-gray-900 flex items-center">
                        <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 mr-2" />
                        <span className="hidden sm:inline">Total Líquido dos Fechamentos:</span>
                        <span className="sm:hidden">Total Líquido:</span>
                      </span>
                      <span className="text-lg sm:text-xl font-bold text-green-600">
                        {formatCurrency(totalLiquidoFechamentos)}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 sm:py-12">
                  <AlertCircle className="h-8 w-8 sm:h-12 sm:w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
                    <span className="hidden sm:inline">Nenhum fechamento encontrado</span>
                    <span className="sm:hidden">Nenhum fechamento</span>
                  </h3>
                  <p className="text-sm text-gray-500">
                    <span className="hidden sm:inline">Não há fechamentos para este profissional no período selecionado.</span>
                    <span className="sm:hidden">Nenhum fechamento no período.</span>
                  </p>
                </div>
              )}
            </div>

            {/* Vales pendentes otimizados para mobile */}
            {valesPendentes.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-orange-50 px-4 py-3 sm:px-6 sm:py-4 border-b border-orange-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 mr-2" />
                      <div>
                        <h4 className="text-sm sm:text-base font-medium text-orange-900">
                          <span className="hidden sm:inline">Vales Pendentes ({valesPendentes.length})</span>
                          <span className="sm:hidden">Vales ({valesPendentes.length})</span>
                        </h4>
                        <p className="text-xs sm:text-sm text-orange-700">
                          <span className="hidden sm:inline">Selecione os vales a descontar</span>
                          <span className="sm:hidden">Selecione para descontar</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 sm:p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {valesPendentes.map(vale => (
                      <div 
                        key={vale.id} 
                        className={`p-3 sm:p-4 rounded-md border-2 cursor-pointer transition-all ${
                          vale.selecionado 
                            ? 'bg-orange-50 border-orange-300' 
                            : 'bg-white border-gray-200 hover:border-orange-200'
                        }`}
                        onClick={() => toggleValeSelecao(vale.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center min-w-0">
                            <input
                              type="checkbox"
                              checked={vale.selecionado}
                              onChange={() => toggleValeSelecao(vale.id)}
                              className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded flex-shrink-0"
                            />
                            <div className="ml-3 min-w-0">
                              <p className="text-sm font-medium text-gray-900">
                                {format(parseISO(vale.created_at), 'dd/MM/yyyy')}
                              </p>
                              <p className="text-xs text-gray-500 truncate">
                                <span className="hidden sm:inline">Vale de adiantamento</span>
                                <span className="sm:hidden">Vale</span>
                              </p>
                            </div>
                          </div>
                          <div className="text-sm sm:text-lg font-semibold text-gray-900 ml-2">
                            {formatCurrency(Number(vale.value))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                        
                <div className="bg-orange-50 border-t border-orange-200 p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                    <span className="text-sm sm:text-base font-medium text-orange-900">
                      <span className="hidden sm:inline">Total de Vales Selecionados:</span>
                      <span className="sm:hidden">Vales Selecionados:</span>
                    </span>
                    <span className="text-base sm:text-lg font-semibold text-orange-700">
                      -{formatCurrency(totalValesSelecionados)}
                    </span>
                  </div>
                </div>
                        
                <div className="bg-gray-100 border-t border-gray-300 p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                    <span className="text-base sm:text-lg font-semibold text-gray-900">
                      <span className="hidden sm:inline">Total Líquido Final (Fechamentos - Vales):</span>
                      <span className="sm:hidden">Total Final:</span>
                    </span>
                    <span className="text-lg sm:text-xl font-bold text-green-600">
                      {formatCurrency(totalLiquidoFechamentos - totalValesSelecionados)}
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Botão de fechar caixa otimizado para mobile */}
            <div className="flex justify-center px-4 sm:px-0">
              <button
                type="button"
                className={`w-full sm:w-auto inline-flex items-center justify-center px-6 py-4 sm:py-3 border border-transparent rounded-md text-base font-medium text-white transition-colors ${
                  isVisualizandoHistorico 
                    ? "bg-indigo-600 hover:bg-indigo-700" 
                    : "bg-green-600 hover:bg-green-700"
                }`}
                onClick={isVisualizandoHistorico ? () => {
                  setIsVisualizandoHistorico(false);
                  setIsHistoricoModalOpen(true);
                } : handleFecharCaixa}
                disabled={!isVisualizandoHistorico && (loadingFechamento || (professionalClosures.length === 0 && totalValesSelecionados === 0))}
              >
                {loadingFechamento ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="hidden sm:inline">Processando...</span>
                    <span className="sm:hidden">...</span>
                  </>
                ) : isVisualizandoHistorico ? (
                  <>
                    <ArrowLeft className="h-5 w-5 mr-2" />
                    <span className="hidden sm:inline">Voltar ao Histórico</span>
                    <span className="sm:hidden">Voltar</span>
                  </>
                ) : (
                  <>
                    <Save className="h-5 w-5 mr-2" />
                    <span className="hidden sm:inline">Fechar Caixa</span>
                    <span className="sm:hidden">Fechar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
        
      {/* Modal do histórico mantido igual */}
      <HistoricoModal
        isOpen={isHistoricoModalOpen}
        onClose={() => setIsHistoricoModalOpen(false)}
        fechamentos={fechamentosAnteriores}
        profissionalNome={selectedProfessionalName}
        limparHistorico={limparHistoricoFechamentos}
      />
    </div>
  );
};

export default CaixaOperacao; 