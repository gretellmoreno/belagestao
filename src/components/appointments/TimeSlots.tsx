import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { format, parseISO, isToday, isSameDay, addMinutes, isWithinInterval, addDays, subDays } from 'date-fns';
import { useAppointments } from '../../contexts/AppointmentContext';
import { getProfessionals, type Professional } from '../../lib/professionalService';
import { getServices, type Service } from '../../lib/serviceService';
import { getProducts, type Product } from '../../lib/productService';
import { toast } from 'react-hot-toast';
import type { Appointment } from '../../lib/appointmentService';
import { 
  XCircle, CheckCircle, 
  Trash, Clock, 
  Check, X, 
  Loader2 
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { 
  normalizeTime, 
  formatAppointmentDateTime,
  formatDateToLocal
} from '../../lib/dateUtils';
import { PaymentMethod } from '../../types';
import CheckoutModal from '../checkout/CheckoutModal';
import AgendaQuickAppointment from './AgendaQuickAppointment';
// Importar componentes modulares
import TimeSlotHeader from './timeSlots/TimeSlotHeader';
import TimeSlotGrid from './timeSlots/TimeSlotGrid';
import TimeSlotPopupMenu from './timeSlots/TimeSlotPopupMenu';
import { format as formatDateFns } from 'date-fns';
import { finalizeAppointment } from '../../lib/appointmentService';
import { useAgendaData } from '../../hooks/useAgendaData';

// Estilos personalizados para a barra de rolagem
const scrollbarStyles = `
  /* Estilos da barra de rolagem para navegadores baseados em WebKit (Chrome, Safari) */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  
  ::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 10px;
  }
  
  ::-webkit-scrollbar-thumb {
    background-color: #c1c1c1;
    border-radius: 10px;
    border: 1px solid #f1f1f1;
  }
  
  ::-webkit-scrollbar-thumb:hover {
    background-color: #a8a8a8;
  }
  
  /* Para Firefox */
  * {
    scrollbar-width: thin;
    scrollbar-color: #c1c1c1 #f1f1f1;
  }
  
  /* Garantir que a barra de rolagem não interfira no layout */
  .scroll-container {
    scrollbar-gutter: stable;
  }
  
  /* Prevenir qualquer overflow horizontal */
  .agenda-container {
    overflow-x: hidden !important;
  }
`;

interface TimeSlotsProps {
  selectedDate: Date;
  onEditAppointment?: (appointment: any) => void;
}

const WORKING_HOURS_START = 8; // 8 AM
const WORKING_HOURS_END = 23; // 11 PM (para incluir slots até 22:45)
const PROFESSIONAL_PAGE_SIZE = 4; // Número de profissionais por página

// Função para mapear um horário para um índice de posição vertical na grade
const mapTimeToSlotIndex = (time: string): number => {
  const normalizedTime = normalizeTime(time);
  const [hours, minutes] = normalizedTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  const startOfDayMinutes = WORKING_HOURS_START * 60;
  return Math.floor((totalMinutes - startOfDayMinutes) / 15);
};

// Função para renderizar comanda corrigindo fuso horário
const renderModalDateTime = (date: string, time: string): string => {
  try {
  return formatAppointmentDateTime(date, time);
  } catch (error) {
    console.error('Erro ao formatar data/hora do modal:', error);
    return `${date} às ${time}`;
  }
};

interface SelectedProduct {
  id: string;
  quantity: number;
  customPrice?: number;
}

// Adicionar esta função para lidar com os diferentes status de agendamento
const getStatusBadge = (status: string) => {
  const statusMap: Record<string, { text: string, className: string }> = {
    'confirmado': { text: '✓', className: 'text-green-500' },
    'pendente': { text: '⏱', className: 'text-yellow-500' },
    'cancelado': { text: '✗', className: 'text-red-500' },
    'concluído': { text: '✓', className: 'text-blue-500' },
  };

  const statusLower = status.toLowerCase();
  const statusInfo = statusMap[statusLower] || { text: status, className: 'text-gray-500' };
  
  return (
    <span className={`inline-flex items-center justify-center ${statusInfo.className}`}>
      {statusInfo.text}
    </span>
  );
};

// A função safeFormat usa formatDateFns para formatar datas
const safeFormat = (date: Date | string, formatStr: string, options?: any) => {
  try {
    if (!date) return '';
    if (typeof date === 'string') {
      // Tenta converter a string para data antes de formatar
      return formatDateFns(new Date(date), formatStr);
    }
    return formatDateFns(date, formatStr);
  } catch (error) {
    console.error('Erro ao formatar data:', error);
    return '';
  }
};

// Verifica se o agendamento tem um cliente ou é anônimo
const getClientName = (appointment: Appointment) => {
  if (!appointment.client_id) {
    return <span className="text-green-700 font-medium">Cliente não especificado</span>;
  }
  
  if (!appointment.client) {
    return <span>Cliente ID: {appointment.client_id}</span>;
  }
  
  if (typeof appointment.client === 'string') {
    return appointment.client || <span className="text-green-700 font-color">Cliente não especificado</span>;
  }
  
  return appointment.client.name || <span className="text-green-700 font-medium">Cliente não especificado</span>;
};

// Definir um tipo local para o componente, que seja mais flexível que a interface original
interface DragState {
  appointment: any;
  isDragging: boolean;
  clientX: number;
  clientY: number;
}

// Interface estendida para incluir propriedades internas de controle
interface ExtendedAppointment extends Appointment {
  _updating?: boolean;
  _transition?: boolean;
  _lastUpdated?: number;
}

export default function TimeSlots({ selectedDate, onEditAppointment }: TimeSlotsProps) {
  const { 
    appointments, 
    loadAppointmentsByDate, 
    addAppointment, 
    updateAppointment, 
    loading: appointmentsLoading,
    clearCache,
    setAppointments
  } = useAppointments();

  // Substituir os múltiplos hooks de cache por um único hook
  const { 
    professionals,
    services,
    paymentMethods,
    loading: baseDataLoading,
    error: baseDataError
  } = useAgendaData();

  // Hook para detectar mudanças no tamanho da tela
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Altura para slots - responsiva baseada no tamanho da tela
  const SLOT_HEIGHT = windowSize.width < 768 ? 18 : (windowSize.width < 1024 ? 22 : 25);
  const HOUR_HEIGHT = SLOT_HEIGHT * 4; // Altura de uma hora completa (4 slots de 15 minutos)

  // Remover estados e hooks não utilizados
  const [error, setError] = useState<string | null>(baseDataError?.message || null);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [appointmentDetailsOpen, setAppointmentDetailsOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  
  // Adicionar os estados necessários para handleEditAppointment
  const [slotDate, setSlotDate] = useState<string>('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{time: string, professionalId: string}>({time: '', professionalId: ''});
  const [editingAppointmentId, setEditingAppointmentId] = useState<string>('');
  
  // Estado para o menu emergente unificado
  const [popupMenu, setPopupMenu] = useState<{
    time: string;
    professionalId: string;
    top: number;
    left: number;
    height: number;
    visible: boolean;
    x: number;
    y: number;
    appointmentId?: string;
    isEditing?: boolean;
  } | null>(null);
  
  // Estados para o modal de confirmação
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [additionalProducts, setAdditionalProducts] = useState('');
  const [skippedServices, setSkippedServices] = useState('');
  const [selectedProductsData, setSelectedProductsData] = useState<{
    [key: string]: { quantity: number; price: number; originalPrice: number }
  }>({});
  const [selectedServicesData, setSelectedServicesData] = useState<{
    [key: string]: { price: number; originalPrice: number }
  }>({});

  // Estados para modais de produtos e serviços
  const [showProductsModal, setShowProductsModal] = useState(false);
  const [showServicesModal, setShowServicesModal] = useState(false);
  
  // Estado para modal de edição de confirmação
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);

  // Estados para busca e filtros
  const [searchService, setSearchService] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);

  // Estado para método de pagamento
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [paymentMethodId, setPaymentMethodId] = useState<string>('');
  const [confirming, setConfirming] = useState(false);

  // Usar dados dos produtos diretamente dos props do contexto
  const products: Product[] = [];

  // Efeito para atualizar produtos filtrados quando o modal é aberto ou quando há busca
  useEffect(() => {
    if (showProductsModal || productSearch) {
      const filtered = products.filter(product =>
        product.name.toLowerCase().includes(productSearch.toLowerCase())
      );
      setFilteredProducts(filtered);
    }
  }, [showProductsModal, productSearch, products]);

  // Efeito para carregar agendamentos - otimizado com debounce
  useEffect(() => {
    const loadAppointments = async () => {
      if (!selectedDate) return;
      
      const dateStr = safeFormat(selectedDate, 'yyyy-MM-dd');
      console.log('[TimeSlots] Carregando agendamentos para:', dateStr);
      
      try {
        await loadAppointmentsByDate(dateStr);
      } catch (error) {
        console.error('[TimeSlots] Erro ao carregar agendamentos:', error);
        setError('Erro ao carregar agendamentos');
      }
    };

    // Usar debounce para evitar múltiplas chamadas em sequência
    const timeoutId = setTimeout(loadAppointments, 300);
    return () => clearTimeout(timeoutId);
  }, [selectedDate]);

  // Remover efeitos desnecessários e manter apenas os essenciais
  useEffect(() => {
    const handleProfessionalUpdated = () => {
      console.log('[TimeSlots] Evento de atualização de profissional detectado');
      // Não precisamos mais recarregar profissionais manualmente
      // O useAgendaData já cuida disso através das subscriptions
    };

    window.addEventListener('professional_updated', handleProfessionalUpdated);
    return () => window.removeEventListener('professional_updated', handleProfessionalUpdated);
  }, []);

  // Efeito para exibir agendamentos carregados
  useEffect(() => {
    if (appointments.length === 0) {
      console.log('TimeSlots - ALERTA: Nenhum agendamento para exibir');
    } else {
      console.log(`TimeSlots - ${appointments.length} agendamentos carregados no componente`);
    }
  }, [appointments]);

  // Adicionar useEffect para ouvir eventos de atualização de agendamento
  useEffect(() => {
    const handleAppointmentUpdate = (event: CustomEvent) => {
      const { id, date, status, forceRefresh, appointmentData } = event.detail;
      console.log('[TimeSlots] Recebido evento de atualização:', event.detail);

      // Verificar se a data do evento corresponde à data selecionada
      const formattedSelectedDate = format(selectedDate, 'yyyy-MM-dd');
      if (date === formattedSelectedDate) {
        // Atualização imediata do estado local para feedback instantâneo na UI
        setAppointments(currentAppointments => {
          // Sempre criar uma cópia para manter a imutabilidade
          const updatedAppointments = [...currentAppointments];
          const index = updatedAppointments.findIndex(apt => apt.id === id);
          
          if (index !== -1) {
            console.log('[TimeSlots] Atualizando agendamento localmente:', { 
              oldStatus: updatedAppointments[index].status,
              newStatus: status || (appointmentData?.status ?? 'agendado')
            });
            
            // Se temos dados completos do agendamento, usar eles
            if (appointmentData) {
              // Preservar a referência para evitar flickering
              updatedAppointments[index] = {
                ...updatedAppointments[index], // Manter propriedades existentes
                ...appointmentData,           // Sobrescrever com novos dados
                status: status || appointmentData.status || 'agendado',
                // Garantir que os serviços estejam no formato correto
                appointment_services: appointmentData.appointment_services || [],
                services_data: appointmentData.services_data || [],
                services: appointmentData.services || [],
                // Remover referências a campos obsoletos
                _updating: false,
                _transition: true,
                _lastUpdated: Date.now()
              } as any;
              
              console.log('[TimeSlots] Agendamento atualizado com serviços:', {
                id: updatedAppointments[index].id,
                appointment_services: updatedAppointments[index].appointment_services,
                total_duration: updatedAppointments[index].appointment_services?.reduce(
                  (total, service) => total + (service.custom_time || 
                    (service.service?.estimated_time || 30)), 0
                ) || 30
              });
            } else {
              // Se não temos dados completos, atualizar apenas o status
              updatedAppointments[index] = {
                ...updatedAppointments[index],
                status: status || 'agendado',
                updated_at: new Date().toISOString(),
                _updating: false,
                _transition: true,
                _lastUpdated: Date.now()
              } as any;
            }
          } else if (appointmentData) {
            // Se o agendamento não existe na lista, adicionar
            console.log('[TimeSlots] Adicionando novo agendamento à lista:', appointmentData);
            
            // Verificar se temos os serviços
            if (!appointmentData.appointment_services || appointmentData.appointment_services.length === 0) {
              console.log('[TimeSlots] ALERTA: Novo agendamento sem serviços detectado, buscando dados completos do backend');
              
              // Disparar a busca por dados completos em segundo plano
              setTimeout(async () => {
                try {
                  if (appointmentData.id) {
                    const { data: completeData, error } = await supabase
                      .from('appointments')
                      .select(`
                        *,
                        client:clients(*),
                        appointment_services(
                          service_id, custom_price, custom_time,
                          service:services(id, name, price, estimated_time)
                        )
                      `)
                      .eq('id', appointmentData.id)
                      .single();
                      
                    if (!error && completeData) {
                      console.log('[TimeSlots] Dados completos do novo agendamento:', completeData);
                      
                      // Atualizar o agendamento na lista com os dados completos
                      setAppointments(currAppts => {
                        return currAppts.map(apt => 
                          apt.id === appointmentData.id ? { ...apt, ...completeData } : apt
                        );
                      });
                    }
                  }
                } catch (err) {
                  console.error('Erro ao buscar dados completos:', err);
                }
              }, 100);
            }
            
            updatedAppointments.push({
              ...appointmentData,
              _updating: false,
              _transition: true,
              _lastUpdated: Date.now()
            } as any);
          }
          
          console.log('[TimeSlots] Estado de agendamentos atualizado otimisticamente', updatedAppointments.length);
          return updatedAppointments;
        });

        // Se forceRefresh=true, ainda recarregar do servidor, mas sem causar piscar na tela
        if (forceRefresh) {
          console.log('[TimeSlots] ForceRefresh ativo, recarregando dados do servidor sem causar flickering');
          setTimeout(async () => {
            try {
              await loadAppointmentsByDate(formattedSelectedDate, true);
              console.log('[TimeSlots] Agenda atualizada em segundo plano com sucesso');
            } catch (error) {
              console.error('[TimeSlots] Erro ao atualizar agenda em segundo plano:', error);
            }
          }, 500);
        }
      }
    };

    window.addEventListener('appointmentUpdated', handleAppointmentUpdate as EventListener);
    return () => {
      window.removeEventListener('appointmentUpdated', handleAppointmentUpdate as EventListener);
    };
  }, [selectedDate, loadAppointmentsByDate]);

  // Filtrar serviços baseado na busca com debounce
  const filteredServices = useMemo(() => {
    if (!searchService || !Array.isArray(services)) return [];
    const searchLower = searchService.toLowerCase();
    return services.filter((service) => {
      if (!service || typeof service !== 'object') return false;
      return (
        service.name.toLowerCase().includes(searchLower) ||
        (service.description?.toLowerCase() || '').includes(searchLower)
      );
    });
  }, [searchService, services]);

  // Função para atualizar dados após uma mudança
  const handleDataChange = useCallback(() => {
    const dateStr = safeFormat(selectedDate, 'yyyy-MM-dd');
    loadAppointmentsByDate(dateStr);
  }, [selectedDate, loadAppointmentsByDate]);

  // Função para confirmar atendimento com debounce
  const handleConfirmCompletion = async () => {
    if (!selectedAppointment) {
      toast.error('Nenhum atendimento selecionado');
      return;
    }

    if (!selectedPaymentMethod) {
      toast.error('Por favor, selecione um método de pagamento');
      return;
    }

    try {
      setConfirming(true);
      console.log('[TimeSlots] Iniciando fechamento da comanda', selectedAppointment.id);

      // Finalizar o agendamento
      const result = await finalizeAppointment(
        selectedAppointment.id, 
        selectedPaymentMethod.id.toString(),
        false // discountPaymentFee - por padrão false
      );
      
      if (result) {
        toast.success('Comanda fechada com sucesso!');
        console.log('[TimeSlots] Comanda fechada com sucesso, resultado:', result);
        // Evento já será disparado pela função finalizeAppointment
      } else {
        toast.error('Erro ao fechar comanda');
        console.log('[TimeSlots] Erro ao fechar comanda (nenhum resultado retornado)');
      }
      
      // Fechar modal e recarregar agendamentos
      setConfirming(false);
      setShowConfirmationModal(false);
      
      // GARANTIR recarregamento dos agendamentos para atualizar a vista
      const dateStr = safeFormat(selectedDate, 'yyyy-MM-dd');
      console.log('[TimeSlots] Forçando recarregamento da agenda após finalização', dateStr);
      
      // Forçar recarregamento completo com um pequeno delay para garantir que o evento já foi processado
      setTimeout(async () => {
        console.log('[TimeSlots] Executando recarregamento forçado após finalização');
        await loadAppointmentsByDate(dateStr, true); // Forçar recarregamento completo
        console.log('[TimeSlots] ✅ Agenda atualizada após finalização - total:', appointments.length);
      }, 100);
      
    } catch (error) {
      console.error('Erro ao fechar comanda:', error);
      toast.error('Erro ao fechar comanda');
      setConfirming(false);
    }
  };

  // Gerar slots de hora
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = WORKING_HOURS_START; hour < WORKING_HOURS_END; hour++) {
      for (let minute of [0, 15, 30, 45]) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(time);
      }
    }
    return slots;
  }, []);

  // Profissionais paginados
  const paginatedProfessionals = useMemo(() => {
    const start = currentPage * PROFESSIONAL_PAGE_SIZE;
    return professionals.slice(start, start + PROFESSIONAL_PAGE_SIZE);
  }, [professionals, currentPage]);

  const totalPages = Math.ceil(professionals.length / PROFESSIONAL_PAGE_SIZE);

  // Agrupar slots por hora
  const groupedTimeSlots = useMemo(() => {
    const grouped: { [hour: string]: string[] } = {};
    
    timeSlots.forEach(time => {
      const hour = time.substring(0, 2);
      if (!grouped[hour]) {
        grouped[hour] = [];
      }
      grouped[hour].push(time);
    });
    
    return grouped;
  }, [timeSlots]);

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Obtener agendamentos para um profissional e horário específico
  const getAppointmentsForSlot = (professionalId: string | undefined, slotTime: string) => {
    if (!professionalId || !appointments || !Array.isArray(appointments)) return [];
    
    // 🔧 CORREÇÃO CRÍTICA: Usar formatDateToLocal em vez de toISOString().split('T')[0]
    // Isso evita problemas de fuso horário que faziam agendamentos desaparecerem às 21h
    const currentDateStr = formatDateToLocal(selectedDate);
    
    return appointments.filter(appointment => {
      // Verificações de segurança
      if (!appointment || !appointment.date || !appointment.time) return false;
      
      // Formatar a data do agendamento da mesma forma
      const appointmentDate = appointment.date.split('T')[0];
      
      // Verificar se o profissional, data e hora correspondem
      const profMatches = appointment.professional_id === professionalId;
      const dateMatches = appointmentDate === currentDateStr;
      const isNotCanceled = appointment.status !== 'cancelado';
      const appointmentTime = normalizeTime(appointment.time);
      const startsInThisSlot = appointmentTime === slotTime;
      
      return profMatches && dateMatches && isNotCanceled && startsInThisSlot;
    }).sort((a, b) => {
      const timeA = normalizeTime(a.time);
      const timeB = normalizeTime(b.time);
      return timeA.localeCompare(timeB);
    });
  };

  const handleAppointmentClick = (appointment: Appointment) => {
    try {
      console.log('Clique no agendamento detectado:', appointment.id);
      
      // Calcular duração total a partir dos serviços
      const calculateDuration = () => {
        // Primeiro verificar appointment_services (novo formato)
        if (appointment.appointment_services && appointment.appointment_services.length > 0) {
          return appointment.appointment_services.reduce((total, service) => 
            total + (service.custom_time || 0), 0);
        }
        
        // Depois verificar services_relations
        if (appointment.services_relations && appointment.services_relations.length > 0) {
          return appointment.services_relations.reduce((total, service) => 
            total + ((service as any).custom_time || (service as any).duration || 0), 0);
        }
        
        if (appointment.services_data_json && appointment.services_data_json.length > 0) {
          // Usar type assertion para acessar propriedade duration que não existe no tipo
          return appointment.services_data_json.reduce((total, service) => 
            total + ((service as any).duration || 0), 0);
        }
        
        // Usar typecast para acessar a propriedade duration legada
        const anyAppointment = appointment as any;
        if (anyAppointment.duration) {
          return typeof anyAppointment.duration === 'string' 
            ? parseInt(anyAppointment.duration) 
            : anyAppointment.duration;
        }
        
        return 30; // Valor padrão
      };
      
      // Criar uma versão segura do objeto appointment
      const safeAppointment = {
        ...appointment,
        id: appointment.id || '',
        date: appointment.date || '',
        time: appointment.time || '',
        professional_id: appointment.professional_id || '',
        services: appointment.services || [],
        duration: calculateDuration(), // Usar a função para calcular duração
        status: appointment.status || 'agendado',
        client: appointment.client || null,
        professional: appointment.professional || null,
        notes: appointment.notes || '',
      };
      
      setSelectedAppointment(safeAppointment as unknown as Appointment);
      setAppointmentDetailsOpen(true);
      
      // Fechar qualquer popup menu que possa estar aberto
      setPopupMenu(null);
    } catch (error) {
      console.error('Erro ao abrir comanda:', error);
      toast.error('Erro ao abrir comanda');
    }
  };

  const handleEditAppointment = () => {
    if (!selectedAppointment) return;
    
    // Fechar o modal de detalhes
      setAppointmentDetailsOpen(false);
    
    // Configurar o estado para abrir o modal de agendamento em modo de edição
    setSlotDate(selectedAppointment.date);
    setSelectedTimeSlot({
      time: selectedAppointment.time || '08:00',
      professionalId: selectedAppointment.professional_id || '0',
    });
    
    // Passar o ID do agendamento para o modo de edição
    setEditingAppointmentId(selectedAppointment.id);
    
    // Guardar o ID do agendamento na janela global para ser acessível ao modal
    (window as any).editingAppointmentId = selectedAppointment.id;
    
    // Buscar o nome do profissional
    const professionalName = professionals.find(p => p.id === selectedAppointment.professional_id)?.name || 'Profissional';
    
    // Preparar os dados para o modal de agendamento
    const data = {
      time: selectedAppointment.time || '08:00',
      professionalId: selectedAppointment.professional_id || '0',
      professionalName: professionalName,
      appointmentId: selectedAppointment.id,
      isEditing: true
    };
    
    // Fechar o popup antes de abrir o modal
    setPopupMenu(null);
    
    // Chamar diretamente a função que abre o modal de agendamento
    console.log('Abrindo modal de edição com dados:', data);
    
    // Definir os dados e abrir o modal
    setFastAppointmentData(data);
    setTimeout(() => {
      setShowFastAppointmentForm(true);
    }, 100);
  };

  const closeAppointmentDetails = () => {
    setAppointmentDetailsOpen(false);
    setSelectedAppointment(null);
  };

  // Estados para arrastar y soltar (drag & drop)
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<{ 
    professionalId: string | undefined; 
    time: string 
  } | null>(null);

  // Estado para el menú emergente en clic de slot vacío
  const [showQuickAppointmentForm, setShowQuickAppointmentForm] = useState(false);
  const [showFastAppointmentForm, setShowFastAppointmentForm] = useState(false);
  const [fastAppointmentData, setFastAppointmentData] = useState<any>(null);

  // Lógica para fechar o menu popup ao clicar fora dele
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Se o popup está aberto e o clique não foi dentro do popup nem em um elemento com a classe time-slot
      if (popupMenu && 
          !(e.target as HTMLElement).closest('.time-slot-popup') && 
          !(e.target as HTMLElement).closest('.time-slot')) {
        setPopupMenu(null);
      }
    };

    // Adicionar um listener global para clicks em todo o documento
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [popupMenu]);

  // Efeito para limpar os estados do modal quando ele é fechado
  useEffect(() => {
    if (!showFastAppointmentForm) {
      // Limpar os dados quando o modal for fechado
      setTimeout(() => {
        if (!showFastAppointmentForm) {
          setFastAppointmentData(null);
        }
      }, 300);
    }
  }, [showFastAppointmentForm]);

  // Manipulador de teclas para fechar o modal com ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showFastAppointmentForm) {
          setShowFastAppointmentForm(false);
        }
        if (popupMenu) {
          setPopupMenu(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showFastAppointmentForm, popupMenu]);

  // Func para garantir que o modal seja exibido corretamente
  const handleShowAgendamentoModal = (data: any) => {
    // Forçar o fechamento de qualquer instância anterior
    setShowFastAppointmentForm(false);
    
    // Limpar outros estados que possam interferir
    setPopupMenu(null);
        
    // Definir os dados e abrir o modal após um breve delay
    setTimeout(() => {
      setFastAppointmentData({
        time: data.time,
        professionalId: data.professionalId,
        professionalName: data.professionalName
      });
      
      // Abrir o modal
      setShowFastAppointmentForm(true);
      console.log('Modal de agendamento aberto com dados:', data);
    }, 100);
  };

  // Función para manejar clic en un slot vacío y mostrar menu popup
  const handleSlotClick = (e: React.MouseEvent, time: string, professionalId: string | undefined) => {
    // Se estamos arrastando un agendamento, no mostrar el menú
    if (dragState) return;
    
    e.stopPropagation(); // Prevenir propagação do evento
    e.preventDefault(); // Prevenir comportamento padrão

    // Fechar qualquer popup existente antes de abrir um novo
    if (popupMenu) {
      setPopupMenu(null);
      // Se já existe um popup aberto, esperar um pouco antes de abrir outro
      setTimeout(() => {
        showPopupMenu(e, time, professionalId);
      }, 50);
    } else {
      // Se não existe popup aberto, mostrar imediatamente
      showPopupMenu(e, time, professionalId);
    }
  };

  // Função auxiliar para mostrar o popup menu
  const showPopupMenu = (e: React.MouseEvent, time: string, professionalId: string | undefined) => {
    // Verificar se o usuário clicou diretamente no slot ou num elemento dentro dele
    const target = e.target as HTMLElement;
    const slotElement = target.closest('.time-slot') || target;

    // Calcular dimensões da janela
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // Obter a posição exata do elemento clicado em relação ao viewport
    const slotRect = slotElement.getBoundingClientRect();
    
    // Usar as coordenadas precisas do elemento
    let x = slotRect.left;
    let y = slotRect.top;
    
    // Garantir que o menu não fique fora dos limites horizontais da tela
    const menuWidth = 384; // Largura aproximada do menu (maior agora)
    x = Math.max(10, Math.min(x, windowWidth - menuWidth - 10));
    
    // Garantir que professionalId seja uma string
    const safeProfessionalId = professionalId || '';
    
    console.log(`Posicionando popup em: x=${x}, y=${y}, rect:`, slotRect);
    
    // Mostrar o menu popup com posição calculada
    setPopupMenu({
      visible: true,
      x,
      y,
      time,
      professionalId: safeProfessionalId,
      top: y,
      left: x,
      height: 50 // Altura padrão do menu
    });
  };

  // Funciones para las acciones del menú popup
  const handleAddAppointment = () => {
    if (!popupMenu) return;
      
    try {
      // Extraer información del slot seleccionado
      const timeValue = popupMenu.time;
      const professionalIdValue = popupMenu.professionalId || '';
      
      // Buscar o nome do profissional
      const professionalName = professionals.find(p => p.id === professionalIdValue)?.name || 'Profissional';
      
      // Criar o objeto de dados
      const data = { 
          time: timeValue,
          professionalId: professionalIdValue,
          professionalName
  };

      // Fechar o popup menu antes de abrir o modal
    setPopupMenu(null);
      
      console.log('Preparando para abrir modal de agendamento com dados:', data);
      
      // Chamar a função que garante que o modal será aberto
      handleShowAgendamentoModal(data);
    } catch (error) {
      console.error('Erro ao abrir modal de agendamento:', error);
      // Esconder o menu em caso de erro
    setPopupMenu(null);
    }
  };

  // Funções para drag & drop
  const handleDragStart = (e: React.DragEvent, appointment: any) => {
    // Configurar propriedades de arrasto
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', appointment.id);
    
    // Definir uma imagem de arrasto (opcional)
    const dragImage = document.createElement('div');
    dragImage.style.width = '150px';
    dragImage.style.height = '30px';
    dragImage.style.backgroundColor = '#EBE9FB';
    dragImage.style.borderRadius = '4px';
    dragImage.style.padding = '5px';
    dragImage.textContent = 'Mover agendamento';
    dragImage.style.color = '#4F46E5';
    dragImage.style.fontWeight = 'bold';
    dragImage.style.fontSize = '12px';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 75, 15);
    
    // Após um breve tempo, remover a imagem de arrasto do DOM
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);

    // Atualizar o estado
    setDragState({
      appointment,
      isDragging: true,
      clientX: e.clientX,
      clientY: e.clientY
    });
  };

  const handleDragEnd = (e: React.DragEvent) => {
    // Cancelar o arrasto se não tivermos um alvo de destino
    if (!dragState || !dropTarget) {
      setDragState(null);
      setDropTarget(null);
      return;
    }

    const appointment = dragState.appointment;
    const { professionalId, time } = dropTarget;

    // Atualizar agendamento com o novo profissional e horário
    handleUpdateAppointmentTime(appointment.id, professionalId, time);
    
    // Limpar estados de arrasto
    setDragState(null);
    setDropTarget(null);
  };

  const handleUpdateAppointmentTime = async (appointmentId: string, professionalId: string | undefined, time: string) => {
    try {
      // Verificar se os dados são válidos
      if (!appointmentId || !time) {
        toast.error('Dados inválidos para atualização de agendamento');
        return;
      }

      // Garantir que professionalId seja uma string, mesmo que vazia
      const safeProId = professionalId || '';

      // Atualizar APENAS o horário e profissional diretamente, sem usar updateAppointment
      // para evitar a remoção dos serviços vinculados
      const { error: updateError } = await supabase
        .from("appointments")
        .update({ 
          time,
          professional_id: safeProId,
        })
        .eq("id", appointmentId);
      
      if (updateError) {
        console.error('Erro ao atualizar dados do agendamento:', updateError);
        toast.error('Erro ao mover agendamento');
        return;
      }

      // Buscar agendamento atualizado com todos os seus serviços
      console.log(`Buscando dados completos do agendamento ${appointmentId} após drag-and-drop`);
      const { data: completeAppointment, error: fetchError } = await supabase
        .from("appointments")
        .select(`
          *,
          appointment_services(
            custom_price,
            custom_time,
            service:service_id(id, name, price, estimated_time)
          )
        `)
        .eq("id", appointmentId)
        .single();

      if (fetchError) {
        console.error('Erro ao buscar dados completos do agendamento após drag-and-drop:', fetchError);
        toast.error('Erro ao carregar dados do agendamento');
      } else if (completeAppointment) {
        console.log('Agendamento completo recuperado após drag-and-drop:', completeAppointment);
        
        // Atualizar o agendamento no estado local para refletir os novos dados
        setAppointments(prevAppointments => 
          prevAppointments.map(appointment => 
            appointment.id === appointmentId ? completeAppointment : appointment
          )
        );
        
        // Disparar evento para informar outros componentes sobre a atualização
        const event = new CustomEvent('appointmentUpdated', { 
          detail: { 
            id: appointmentId,
            date: formatDateToLocal(selectedDate),
            forceRefresh: true
          } 
        });
        window.dispatchEvent(event);
        
        // SEMPRE recarregar agendamentos após drag-and-drop para garantir atualização da interface
        const dateStr = safeFormat(selectedDate, 'yyyy-MM-dd');
        await loadAppointmentsByDate(dateStr, true);
        
        // Notificar sucesso
        toast.success('Agendamento movido com sucesso');
        
        return;
      }

      // Se algo deu errado na busca do agendamento completo, 
      // fazer um fallback para recarregar todos os agendamentos da data
      const dateStr = safeFormat(selectedDate, 'yyyy-MM-dd');
      await loadAppointmentsByDate(dateStr, true);
      
      // Notificar sucesso
      toast.success('Agendamento movido com sucesso');
    } catch (error) {
      console.error('Erro ao atualizar horário do agendamento:', error);
      toast.error('Erro ao mover agendamento');
    }
  };

  const handleDragOver = (e: React.DragEvent, time: string, professionalId: string | undefined) => {
    // Prevenir o comportamento padrão para permitir o drop
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // Atualizar o alvo de destino
    setDropTarget({ professionalId, time });
  };

  const handleDrop = (e: React.DragEvent, time: string, professionalId: string | undefined) => {
    e.preventDefault();
    
    // Obter ID do agendamento dos dados transferidos
    const appointmentId = e.dataTransfer.getData('text/plain');
    
    // Verificar se temos um estado de arrasto válido
    if (!appointmentId || !dragState) return;
    
    // Atualizar o agendamento com o novo horário e profissional
    handleUpdateAppointmentTime(appointmentId, professionalId, time);
    
    // Limpar estados
    setDragState(null);
    setDropTarget(null);
  };

  // Renderização com loading state otimizado
  if (baseDataLoading && appointmentsLoading && appointments.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500 opacity-70"></div>
      </div>
    );
  }

  return (
    <div className="h-full w-full excel-layout agenda-container">
      {/* Estilos CSS personalizados para a barra de rolagem */}
      <style dangerouslySetInnerHTML={{ __html: scrollbarStyles }} />
      
      {/* Cabeçalho fixo - fora do container de scroll */}
      <div className="excel-header sticky-header">
        <TimeSlotHeader
          professionals={professionals}
          paginatedProfessionals={paginatedProfessionals}
          currentPage={currentPage}
          totalPages={totalPages}
          onPrevPage={handlePrevPage}
          onNextPage={handleNextPage}
        />
      </div>
      
      {/* Indicador de carregamento sutil no canto superior direito */}
      {appointmentsLoading && appointments.length > 0 && (
        <div className="absolute top-1 right-1 z-40">
          <div className="h-3 w-3 sm:h-4 sm:w-4 border-t-2 border-b-2 border-indigo-500 rounded-full animate-spin opacity-60"></div>
        </div>
      )}
      
      {/* Container de conteúdo com scroll vertical */}
      <div className="excel-content scroll-container">
        <TimeSlotGrid
          selectedDate={selectedDate}
          groupedTimeSlots={groupedTimeSlots}
          paginatedProfessionals={paginatedProfessionals}
          professionals={professionals}
          appointments={appointments}
          services={services}
          slotHeight={SLOT_HEIGHT}
          hourHeight={HOUR_HEIGHT}
          dragState={dragState}
          onSlotClick={handleSlotClick}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragStart={handleDragStart}
          onAppointmentClick={handleAppointmentClick}
        />
      </div>

      {/* Modal de comanda */}
      {appointmentDetailsOpen && selectedAppointment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[99997] p-4 overflow-y-auto">
          <div 
            className="bg-white rounded-xl shadow-xl max-w-md w-full relative animate-fade-in-up overflow-hidden"
            style={{ maxHeight: 'calc(90vh - 40px)' }}
          >
            {/* Header com cor do profissional */}
            <div 
              className="px-4 py-3 flex justify-between items-center sticky top-0 z-10"
              style={{ 
                backgroundColor: `${professionals.find(p => p.id === selectedAppointment.professional_id)?.color || '#4F46E5'}15`,
                borderBottom: `2px solid ${professionals.find(p => p.id === selectedAppointment.professional_id)?.color || '#4F46E5'}`
              }}
            >
              <h3 className="text-md font-medium text-gray-900">Comanda</h3>
              <button 
                onClick={closeAppointmentDetails}
                className="text-gray-500 hover:text-gray-700 focus:outline-none rounded-full hover:bg-gray-100 p-1 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-3 overflow-y-auto max-h-[calc(80vh-60px)] scroll-container">
              <div className="space-y-3">
                {/* Status e cliente/profissional em uma linha */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mr-2 ${
                      selectedAppointment.status === 'agendado' ? 'bg-blue-100 text-blue-800' :
                      selectedAppointment.status === 'realizado' || selectedAppointment.status === 'finalizado' ? 'bg-green-100 text-green-800' :
                      selectedAppointment.status === 'cancelado' ? 'bg-red-100 text-red-800' :
                      selectedAppointment.status === 'ausente' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedAppointment.status 
                        ? selectedAppointment.status.charAt(0).toUpperCase() + selectedAppointment.status.slice(1)
                        : 'Pendente'}
                    </span>
          </div>
                  
                  <div className="text-xs text-gray-500">
                    {selectedAppointment.date ? 
                      renderModalDateTime(selectedAppointment.date, selectedAppointment.time || '') 
                      : 'Data não especificada'}
                  </div>
        </div>

                {/* Informações do agendamento em cards compactos */}
                <div className="bg-gray-50 rounded-lg p-3 shadow-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-gray-500 uppercase mb-1">Cliente</div>
                      <div className="font-medium text-sm truncate">
                        {selectedAppointment.client ? 
                          (typeof selectedAppointment.client === 'object' 
                            ? (selectedAppointment.client.name || 'Anônimo')
                            : (selectedAppointment.client || 'Anônimo'))
                          : 'Anônimo'}
                      </div>
            </div>
            
                    <div>
                      <div className="text-xs text-gray-500 uppercase mb-1">Profissional</div>
                      <div className="font-medium text-sm truncate">
                        <div className="flex items-center">
                          {professionals.find(p => p.id === selectedAppointment.professional_id)?.color && (
                            <div 
                              className="w-2 h-2 rounded-full mr-1" 
                              style={{ backgroundColor: professionals.find(p => p.id === selectedAppointment.professional_id)?.color }}
                            ></div>
                          )}
                          <span>{professionals.find(p => p.id === selectedAppointment.professional_id)?.name || 'Não encontrado'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                            
                {/* Duração e serviços em um único card */}
                <div className="bg-gray-50 rounded-lg p-3 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-xs text-gray-500 uppercase">Serviços</div>
                    <div className="flex items-center text-xs text-gray-500">
                      <Clock className="h-3 w-3 mr-1 text-gray-400" />
                      {renderDuration(selectedAppointment)}
                    </div>
                  </div>

                  {/* Verificar primeiro appointment_services (novo formato) */}
                  {Array.isArray(selectedAppointment.appointment_services) && selectedAppointment.appointment_services.length > 0
                    ? (
                      <div className="space-y-1">
                        {selectedAppointment.appointment_services.map((serviceRelation, index) => {
                          // Obter o nome do serviço diretamente do objeto service se disponível
                          const serviceName = serviceRelation.service?.name || 
                            services.find(s => s.id === serviceRelation.service_id)?.name || 
                            'Serviço';
                          
                          // Formatação de preço e tempo se disponíveis
                          const hasCustomPrice = serviceRelation.custom_price !== undefined;
                          const hasCustomTime = serviceRelation.custom_time !== undefined;
                          
                          return (
                            <div key={index} className="flex justify-between items-center text-xs bg-white p-1.5 rounded">
                              <div className="flex items-center">
                                <div className="w-1 h-1 bg-indigo-500 rounded-full mr-1.5"></div>
                                {serviceName}
                              </div>
                              {(hasCustomPrice || hasCustomTime) && (
                                <div className="text-gray-500">
                                  {hasCustomPrice && `R$ ${serviceRelation.custom_price?.toFixed(2)}`}
                                  {hasCustomPrice && hasCustomTime && ' • '}
                                  {hasCustomTime && `${serviceRelation.custom_time} min`}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )
                    // Se não tiver appointment_services, verificar services_data
                    : Array.isArray(selectedAppointment.services_data) && selectedAppointment.services_data.length > 0
                      ? (
                        <div className="space-y-1">
                          {selectedAppointment.services_data.map((serviceData, index) => {
                            const serviceId = serviceData.service_id;
                            const serviceObj = services.find(s => s.id === serviceId);
                            const serviceName = serviceObj?.name || 'Serviço';
                            
                            return (
                              <div key={index} className="flex items-center text-xs bg-white p-1.5 rounded">
                                <div className="w-1 h-1 bg-indigo-500 rounded-full mr-1.5"></div>
                                {serviceName}
                              </div>
                            );
                          })}
                        </div>
                      )
                      // Se não tiver services_data, tentar o formato antigo (services)
                      : Array.isArray(selectedAppointment.services) && selectedAppointment.services.length > 0
                        ? (
                          <div className="space-y-1">
                            {selectedAppointment.services.map((service, index) => {
                              // Processar o serviço para exibir apenas o nome, nunca o ID
                              let serviceName = service;
                              
                              // Se for um ID (string longa), buscar o nome no array de serviços
                              if (typeof service === 'string' && service.length > 20) {
                                const serviceObj = services.find(s => s.id === service);
                                serviceName = serviceObj?.name || 'Serviço';
                              }
                        
                              return (
                                <div key={index} className="flex items-center text-xs bg-white p-1.5 rounded">
                                  <div className="w-1 h-1 bg-indigo-500 rounded-full mr-1.5"></div>
                                  {serviceName}
                                </div>
                              );
                            })}
                          </div>
                        )
                        : (
                          <div className="text-xs italic text-gray-500">
                            Nenhum serviço especificado
                          </div>
                        )
                  }
                </div>

                {/* Observações */}
                {selectedAppointment.notes && (
                  <div className="bg-gray-50 rounded-lg p-3 shadow-sm">
                    <div className="text-xs text-gray-500 uppercase mb-1">Observações</div>
                    <div className="text-xs p-2 rounded bg-white">
                      {selectedAppointment.notes}
              </div>
        </div>
                )}
                
                {/* Botões de ação */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {selectedAppointment.status !== 'realizado' && selectedAppointment.status !== 'finalizado' ? (
                    <>
                      <button 
                        onClick={() => {
                          setSelectedAppointment(selectedAppointment);
                          setShowConfirmationModal(true);
                          setAppointmentDetailsOpen(false);
                        }}
                        className="flex items-center justify-center px-3 py-1.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-md hover:from-green-600 hover:to-emerald-700 transition-colors shadow-sm text-xs"
                      >
                        <CheckCircle className="h-3 w-3 mr-1" /> Atendido
                      </button>
            
                      {selectedAppointment.status !== 'cancelado' && (
                        <button
                          onClick={async () => {
                            if (window.confirm('Tem certeza que deseja excluir este agendamento?')) {
                              try {
                                await updateAppointment(selectedAppointment.id, { status: 'cancelado' });
                                toast.success('Agendamento excluído com sucesso');
                                closeAppointmentDetails();
                                loadAppointmentsByDate(selectedAppointment.date);
                              } catch (err) {
                                toast.error('Erro ao excluir agendamento');
                              }
                            }
                          }}
                          className="flex items-center justify-center px-3 py-1.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-md hover:from-red-600 hover:to-red-700 transition-colors shadow-sm text-xs"
                        >
                          <Trash className="h-3 w-3 mr-1" /> Excluir
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="col-span-2 flex items-center justify-center">
                      <div className="bg-green-100 text-green-800 text-xs rounded-md py-1.5 px-3 flex items-center">
                        <Check className="h-3 w-3 mr-1" /> Atendimento finalizado
                      </div>
                    </div>
                  )}
                </div>
                  </div>
                  </div>
                </div>
                  </div>
                )}

      {/* Modal de confirmação */}
      {showConfirmationModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[99996] p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full relative animate-fade-in-up overflow-hidden">
            <CheckoutModal
              appointment={selectedAppointment as any} 
              onClose={() => setShowConfirmationModal(false)}
              onSave={() => {
                setShowConfirmationModal(false);
                const dateStr = safeFormat(selectedDate, 'yyyy-MM-dd');
                loadAppointmentsByDate(dateStr, true);
              }}
              availableServices={services}
              paymentMethods={paymentMethods}
            />
          </div>
        </div>
      )}

      {/* Popup Menu para ações em um slot de tempo */}
      {popupMenu && popupMenu.visible && (
        <>
          {/* Overlay para fechar o popup ao clicar fora */}
          <div 
            className="fixed inset-0 z-[9998]" 
            onClick={() => setPopupMenu(null)}
          />
          <TimeSlotPopupMenu
            time={popupMenu.time}
            x={popupMenu.x}
            y={popupMenu.y}
            professionalId={popupMenu.professionalId || ''}
            onAddAppointment={handleAddAppointment}
            onClose={() => setPopupMenu(null)}
          />
        </>
      )}

      {/* Overlay para fechar o modal de agendamento ao clicar fora */}
      {showFastAppointmentForm && fastAppointmentData && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4"
          onClick={(e) => {
            // Só fechar se clicar no fundo (target === currentTarget)
            if (e.target === e.currentTarget) {
              console.log('Fechando modal via clique no fundo');
              setShowFastAppointmentForm(false);
            }
          }}
        >
          <AgendaQuickAppointment
            selectedDate={selectedDate}
            selectedTime={fastAppointmentData.time}
            professionalId={fastAppointmentData.professionalId}
            professionalName={fastAppointmentData.professionalName}
            onClose={() => setShowFastAppointmentForm(false)}
            onSuccess={() => {
              setShowFastAppointmentForm(false);
              const dateStr = safeFormat(selectedDate, 'yyyy-MM-dd');
              loadAppointmentsByDate(dateStr, true);
            }}
          />
        </div>
      )}
    </div>
  );
}

// Função auxiliar para renderizar duração (adicionada fora do componente de detalhes)
const renderDuration = (appointment: Appointment) => {
  // Calcular a duração total baseada nos serviços
  let duration = 30; // valor padrão
  
  if (appointment.appointment_services && appointment.appointment_services.length > 0) {
    // Priorizar o cálculo baseado em appointment_services (implementação correta)
    const totalTime = appointment.appointment_services
      .map(s => {
        // Verificar custom_time primeiro
        if (s.custom_time && s.custom_time > 0) {
          return s.custom_time;
        }
        // Se não tiver custom_time, usar o estimated_time do serviço
        else if (s.service?.estimated_time && s.service.estimated_time > 0) {
          return s.service.estimated_time;
        }
        // Valor padrão se não encontrar tempo
        return 30;
      })
      .reduce((acc, cur) => acc + cur, 0);
    
    duration = totalTime;
  } else if (appointment.services_relations && appointment.services_relations.length > 0) {
    // Fallback para services_relations (estrutura antiga mas ainda usada)
    duration = appointment.services_relations.reduce((total, s: any) => 
      total + (s.custom_time || (s.service?.estimated_time || 30)), 0);
  } else {
    // Último fallback para o campo duration que pode ter sido calculado no contexto
    const anyAppointment = appointment as any;
    if (anyAppointment.duration) {
      duration = typeof anyAppointment.duration === 'string' 
        ? parseInt(anyAppointment.duration) 
        : anyAppointment.duration;
    }
  }
  
  return `${duration} min`;
};