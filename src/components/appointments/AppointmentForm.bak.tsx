import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ChevronDown, Trash2, UserPlus, Search, X, Check, Pencil, 
  ChevronLeft, ChevronRight, Phone, Mail, Users, CalendarIcon 
} from 'lucide-react';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { toast } from 'react-hot-toast';

// Contextos e hooks
import { useAppointments } from '../../contexts/AppointmentContext';

// Serviços da API
import { getClients, createClient, searchClients, type Client } from '../../lib/clientService';
import { getProfessionals, type Professional } from '../../lib/professionalService';
import { getServices } from '../../lib/serviceService';
import { 
  getAppointmentsByDate, 
  createAppointment, 
  deleteAppointment as deleteAppointmentService,
  convertServiceNamesToIds,
  mapCustomValuesToIds,
  type Appointment
} from '../../lib/appointmentService';
import { supabase } from '../../lib/supabaseClient';

// Utilitários
import { 
  normalizeTime, 
  formatAppointmentDateTime, 
  formatDuration 
} from '../../lib/dateUtils';

// Cache de dados para evitar requisições desnecessárias
const dataCache = {
  clients: [] as Client[],
  professionals: [] as Professional[],
  services: [] as any[],
  lastFetch: 0,
  CACHE_DURATION: 5 * 60 * 1000 // 5 minutos em milissegundos
};

// Registrar localização para português do Brasil
registerLocale('pt-BR', ptBR);

interface ServiceType {
  id: string;
  name: string;
  price: number;
  estimated_time: number;
  active?: boolean;
}

interface FormData {
  client_id: string;
  professional_id: string;
  services: ServiceType[];
  date: string;
  time: string;
  notes: string;
  duration?: number;
  preSelectedTime?: boolean;
  preSelectedDate?: boolean;
  preSelectedProfessional?: boolean;
  custom_times?: Record<string, number>;
}

interface AppointmentFormProps {
  onClose: () => void;
  isEditing?: boolean;
  appointmentId?: string;
}

const availableServices = [
  'Corte',
  'Coloração',
  'Mechas',
  'Manicure',
  'Pedicure',
  'Barba',
  'Limpeza de Pele',
  'Hidratação',
  'Escova',
  'Penteado'
];

// Usar o initialFormState com o tipo correto
const initialFormState: FormData = {
  client_id: '',
  professional_id: '',
  services: [] as ServiceType[],
  date: format(new Date(), 'yyyy-MM-dd'),
  time: '',
  notes: '',
  duration: 30,
  custom_times: {}
};

interface NewClientData {
  name: string;
  phone: string;
  email: string;
  notes: string;
}

// Valores iniciais
const initialNewClientState: NewClientData = {
  name: '',
  phone: '',
  email: '',
  notes: ''
};

// Funções utilitárias
function timeToMinutes(time: string): number {
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return (hours * 60) + minutes;
}

function formatPrice(price: number): string {
  return price.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function parsePriceString(priceStr: string): number {
  return Number(priceStr.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
}

function formatPriceInput(value: string): string {
  // Remove tudo que não é dígito ou vírgula
  const cleaned = value.replace(/[^\d,]/g, '');
  const hasComma = cleaned.includes(',');
  
  if (cleaned === '') return '';
  
  // Converte para número para formatar
  let numValue = parseFloat(cleaned.replace(',', '.')) || 0;
  
  // Formata como moeda brasileira
  let formatted = numValue.toLocaleString('pt-BR', {
    minimumFractionDigits: hasComma ? 2 : 0, 
    maximumFractionDigits: 2
  });
  
  return formatted;
}

function formatPhone(value: string): string {
  // Remove tudo que não é dígito
  const cleaned = value.replace(/\D/g, '');
  
  // Aplica a máscara conforme a quantidade de dígitos
  if (cleaned.length <= 2) {
    return cleaned;
  } else if (cleaned.length <= 7) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
  } else {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
  }
}

function getDigitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

// Função para formatar hora em minutos como string
function formatTimeFromMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}min`;
  } else {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h${mins > 0 ? `${mins}min` : ''}`;
  }
}

// Função para formatar minutos como HH:MM
function formatTimeAsHourMinute(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// Hook para debounce
const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  
  return debouncedValue;
};

// Validação do formulário
const isFormValid = (data: FormData): boolean => {
  return Boolean(
    data.professional_id && 
    data.services.length > 0 && 
    data.date && 
    data.time
  );
};

// Estilos para animaciones y modal
const animationStyles = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .animate-fade-in-up {
    animation: fadeInUp 0.5s ease-out forwards;
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.3s ease-out forwards;
  }
  
  .modal-content {
    background-color: white;
    border-radius: 0.5rem;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    width: 90%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
    animation: fadeInUp 0.3s ease-out forwards;
  }
`;

export default function AppointmentForm({ onClose, isEditing: isEditingProp = false, appointmentId }: AppointmentFormProps) {
  const { appointments, addAppointment, loadAppointmentsByDate, updateAppointment } = useAppointments();
  const [showServices, setShowServices] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(isEditingProp);
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({});
  const [customTimes, setCustomTimes] = useState<Record<string, number>>({});
  const loadingRef = useRef(false);
  const [isSpontaneous, setIsSpontaneous] = useState(false);
  
  // Estado para controlar la visibilidad secuencial de los campos
  const [formStep, setFormStep] = useState(1);
  
  // Nuevos estados para el tiempo
  const [showTimeEditing, setShowTimeEditing] = useState(false);
  const [editingServiceTime, setEditingServiceTime] = useState<string | null>(null);
  const [timesConfirmed, setTimesConfirmed] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    client_id: '',
    professional_id: '',
    services: [] as ServiceType[],
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '',
    notes: '',
    duration: 30,
    custom_times: {}
  });
  const [submitting, setSubmitting] = useState(false);
  
  // Estado para busca de clientes
  const [clientSearch, setClientSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const debouncedSearch = useDebounce(clientSearch, 300);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showClientResults, setShowClientResults] = useState(false);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientData, setNewClientData] = useState(initialNewClientState);
  const [creatingClient, setCreatingClient] = useState(false);
  const clientSearchRef = useRef<HTMLDivElement>(null);
  
  // Estado para busca de profissionais
  const [professionalSearch, setProfessionalSearch] = useState('');
  const [showProfessionalResults, setShowProfessionalResults] = useState(false);
  const [filteredProfessionals, setFilteredProfessionals] = useState<Professional[]>([]);
  const professionalSearchRef = useRef<HTMLDivElement>(null);
  
  // Estado para busca de serviços
  const [searchService, setSearchService] = useState('');
  
  // Referencia para la ventana de selección de servicios
  const servicesDropdownRef = useRef<HTMLDivElement>(null);

  // Estado para seleção de data e hora
  const [showDateTimeModal, setShowDateTimeModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [selectedDateTime, setSelectedDateTime] = useState<{date: string, time: string} | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [dateTimeConfirmed, setDateTimeConfirmed] = useState(false);

  // Añadir estado para controlar cuándo mostrar la edición de precios
  const [showPriceEditing, setShowPriceEditing] = useState(false);

  // Añadir estado para saber si los tiempos han sido confirmados (antes eram preços e tempos)
  // JÁ DECLARADO ACIMA: const [timesConfirmed, setTimesConfirmed] = useState(false);

  const [loadingTimeSlots, setLoadingTimeSlots] = useState(false);

  // Estado temporário para o modal de data e hora
  const [tempDate, setTempDate] = useState<Date>(currentDate);
  const [tempTime, setTempTime] = useState<string>('');

  // Adicionar estado para horários ocupados
  const [occupiedTimeSlots, setOccupiedTimeSlots] = useState<string[]>([]);

  // Adicionar novo estado para cache de horários ocupados
  const [occupiedSlotsCache, setOccupiedSlotsCache] = useState<Record<string, string[]>>({});

  // Adicionar novo estado para controlar o carregamento inicial
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // Estado para controlar se o horário foi pré-selecionado
  const [isTimePreSelected, setIsTimePreSelected] = useState(false);
  const [isProfessionalPreSelected, setIsProfessionalPreSelected] = useState(false);
  const [isDatePreSelected, setIsDatePreSelected] = useState(false);

  // Función para manejar las teclas en la búsqueda de clientes
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showClientResults) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredClients.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && filteredClients[selectedIndex]) {
          selectClient(filteredClients[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowClientResults(false);
        break;
    }
  };

  // Uso del useEffect existente donde se cargan los servicios
  useEffect(() => {
    const loadServices = async () => {
      try {
        const servicesData = await getServices();
        setServices(servicesData);
      } catch (error) {
        console.error('Error loading services:', error);
        toast.error('Erro ao carregar serviços');
      }
    };

    const loadInitialData = async () => {
      try {
        await Promise.all([
          loadServices(),
          getClients().then(setClients),
          getProfessionals().then(setProfessionals)
        ]);
      } catch (error) {
        console.error('Error loading initial data:', error);
      }
    };

    loadInitialData();
  }, []);
  
  // Adicionar listener para o evento de atualização de profissionais
  useEffect(() => {
    const handleProfessionalUpdated = () => {
      console.log('[AppointmentForm] Evento de atualização de profissional detectado, recarregando profissionais...');
      getProfessionals().then(data => {
        setProfessionals(data);
      }).catch(error => {
        console.error('Erro ao recarregar profissionais:', error);
      });
    };

    window.addEventListener('professional_updated', handleProfessionalUpdated);

    return () => {
      window.removeEventListener('professional_updated', handleProfessionalUpdated);
    };
  }, []);

  // Carregar dados da cita para edição
  useEffect(() => {
    if (isEditing && appointmentId) {
      const appointmentData: FormData = {
        client_id: appointmentId,
        professional_id: formData.professional_id || '',
        services: formData.services || [],
        date: formData.date || format(new Date(), 'yyyy-MM-dd'),
        time: formData.time || '',
        notes: formData.notes || '',
        custom_times: formData.custom_times || {}
      };
      
      // Verificar se o agendamento tem campos pré-selecionados
      const hasPreSelectedFields = (appointmentData?.preSelectedTime === true || 
                                   appointmentData?.preSelectedDate === true || 
                                   appointmentData?.preSelectedProfessional === true);
      
      if (hasPreSelectedFields) {
        // Se a data foi passada como prop ou pré-selecionada
        if (appointmentData?.preSelectedDate === true) {
          setIsDatePreSelected(true);
          setDateTimeConfirmed(true);
        }
        
        // Se o horário está definido no agendamento
        if (appointmentData.time || appointmentData?.preSelectedTime === true) {
          setIsTimePreSelected(true);
          setDateTimeConfirmed(true);
        }
        
        // Se o profissional está definido no agendamento
        if (appointmentData.professional_id || appointmentData?.preSelectedProfessional === true) {
          setIsProfessionalPreSelected(true);
        }

        // Se temos data, hora e profissional pré-selecionados, avançar direto para a seleção de serviços
        if ((appointmentData?.preSelectedTime === true && 
             appointmentData?.preSelectedDate === true && 
             appointmentData?.preSelectedProfessional === true)) {
          // SEMPRE iniciar no passo 1 (seleção de cliente)
          setFormStep(1);
          setDateTimeConfirmed(true);
          
          // Não mostrar serviços imediatamente, deixar o usuário começar pelo cliente
          // setTimeout(() => {
          //   setShowServices(true);
          // }, 100);
        }

        // Usar nossa função de atualização de estado
        updateFormData(appointmentData);
        
        setIsEditing(false);
      } else {
        setIsEditing(true);
        setTimesConfirmed(true); // Si estamos editando, los tiempos ya están confirmados
        setFormStep(6); // Si estamos editando, mostrar todos los campos (ahora son 6 pasos)
      }
      
      // Se estiver editando, busque o nome do cliente para exibição
      if (appointmentData.client_id) {
        // Tentar encontrar o cliente nos dados do estado atual em vez de usar dataCache diretamente
        const existingClient = clients.find(c => c.id === appointmentData.client_id);
        if (existingClient) {
          setClientSearch(existingClient.name);
        } else {
          // Se o cliente não for encontrado no estado, buscar da API
          const fetchClient = async () => {
            try {
              const { data, error } = await supabase
                .from('clients')
                .select('name')
                .eq('id', appointmentData.client_id)
                .single();
              
              if (data && !error) {
                setClientSearch(data.name);
              }
            } catch (err) {
              console.error('Erro ao buscar detalhes do cliente:', err);
            }
          };
          
          fetchClient();
        }
      }
      
      // Se o profissional está definido, buscar nome para exibição
      if (appointmentData.professional_id) {
        const professional = professionals.find(p => p.id === appointmentData.professional_id);
        if (professional) {
          // Atualizar o campo visual do profissional selecionado
          setProfessionalSearch(professional.name);
        }
      }
      
      // Si hay tiempos personalizados en la cita, cargarlos
      if (appointmentData.custom_times) {
        setCustomTimes(appointmentData.custom_times);
      }
    } else {
      // É um novo agendamento, limpar completamente o formulário
      const newFormData = {
        ...initialFormState,
        date: format(new Date(), 'yyyy-MM-dd'), // Garantir que a data seja sempre a atual para novos agendamentos
      };
      
      // Usar nossa função de atualização de estado
      updateFormData(newFormData);
      
      setIsEditing(false);
      setClientSearch('');
      setTimesConfirmed(false);
      setFormStep(1);
      setCustomTimes({});
      setDateTimeConfirmed(false);
      setShowPriceEditing(false);
      
      // Resetar flags de pré-seleção
      setIsTimePreSelected(false);
      setIsDatePreSelected(false);
      setIsProfessionalPreSelected(false);
    }
  }, [isEditing, appointmentId, professionals, initialFormState, formData, clients]);

  // Fechar resultados de busca ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clientSearchRef.current && !clientSearchRef.current.contains(event.target as Node)) {
        setShowClientResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filtrar clientes conforme digitação
  useEffect(() => {
    async function searchClientsData() {
      if (!debouncedSearch.trim() || debouncedSearch.length < 2) {
        setFilteredClients([]);
        return;
      }

      try {
        setIsSearching(true);
        const results = await searchClients(debouncedSearch);
        setFilteredClients(results);
      } catch (error) {
        console.error('Erro ao buscar clientes:', error);
        toast.error('Erro ao buscar clientes');
      } finally {
        setIsSearching(false);
      }
    }

    searchClientsData();
  }, [debouncedSearch]);

  // Filtrar profesionales conforme digitação
  useEffect(() => {
    if (!professionalSearch.trim()) {
      setFilteredProfessionals([]);
      return;
    }

    const searchLower = professionalSearch.toLowerCase().trim();
    const filtered = professionals.filter(professional => 
      professional.name.toLowerCase().includes(searchLower) ||
      (professional.role && professional.role.toLowerCase().includes(searchLower))
    );
    
    setFilteredProfessionals(filtered);
  }, [professionalSearch, professionals]);

  // Fechar resultados de busca de profesionales ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (professionalSearchRef.current && !professionalSearchRef.current.contains(event.target as Node)) {
        setShowProfessionalResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Función para cargar los datos
  const loadData = useCallback(async () => {
    // Se já estamos carregando dados, não iniciar outra petição
    if (loadingRef.current) return;
    loadingRef.current = true;

    try {
      setLoading(true);
      setError(null);
      
      // Se os dados já estão em cache e são recentes, usá-los
      // Garantir que dataCache exista
      if (typeof dataCache !== 'undefined') {
        const now = Date.now();
        if (
          dataCache.clients.length > 0 && 
          dataCache.professionals.length > 0 && 
          dataCache.services.length > 0 &&
          now - dataCache.lastFetch < dataCache.CACHE_DURATION
        ) {
          setClients(dataCache.clients);
          setProfessionals(dataCache.professionals);
          setServices(dataCache.services);
          setLoading(false);
          loadingRef.current = false;
          return;
        }
      }
      
      const [clientsData, professionalsData, servicesData] = await Promise.all([
        getClients(),
        getProfessionals(),
        getServices()
      ]);

      // Guardar no estado e no cache
      setClients(clientsData);
      setProfessionals(professionalsData);
      setServices(servicesData.filter(service => service.active));
      
      // Atualizar cache
      if (typeof dataCache !== 'undefined') {
        dataCache.clients = clientsData;
        dataCache.professionals = professionalsData;
        dataCache.services = servicesData.filter(service => service.active);
        dataCache.lastFetch = Date.now();
      }
      
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Erro ao carregar dados. Por favor, tente novamente.');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  // Carregar dados apenas uma vez ao montar o componente
  useEffect(() => {
    loadData();
  }, []); // Dependência vazia para executar apenas uma vez

  // Limpar horário quando profissional mudar
  useEffect(() => {
    if (formData.professional_id && !isEditing) {
      setFormData(prev => ({ ...prev, time: '' }));
    }
  }, [formData.professional_id, isEditing]);

  // Todos los horarios disponibles para modo retroactivo (de 8:00 a 20:00)
  const allRetroactiveTimeSlots = useMemo(() => {
    const slots = [];
    // Generar slots desde 8:00 hasta 19:30 (para que la última cita termine a las 20:00)
    for (let hour = 8; hour < 20; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        // No permitir citas que comiencen después de las 19:30 (para que terminen a las 20:00)
        if (hour === 19 && minute > 30) continue;
        
        const formattedHour = hour.toString().padStart(2, '0');
        const formattedMinute = minute.toString().padStart(2, '0');
        slots.push(`${formattedHour}:${formattedMinute}`);
      }
    }
    console.log(`Generados ${slots.length} horarios retroactivos de 8:00 a 20:00`);
    return slots;
  }, []);

  // Todos los horarios estándar - Asegurar que se generen correctamente
  const allTimeSlots = useMemo(() => {
    const slots = [];
    // Gerar slots das 8:00 até 19:30 em intervalos de 30 minutos para manter compacto
    for (let hour = 8; hour <= 19; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        // Não permitir agendamentos após 19:30
        if (hour === 19 && minute > 30) continue;
        
        const formattedHour = hour.toString().padStart(2, '0');
        const formattedMinute = minute.toString().padStart(2, '0');
        const timeSlot = `${formattedHour}:${formattedMinute}`;
        slots.push(timeSlot);
      }
    }
    return slots;
  }, []);

  // Modificar a função getOccupiedTimeSlots para ser mais eficiente
  const getOccupiedTimeSlots = useCallback(async (date: string, professionalId: string) => {
    try {
      console.log('Buscando horários ocupados para:', date, professionalId);
      
      if (!professionalId) {
        console.log('Nenhum profissional selecionado, retornando lista vazia');
        return [];
      }
      
      let query = supabase
        .from('appointments')
        .select(`
          id,
          time,
          status,
          appointment_services(service_id, custom_time)
        `)
        .eq('date', date)
        .eq('professional_id', professionalId)
        .in('status', ['agendado', 'realizado', 'pendente']);
      
      if (appointmentId) {
        query = query.neq('id', appointmentId);
      }
      
      const { data: appointments, error } = await query;

      if (error) {
        console.error('Erro ao buscar horários ocupados:', error);
        throw error;
      }

      console.log('Agendamentos encontrados:', appointments);
      
      const occupiedSlots = new Set<string>();
      
      appointments?.forEach(appointment => {
        try {
          console.log('Processando agendamento:', appointment);
          
          const [hours, minutes] = appointment.time.split(':').map(Number);
          const startMinutes = hours * 60 + minutes;
          
          let duration = 0;
          
          // Calcular duração a partir de appointment_services
          if (appointment.appointment_services && Array.isArray(appointment.appointment_services)) {
            duration = appointment.appointment_services.reduce((total: number, service: any) => {
              const serviceTime = service.custom_time || 30;
              console.log(`Serviço ID ${service.service_id}: ${serviceTime}min`);
              return total + serviceTime;
            }, 0);
          } 
          // Fallback para duração padrão se não tiver serviços
          else {
            duration = 30;
            console.log('Sem serviços encontrados, usando duração padrão: 30min');
          }
          
          console.log(`Duração total do agendamento: ${duration}min`);
          
          const endMinutes = startMinutes + duration;
          
          // Marcar todos os slots de 15 em 15 minutos
          for (let currentMinute = startMinutes; currentMinute <= endMinutes; currentMinute += 15) {
            const slotHour = Math.floor(currentMinute / 60);
            const slotMinute = currentMinute % 60;
            
            // Não adicionar slots após 20:00
            if (slotHour >= 23) continue; // Mudado de 20 para 23 para permitir até 22:45
            
            const timeSlot = `${String(slotHour).padStart(2, '0')}:${String(slotMinute).padStart(2, '0')}`;
            console.log(`Marcando horário ${timeSlot} como ocupado`);
            occupiedSlots.add(timeSlot);
            
            // Marcar também os slots intermediários para evitar sobreposições
            if (currentMinute < endMinutes) {
              for (let i = 1; i < 4; i++) {
                const intermediateMinute = currentMinute + (i * 5);
                const intermediateHour = Math.floor(intermediateMinute / 60);
                const intermediateMin = intermediateMinute % 60;
                
                if (intermediateHour >= 23) continue; // Mudado de 20 para 23 para permitir até 22:45
                
                const intermediateSlot = `${String(intermediateHour).padStart(2, '0')}:${String(intermediateMin).padStart(2, '0')}`;
                occupiedSlots.add(intermediateSlot);
              }
            }
          }
          
          console.log(`Slots ocupados após processar agendamento: ${Array.from(occupiedSlots).join(', ')}`);
        } catch (err) {
          console.error('Erro ao processar horário do agendamento:', err, appointment);
        }
      });

      const occupiedArray = Array.from(occupiedSlots);
      console.log('Horários ocupados finais:', occupiedArray);
      return occupiedArray;
    } catch (error) {
      console.error('Erro ao carregar horários ocupados:', error);
      return [];
    }
  }, [appointmentId]);

  // Modificar el useEffect para carregar horários ocupados de forma más eficiente
  useEffect(() => {
    const loadOccupiedSlots = async () => {
      if (!formData.professional_id) {
        console.log('Nenhum profissional selecionado, não carregando horários ocupados');
        return;
      }

      try {
        setLoadingTimeSlots(true);
        console.log('Iniciando carregamento de horários ocupados');
        
        // Carregar slots para a data atual
        const dateStr = format(tempDate, 'yyyy-MM-dd');
        const cacheKey = `${dateStr}-${formData.professional_id}`;
        
        console.log('Verificando cache para:', cacheKey);
        
        // Sempre recarregar para garantir dados atualizados
        console.log('Buscando horários ocupados para:', dateStr, formData.professional_id);
        const slots = await getOccupiedTimeSlots(dateStr, formData.professional_id);
        
        console.log('Horários ocupados obtidos:', slots);
        
        // Atualizar cache com os novos dados
        setOccupiedSlotsCache(prev => ({
          ...prev,
          [cacheKey]: slots
        }));
        
      } catch (error) {
        console.error('Erro ao carregar horários ocupados:', error);
      } finally {
        setLoadingTimeSlots(false);
        setInitialLoadDone(true);
      }
    };

    // Limpar o cache quando a data ou o profissional mudar
    if (tempDate || formData.professional_id) {
      const dateStr = format(tempDate || new Date(), 'yyyy-MM-dd');
      setOccupiedSlotsCache({}); // Limpar todo o cache para forçar nova consulta
    }

    // Chamar a função quando o modal for aberto ou quando mudar a data/profissional
    if (showDateTimeModal) {
      loadOccupiedSlots();
    }
  }, [formData.professional_id, showDateTimeModal, tempDate, getOccupiedTimeSlots]);

  // Función para calcular el tiempo total
  const calculateTotalTime = (selectedServices: ServiceType[] = formData.services) => {
    return selectedServices.reduce((total, service) => {
      const customTime = formData.custom_times?.[service.id];
      return total + (customTime || service.estimated_time);
    }, 0);
  };

  // Función para manejar la selección de fecha y hora
  const handleDateTimeSelection = (time: string) => {
    // Atualizar apenas o estado temporário
    setTempTime(time);
  };

  // Función para manejar la selección de fecha y hora
  const handleDateTimeSelect = (date: Date, time: string) => {
    setFormData(prev => ({
      ...prev,
      date: format(date, 'yyyy-MM-dd'),
      time
    }));
    setShowDateTimeModal(false);
    setFormStep(5);
  };

  // Ajustar a função handlePrevStep
  const handlePrevStep = () => {
    setError(null);
    
    // Lógica para voltar para o passo correto
    if (formStep === 6) {
      setShowDateTimeModal(true);
      setFormStep(5);
    } else if (formStep === 5) {
      if (formData.services.length > 0) {
        setShowTimeModal(true);
        setFormStep(4);
      } else {
        setShowServices(true);
        setFormStep(3);
      }
    } else if (formStep === 4) {
      setShowServices(true);
      setTimesConfirmed(false);
      setFormStep(3);
    } else if (formStep === 3) {
      setFormStep(2);
    } else {
      setFormStep(Math.max(1, formStep - 1));
    }
  };

  // Ajustar a função handleNextStep
  const handleNextStep = () => {
    if (formStep === 1 && !formData.client_id && !isEditing) {
      setError('Selecione um cliente para continuar.');
      return;
    }
    
    setError(null);
    setFormStep(formStep + 1);
  };

  // Atualizar a função handleSubmit para preparar os serviços no formato que o AppointmentContext espera
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Validar campos obrigatórios
      if (!formData.professional_id || formData.services.length === 0 || !formData.date || !formData.time) {
        toast.error('Por favor, preencha todos os campos obrigatórios');
        return;
      }

      // Preparar os dados do agendamento
      const appointmentData = {
        client_id: formData.client_id,
        professional_id: formData.professional_id,
        date: formData.date,
        time: formData.time,
        notes: formData.notes,
        status: 'agendado',
        _selectedServices: formData.services
      };

      console.log('Dados do agendamento a serem enviados:', appointmentData);

      let appointmentResult;
      if (isEditing && appointmentId) {
        appointmentResult = await updateAppointment(appointmentId, appointmentData);
        toast.success('Agendamento atualizado com sucesso!');
      } else {
        appointmentResult = await addAppointment(appointmentData);
        toast.success('Agendamento criado com sucesso!');
      }

      if (!appointmentResult) {
        throw new Error('Erro ao criar agendamento: resultado inválido');
      }

      onClose();
    } catch (error) {
      console.error('Erro ao salvar agendamento:', error);
      toast.error('Erro ao salvar agendamento. Por favor, tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!appointmentId) return;
    
    setLoading(true);
    try {
      // Usando supabase diretamente em vez de deleteAppointment
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', appointmentId);
      
      if (error) throw error;
      
      toast.success('Agendamento excluído com sucesso!');
      onClose();
    } catch (err) {
      console.error('Erro ao excluir agendamento:', err);
      toast.error('Erro ao excluir agendamento');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      client_id: '',
      professional_id: '',
      services: [] as ServiceType[],
      date: format(new Date(), 'yyyy-MM-dd'),
      time: '',
      notes: '',
      duration: 30,
      custom_times: {}
    });
    setCustomTimes({});
    setEditingServiceTime(null);
  };

  // Cerrar el dropdown de servicios al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (servicesDropdownRef.current && !servicesDropdownRef.current.contains(event.target as Node)) {
        setShowServices(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Adicionar função handleNewClientSubmit
  const handleNewClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newClientData.name.trim()) {
      toast.error('Nome é obrigatório para cadastrar um cliente');
      return;
    }

    const phoneDigits = getDigitsOnly(newClientData.phone);
    if (!phoneDigits || phoneDigits.length < 10) {
      toast.error('Telefone é obrigatório e deve ser completo');
      return;
    }

    try {
      setCreatingClient(true);
      
      const now = new Date().toISOString();
      const clientData = {
        ...newClientData,
        last_visit: format(new Date(), 'yyyy-MM-dd'),
        created_at: now,
        updated_at: now
      };
      
      const createdClient = await createClient(clientData);
      
      // Atualizar a lista de clientes
      const updatedClients = [...clients, createdClient];
      setClients(updatedClients);
      dataCache.clients = updatedClients;
      
      // Selecionar o cliente recém-criado
      selectClient(createdClient);
      
      // Limpar o formulário e fechar o modal
      setNewClientData(initialNewClientState);
      setShowNewClientForm(false);
      
      toast.success('Cliente cadastrado com sucesso!');
      setFormStep(prev => Math.max(prev, 2));
    } catch (err) {
      console.error('Error creating client:', err);
      toast.error('Erro ao cadastrar cliente. Verifique os dados e tente novamente.');
    } finally {
      setCreatingClient(false);
    }
  };

  // Função para atualizar o formData de forma segura
  const updateFormData = (updates: Partial<FormData>) => {
    setFormData(prev => {
      // Certifique-se de que services seja sempre ServiceType[]
      let newServices = prev.services;
      
      // Se updates contém services e é um array de strings, converta para ServiceType[]
      if (updates.services && Array.isArray(updates.services)) {
        // Verificar se updates.services contém strings ou ServiceType
        if (updates.services.length > 0 && typeof updates.services[0] === 'string') {
          // Converter strings para ServiceType[]
          const serviceStrings = updates.services as unknown as string[];
          newServices = services.filter(s => serviceStrings.includes(s.name));
        } else {
          // Já está no formato correto
          newServices = updates.services as ServiceType[];
        }
      }
      
      const newState = { 
        ...prev, 
        ...updates,
        services: newServices
      };
      
      if (newState.duration === undefined) {
        newState.duration = 30; // Valor padrão de 30 minutos
      }
      
      console.log('FormData atualizado:', newState);
      return newState;
    });
  };

  // Função para calcular o preço total
  const calculateTotalPrice = () => {
    return formData.services.reduce((total, service) => {
      return total + (service.price || 0);
    }, 0);
  };

  const handleClientSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setClientSearch(value);
    setShowClientResults(true);
    setSelectedIndex(-1);
    setIsSpontaneous(false);

    if (!value.trim()) {
      setFormData(prev => ({ ...prev, client_id: '' }));
    }
  };

  const selectClient = (client: Client) => {
    setClientSearch(client.name);
    updateFormData({ client_id: client.id || '' });
    setShowClientResults(false);
    setIsSpontaneous(false);
    
    // Avançar automaticamente para o próximo passo (seleção de profissional)
    setFormStep(prev => Math.max(prev, 2));
  };

  const handleSpontaneousAppointment = () => {
    setIsSpontaneous(true);
    setClientSearch('Espontâneo');
    updateFormData({ client_id: undefined });
    setShowClientResults(false);
    
    // Avançar automaticamente para o próximo passo (seleção de profissional)
    setFormStep(prev => Math.max(prev, 2));
  };

  const handleProfessionalChange = (professional: Professional) => {
    updateFormData({ 
      professional_id: professional.id || '', 
      time: '' 
    });
    
    if (professional.id) {
      setFormStep(prev => Math.max(prev, 3));
    }
  };

  const handleServiceToggle = (serviceName: string) => {
    setFormData((prev: FormData) => {
      // Encontrar o objeto de serviço completo pelo nome
      const serviceObject = services.find(s => s.name === serviceName);
      if (!serviceObject) return prev; // Se não encontrar, retornar o estado anterior sem alterações
      
      // Verificar se o serviço já está selecionado
      const isSelected = prev.services.some(s => s.id === serviceObject.id);
      let newDuration = prev.duration || 0;
      
      // Calcular a nova duração
      if (!isSelected) {
        newDuration = Math.max(newDuration, serviceObject.estimated_time);
      } else if (prev.services.length > 1) {
        const remainingServices = prev.services.filter(s => s.id !== serviceObject.id);
        if (remainingServices.length > 0) {
          const maxDuration = Math.max(...remainingServices.map(s => s.estimated_time));
          newDuration = maxDuration;
        } else {
          newDuration = 30; // Duração padrão
        }
      }
      
      // Atualizar a lista de serviços
      const updatedServices = isSelected
        ? prev.services.filter(s => s.id !== serviceObject.id)
        : [...prev.services, serviceObject];
      
      // Indicar que os preços e tempos não estão confirmados
      setTimesConfirmed(false);
      
      // Avançar automaticamente para o próximo passo se houver serviços selecionados
      if (updatedServices.length > 0) {
        setFormStep(prev => Math.max(prev, 4));
      }
      
      // Retornar o novo estado
      return { 
        ...prev, 
        services: updatedServices,
        duration: newDuration
      };
    });
  };

  const closeDateTimeModal = () => {
    setShowDateTimeModal(false);
  };

  // Agregar la función openDateTimeModal dentro del componente
  const openDateTimeModal = useCallback(() => {
    try {
      // Establecer la fecha y hora temporales
      setTempDate(formData.date ? parseISO(formData.date) : new Date());
      setTempTime(formData.time || '');

      // Mostrar el modal
      setShowDateTimeModal(true);
      
      // Forzar una recarga inmediata de los horarios ocupados
      const loadInitialSlots = async () => {
        if (!formData.professional_id) {
          console.log('Nenhum profissional selecionado, não carregando horários ocupados');
          return;
        }
        
        try {
          setLoadingTimeSlots(true);
          const dateStr = format(formData.date ? parseISO(formData.date) : new Date(), 'yyyy-MM-dd');
          console.log('Carregando horários ocupados ao abrir modal:', dateStr, formData.professional_id);
          
          // Cargar explícitamente los slots ocupados
          const slots = await getOccupiedTimeSlots(dateStr, formData.professional_id);
          const cacheKey = `${dateStr}-${formData.professional_id}`;
          
          // Actualizar el cache con los nuevos slots
          setOccupiedSlotsCache(prev => ({
            ...prev,
            [cacheKey]: slots
          }));
        } catch (error) {
          console.error('Erro ao carregar slots iniciais:', error);
        } finally {
          setLoadingTimeSlots(false);
        }
      };
      
      loadInitialSlots();
    } catch (error) {
      console.error('Erro ao abrir o modal de data/hora:', error);
      toast.error('Ocorreu um erro ao carregar os horários disponíveis');
    }
  }, [formData.date, formData.time, formData.professional_id, getOccupiedTimeSlots]);

  // Refactorando o availableTimeSlots para garantir que os horários indisponíveis não sejam mostrados
  const availableTimeSlots = useMemo(() => {
    const { professional_id } = formData;
    
    // Se não houver profissional selecionado, não mostrar horários
    if (!professional_id) {
      console.log('Nenhum profissional selecionado, retornando lista vazia');
      return [];
    }
    
    const dateStr = format(tempDate, 'yyyy-MM-dd');
    const cacheKey = `${dateStr}-${professional_id}`;
    const occupiedSlots = occupiedSlotsCache[cacheKey] || [];
    
    console.log('Calculando horários disponíveis:', {
      data: dateStr,
      profissional: professional_id,
      horariosOcupados: occupiedSlots,
      todosHorarios: allTimeSlots.length
    });

    // Duração total do serviço em minutos (usar tempos personalizados)
    const serviceDuration = calculateTotalTime();

    console.log('Duração total do serviço com tempos personalizados:', serviceDuration, 'minutos');

    // Filtrar apenas os horários que realmente estão disponíveis
    const availableSlots = allTimeSlots.filter(slot => {
      // Converter o horário do slot para minutos desde o início do dia
      const [hours, minutes] = slot.split(':').map(Number);
      const slotMinutes = hours * 60 + minutes;
      
      // Calcular o horário final do serviço
      const endTimeMinutes = slotMinutes + serviceDuration;
      
      // Não permitir agendamentos que terminem depois das 20:00 (1200 minutos)
      if (endTimeMinutes > 1380) { // Mudado para 23:00 (1380 minutos) para permitir até 22:45
        console.log(`Horário ${slot} descartado por ultrapassar 23:00`);
        return false;
      }

      // Verificar se algum dos horários necessários está ocupado
      for (let i = 0; i < Math.ceil(serviceDuration / 30); i++) {
        const checkMinutes = slotMinutes + (i * 30);
        const checkHour = Math.floor(checkMinutes / 60);
        const checkMinute = checkMinutes % 60;
        const checkSlot = `${String(checkHour).padStart(2, '0')}:${String(checkMinute).padStart(2, '0')}`;
        
        if (occupiedSlots.includes(checkSlot)) {
          console.log(`Horário ${slot} descartado por conflito em ${checkSlot}`);
          return false;
        }
      }
      
      return true;
    });

    console.log('Horários disponíveis após filtro:', availableSlots.length, 'de', allTimeSlots.length);
    return availableSlots;
  }, [allTimeSlots, formData, tempDate, occupiedSlotsCache, services, customTimes]);

  // Adicionar novo cálculo para mostrar todos os horários, marcando os ocupados
  const allTimeSlotsWithStatus = useMemo(() => {
    const { professional_id } = formData;

    if (!professional_id) return [];

    const dateStr = format(tempDate, 'yyyy-MM-dd');
    const cacheKey = `${dateStr}-${professional_id}`;
    const occupiedSlots = occupiedSlotsCache[cacheKey] || [];
    
    // Duração total do serviço em minutos
    const serviceDuration = calculateTotalTime();
    
    console.log(`Calculando slots disponíveis com duração de serviço: ${serviceDuration} minutos`);
    console.log(`Slots ocupados encontrados: ${occupiedSlots.length}`, occupiedSlots);

    return allTimeSlots.map(slot => {
      const [hours, minutes] = slot.split(':').map(Number);
      const slotMinutes = hours * 60 + minutes;
      
      // Calcular o horário final do serviço
      const endTimeMinutes = slotMinutes + serviceDuration;
      
      // Verificar se o horário ultrapassa o limite de 21:00
      const exceedsTimeLimit = endTimeMinutes > 1380; // 23:00 = 1380 minutos (mudado de 1260)

      // Verificar se algum horário no intervalo deste agendamento está ocupado
      let isOccupied = false;
      
      // Verificar cada intervalo de 15 minutos para ter certeza que não há conflitos
      for (let i = 0; i < Math.ceil(serviceDuration / 15); i++) {
        const checkMinutes = slotMinutes + (i * 15);
        const checkHour = Math.floor(checkMinutes / 60);
        const checkMinute = checkMinutes % 60;
        const checkSlot = `${String(checkHour).padStart(2, '0')}:${String(checkMinute).padStart(2, '0')}`;
        
        if (occupiedSlots.includes(checkSlot)) {
          console.log(`Slot ${slot} marcado como ocupado devido a conflito em ${checkSlot}`);
          isOccupied = true;
          break;
        }
      }

      // Também verificar se este slot está dentro da duração de algum agendamento existente
      if (!isOccupied) {
        for (const occupiedSlot of occupiedSlots) {
          const [occHours, occMinutes] = occupiedSlot.split(':').map(Number);
          const occSlotMinutes = occHours * 60 + occMinutes;
          
          // Encontrar a duração do agendamento existente
          // Como não temos acesso direto à duração, assumimos que cada slot
          // ocupado representa uma marcação de 15 minutos
          const defaultDuration = 15;
          
          // Verificar se o slot atual (que queremos agendar) está dentro da 
          // duração de algum agendamento existente
          if (slotMinutes >= occSlotMinutes && slotMinutes < (occSlotMinutes + defaultDuration)) {
            console.log(`Slot ${slot} está dentro da duração de um agendamento existente às ${occupiedSlot}`);
            isOccupied = true;
            break;
          }
        }
      }

      return {
        time: slot,
        isAvailable: !isOccupied && !exceedsTimeLimit
      };
    });
  }, [allTimeSlots, formData, tempDate, occupiedSlotsCache, calculateTotalTime]);

  // Função para confirmar data e hora
  const confirmDateTime = () => {
    // Validar data e hora temporárias
    if (!tempDate) {
      toast.error('Selecione uma data para o agendamento');
      return;
    }
    
    if (!tempTime) {
      toast.error('Selecione um horário para o agendamento');
      return;
    }
    
    try {
      updateFormData({
        date: format(tempDate, 'yyyy-MM-dd'),
        time: tempTime
      });
      
      setDateTimeConfirmed(true);
      setTimesConfirmed(true);
      setFormStep(6);
      setShowDateTimeModal(false);
      
    } catch (error) {
      console.error('Erro ao confirmar data e hora:', error);
      toast.error('Ocorreu um erro ao confirmar data e hora. Tente novamente.');
    }
  };

  // Função para lidar com preços personalizados
  const handleCustomPriceChange = (serviceName: string, price: number) => {
    const safePrice = price < 0 ? 0 : price;
    
    setCustomPrices(prev => ({
      ...prev,
      [serviceName]: safePrice
    }));
  };

  const handleConfirmPricesAndTimes = () => {
    console.log("Confirmando tempos personalizados", {
      isTimePreSelected, 
      isDatePreSelected, 
      dateTimeConfirmed
    });
    
    // Atualizar formData apenas com os tempos personalizados
    updateFormData({
      custom_times: customTimes
    });
    
    setTimesConfirmed(true);
    setShowTimeEditing(false);
    setShowTimeModal(false);
    
    // Verificar se data e hora já foram pré-selecionadas
    if (isTimePreSelected && isDatePreSelected && dateTimeConfirmed) {
      // Se já tiver data e hora pré-selecionadas, avançar direto para o próximo passo
      setFormStep(6);
    } else {
      // Caso contrário, abrir o modal de data e hora
      setShowDateTimeModal(true);
      setFormStep(5);
    }
  };

  // Modificar a função que confirma a seleção de serviços
  const handleConfirmServices = () => {
    console.log("Confirmando serviços", {
      isTimePreSelected, 
      isDatePreSelected, 
      isProfessionalPreSelected, 
      dateTimeConfirmed
    });
    
    setShowServices(false);
    
    if (formData.services.length > 0) {
      // Se data e hora já foram pré-selecionadas, pular modal de data e hora
      if (isTimePreSelected && isDatePreSelected && dateTimeConfirmed) {
        // Avançar direto para finalização
        setTimesConfirmed(true);
        setFormStep(6);
      } else {
        // Mostrar o modal de tempos primeiro
        setShowTimeModal(true);
        setFormStep(4);
      }
    }
  };

  // Adicionar useEffect para controlar o scroll
  useEffect(() => {
    if (showTimeModal) {
      // Bloquear o scroll do body quando o modal estiver aberto
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
    } else {
      // Restaurar o scroll quando o modal fechar
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    }

    // Cleanup ao desmontar o componente
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
    };
  }, [showTimeModal]);

  // Adicionar efeito para otimização do carregamento
  useEffect(() => {
    // Carregar dados essenciais imediatamente quando o componente é montado
    const preloadData = async () => {
      try {
        // Iniciar carregamento de dados em paralelo
        const preloadPromises = [
          getClients(),
          getProfessionals(),
          getServices()
        ];
        
        // Executar todas as promessas em paralelo
        await Promise.all(preloadPromises);
      } catch (error) {
        console.error('Erro ao pré-carregar dados:', error);
      }
    };
    
    preloadData();
  }, []);

  // Se o componente estiver carregando, mostrar esqueleto
  if (loading) {
    return (
      <div className="w-full max-h-[95vh] overflow-y-auto flex flex-col">
        {/* Botão de fechar no topo */}
        <div className="flex justify-end sticky top-0 right-0 p-2 z-20">
          <button 
            onClick={onClose}
            className="rounded-full p-1 bg-white shadow-md hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>
        
        {/* Indicador de loading */}
        <div className="flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          <span className="ml-2 text-indigo-500 font-medium">Carregando...</span>
        </div>

        {/* Esqueleto do formulário */}
        <div className="space-y-4 p-4">
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Function para lidar com o formatter do date-fns
  const formatSelectedDate = (date: string) => {
    try {
      return format(parseISO(date), 'dd/MM/yyyy');
    } catch (error) {
      console.error('Erro ao formatar data:', error);
      return date;
    }
  };

  const renderTimeSlots = () => {
    if (!allTimeSlotsWithStatus || allTimeSlotsWithStatus.length === 0) {
      return null;
    }

    return (
      <div className="grid grid-cols-4 gap-1 mt-4">
        {allTimeSlotsWithStatus.map((slotInfo, index) => {
          if (!slotInfo || !slotInfo.time) {
            return null;
          }
          
          return (
            <button
              key={index}
              className={`px-2 py-1 text-sm rounded ${
                slotInfo.isAvailable
                  ? 'bg-gray-100 hover:bg-gray-200 cursor-pointer'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
              } ${tempTime === slotInfo.time ? 'bg-blue-500 text-white' : ''}`}
              onClick={() => slotInfo.isAvailable ? handleDateTimeSelection(slotInfo.time) : null}
              disabled={!slotInfo.isAvailable}
            >
              {slotInfo.time}
            </button>
          );
        })}
      </div>
    );
  };

  // Adicionar função handleCustomTimeChange que estava faltando
  const handleCustomTimeChange = (serviceId: string, time: number) => {
    // Garantir que o tempo mínimo seja 15 minutos
    const safeTime = Math.max(15, time);
    
    setCustomTimes(prev => ({
      ...prev,
      [serviceId]: safeTime
    }));
  };

  // Adicionar função para calcular end_time
  const calculateEndTime = (startTime: string, durationMinutes: number): string => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const startDate = new Date();
    startDate.setHours(hours, minutes, 0, 0);
    
    const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
    const endHours = endDate.getHours().toString().padStart(2, '0');
    const endMinutes = endDate.getMinutes().toString().padStart(2, '0');
    
    return `${endHours}:${endMinutes}`;
  };

  return (
    <div className="w-full max-h-[95vh] overflow-y-auto flex flex-col">
      {/* Botão de fechar no topo */}
      <div className="flex justify-end sticky top-0 right-0 p-2 z-20">
        <button 
          onClick={onClose}
          className="rounded-full p-1 bg-white shadow-md hover:bg-gray-100 transition-colors"
        >
          <X className="h-5 w-5 text-gray-600" />
        </button>
      </div>
      
      {/* Aviso importante - Edição de agendamento */}
      {isEditing && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-2 mx-3">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                <strong>Atenção:</strong> Por favor, preencha todos os campos novamente para confirmar o agendamento.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Indicador de pasos (solo visible en nuevos agendamientos) */}
      {!isEditing && (
        <div className="flex items-center justify-center sticky top-8 bg-white z-10 py-2 border-b">
          <span className="text-base text-indigo-500 font-medium">
            {format(new Date(), "dd 'de' MMMM", { locale: ptBR })}
          </span>
          <span className="mx-1 text-gray-400">•</span>
          <span className="text-base text-gray-600">
            {tempTime || formData.time || format(new Date(), "HH:mm")}
          </span>
        </div>
      )}

      <form className="flex-1 space-y-2 sm:space-y-4 p-3 pb-28">
        {/* Cliente - Versão compacta */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">
              Cliente <span className="text-red-500">*</span>
            </label>
            
            {/* Botão de Agendamento Espontâneo */}
            <button
              type="button"
              onClick={handleSpontaneousAppointment}
              className={`ml-2 px-2 py-1 text-xs rounded-md ${
                isSpontaneous
                  ? 'bg-green-100 text-green-800 border border-green-300'
                  : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
              }`}
            >
              <span className="flex items-center">
                <Users className="h-3 w-3 mr-1" />
                Anônimo
                {isSpontaneous && <Check className="h-3 w-3 ml-1" />}
              </span>
            </button>
          </div>
          
          {isSpontaneous ? (
            <div className="p-2 bg-green-50 rounded-md border border-green-200 flex items-center mb-3">
              <Users className="h-5 w-5 text-green-500 mr-2" />
              <span className="text-green-700">Agendamento Anônimo</span>
              <button 
                className="ml-auto text-green-600 hover:text-green-800"
                onClick={() => {
                  setIsSpontaneous(false);
                  setClientSearch('');
                  updateFormData({ client_id: '' });
                }}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <input
                  type="text"
                  className="w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Buscar cliente por nome, telefone ou email..."
                  value={clientSearch}
                  onChange={handleClientSearchChange}
                  onFocus={() => setShowClientResults(true)}
                  onKeyDown={handleKeyDown}
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
              </div>
              
              {showClientResults && (
                <div className="relative mt-1" ref={clientSearchRef}>
                  <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-lg max-h-60 overflow-y-auto">
                    {clientSearch.trim() && filteredClients.length === 0 ? (
                      <div className="p-3 text-center">
                        <p className="text-sm text-gray-500 mb-2">Nenhum cliente encontrado</p>
                        <button
                          type="button"
                          className="px-3 py-1 text-xs bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100"
                          onClick={() => setShowNewClientForm(true)}
                        >
                          Cadastrar novo cliente
                        </button>
                      </div>
                    ) : (
                      filteredClients.map((client, index) => (
                        <div
                          key={client.id}
                          className={`p-3 cursor-pointer hover:bg-gray-50 flex items-center ${
                            index === selectedIndex ? 'bg-indigo-50' : ''
                          }`}
                          onClick={() => selectClient(client)}
                        >
                          <div className="flex-grow">
                            <p className="font-medium">{client.name}</p>
                            {client.phone && (
                              <p className="text-xs text-gray-500 flex items-center">
                                <Phone className="h-3 w-3 mr-1" />
                                {formatPhone(client.phone)}
                              </p>
                            )}
                          </div>
                          {formData.client_id === client.id && (
                            <Check className="h-5 w-5 text-indigo-600" />
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Profissional - Versão compacta */}
        {(formStep >= 2 || isEditing) && (
          <div className="mb-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Profissional <span className="text-red-500">*</span>
            </label>
            <div className="relative" ref={professionalSearchRef}>
              <button
                type="button"
                onClick={() => setShowProfessionalResults(true)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 pl-9 text-left flex items-center justify-between text-sm"
              >
                {formData.professional_id ? (
                  <span className="text-gray-900 truncate">
                    {professionals.find(p => p.id === formData.professional_id)?.name}
                  </span>
                ) : (
                  <span className="text-gray-500">Selecionar profissional</span>
                )}
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </button>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              
              {showProfessionalResults && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                    <div className="p-5 border-b border-gray-200">
                      <h3 className="text-lg font-medium text-gray-900 pl-1">Selecionar Profissional</h3>
                    </div>
                    
                    <div className="overflow-y-auto max-h-[40vh] p-2">
                      {professionals.map((professional) => (
                        <button
                          key={professional.id}
                          onClick={() => {
                            handleProfessionalChange(professional);
                            setShowProfessionalResults(false);
                          }}
                          className={`
                            w-full px-5 py-3 text-left hover:bg-gray-50 transition-colors mb-1 rounded-lg
                            ${formData.professional_id === professional.id ? 'bg-gray-50' : ''}
                          `}
                        >
                          <div className="font-medium text-gray-900 mb-1">{professional.name}</div>
                          {professional.role && (
                            <div className="flex items-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              <span className="text-xs text-gray-500">{professional.role}</span>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Serviços - Versão compacta */}
        {(formStep >= 3 || isEditing) && (
          <div className="mb-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Serviços <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="relative">
                <input
                  type="text"
                  onClick={() => setShowServices(true)} 
                  placeholder="Buscar serviços..."
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 pl-9 text-sm cursor-pointer"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                </div>
              </div>
              
              {formData.services.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {formData.services.map((service) => (
                    <span key={service.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 truncate">
                      {service.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Data e Horário - Versão super compacta */}
        {(formStep >= 5 || isEditing) && timesConfirmed && (
          <div className="mb-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Data e Horário <span className="text-red-500">*</span>
            </label>
            
            {dateTimeConfirmed ? (
              <div className="flex items-center justify-between bg-gray-50 p-2 rounded-lg">
                <div>
                  <p className="text-gray-900 text-sm font-medium">
                    {format(parseISO(formData.date), "d MMM", { locale: ptBR })} | {formData.time}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openDateTimeModal}
                  className="text-indigo-600 hover:text-indigo-700 text-xs flex items-center"
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Alterar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={openDateTimeModal}
                className="w-full flex items-center justify-center gap-1 px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:text-gray-900 hover:border-gray-400 transition-colors text-sm"
              >
                <CalendarIcon className="h-4 w-4" />
                <span>Selecionar data e horário</span>
              </button>
            )}
          </div>
        )}

        {/* Observações - Versão compacta única */}
        {(formStep >= 6 || isEditing) && (
          <div className="mb-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Observações
            </label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={1}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Observações importantes..."
            />
          </div>
        )}

        {/* Botão de confirmar dentro do formulário com margen segura */}
        {(formStep >= 6 || (isEditing && dateTimeConfirmed) || (formData.client_id && formData.professional_id && formData.services.length > 0 && formData.date && formData.time)) && (
          <div className="bg-white mt-2 rounded-lg">
            <button 
              type="button" 
              onClick={handleSubmit}
              disabled={submitting || !isFormValid(formData)}
              className={`
                w-full py-3 text-sm font-medium rounded-lg shadow-md
                transition-all duration-200
                ${submitting
                  ? 'bg-gray-400 cursor-not-allowed'
                  : isFormValid(formData)
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }
              `}
            >
              {submitting ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                  <span>Salvando...</span>
                </div>
              ) : (
                isEditing ? 'Salvar Alterações' : 'Confirmar Agendamento'
              )}
            </button>
          </div>
        )}
      </form>

      {/* Modal de Data e Hora - Optimizado para aparecer no centro */}
      {showDateTimeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full sm:max-w-md max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-medium text-gray-900">Data e Hora</h3>
                <button onClick={closeDateTimeModal} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              {/* Seleção de Data - Compacto */}
              <div className="my-3">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => {
                      const newDate = new Date(tempDate);
                      newDate.setDate(newDate.getDate() - 1);
                      setTempDate(newDate);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-full"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm font-medium">
                    {format(tempDate, "d 'de' MMM", { locale: ptBR })}
                  </span>
                  <button
                    onClick={() => {
                      const newDate = new Date(tempDate);
                      newDate.setDate(newDate.getDate() + 1);
                      setTempDate(newDate);
                    }}
                    className="p-2 hover:bg-gray-100 rounded-full"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-y-auto p-4 flex-1 max-h-[60vh]">
              {/* Legenda para horários disponíveis */}
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-700">Horários Disponíveis</h4>
                <div className="flex text-xs items-center">
                  <div className="flex items-center mr-3">
                    <span className="w-3 h-3 bg-gray-100 rounded-full inline-block mr-1"></span>
                    <span className="text-gray-600">Passados</span>
                  </div>
                  <div className="flex items-center mr-3">
                    <span className="w-3 h-3 bg-red-100 rounded-full inline-block mr-1"></span>
                    <span className="text-red-500">Ocupados</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-3 h-3 bg-indigo-100 rounded-full inline-block mr-1"></span>
                    <span className="text-indigo-700">Disponíveis</span>
                  </div>
                </div>
              </div>
              
              {/* Seleção de Horário - Compacto */}
              <div>
                <div className="grid grid-cols-4 gap-2">
                  {loadingTimeSlots ? (
                    <div className="col-span-4 flex justify-center py-3">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500"></div>
                    </div>
                  ) : allTimeSlotsWithStatus && allTimeSlotsWithStatus.length > 0 ? (
                    allTimeSlotsWithStatus.map((slotInfo) => {
                      // Garantir que slotInfo não seja indefinido
                      if (!slotInfo) return null;
                      
                      const { time, isAvailable } = slotInfo;
                      
                      // Verificar se time existe
                      if (!time) return null;
                      
                      // Verificar se o horário já passou
                      const now = new Date();
                      const currentDate = now.toISOString().split('T')[0];
                      const selectedDate = format(tempDate, 'yyyy-MM-dd');
                      const [hours, minutes] = time.split(':').map(Number);
                      const slotTime = new Date(tempDate);
                      slotTime.setHours(hours, minutes, 0);
                      
                      // Se for hoje e o horário já passou
                      const isToday = currentDate === selectedDate;
                      const isPast = isToday && slotTime < now;
                      
                      return (
                        <button
                          key={time}
                          onClick={() => {
                            if (isAvailable) handleDateTimeSelection(time);
                          }}
                          disabled={!isAvailable}
                          className={`
                            py-2.5 text-center text-sm rounded-lg border transition-colors relative
                            ${tempTime === time
                              ? 'bg-indigo-600 border-indigo-700 text-white font-bold'
                              : isPast
                                ? 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200 hover:border-gray-400'
                                : !isAvailable
                                  ? 'bg-red-100 text-red-500 border-red-200 cursor-not-allowed'
                                  : 'bg-indigo-50 border-indigo-200 hover:border-indigo-300 hover:bg-indigo-100 text-indigo-700'
                            }
                          `}
                        >
                          {time}
                          {isPast && !tempTime && (
                            <span className="absolute -top-1 -right-1 flex h-2 w-2">
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-gray-400"></span>
                            </span>
                          )}
                          {tempTime === time && (
                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                            </span>
                          )}
                        </button>
                      );
                    })
                  ) : (
                    <p className="col-span-4 text-center text-gray-500 py-3 text-xs">
                      Primeiro selecione o Profissional
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 bg-white">
              <button
                onClick={confirmDateTime}
                disabled={!tempTime}
                className={`
                  w-full py-3 text-sm font-medium rounded-lg
                  ${tempTime
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }
                `}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Novo Cliente - Versão Simplificada */}
      {showNewClientForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm">
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-medium text-gray-900">Novo Cliente</h3>
                <button 
                  onClick={() => setShowNewClientForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleNewClientSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Nome <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newClientData.name}
                    onChange={(e) => setNewClientData({ ...newClientData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Telefone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={newClientData.phone}
                    onChange={(e) => setNewClientData({ ...newClientData, phone: formatPhone(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    required
                    placeholder="(00) 00000-0000"
                  />
                </div>

                <button
                  type="submit"
                  disabled={creatingClient}
                  className="w-full py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-gray-400"
                >
                  {creatingClient ? 'Salvando...' : 'Cadastrar Cliente'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Preços e Tempos - Redesenhado para mobile */}
      {showTimeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col overflow-y-auto my-auto">
            <div className="p-3 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-medium text-gray-900">Personalizar Duração dos Serviços</h3>
                <button 
                  onClick={() => setShowTimeModal(false)} 
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="p-3 overflow-y-auto flex-1 max-h-[40vh]">
              <div className="space-y-3">
                {formData.services.map((service) => {
                  const customTime = customTimes[service.id] ?? service.estimated_time;

                  return (
                    <div key={service.id} className="bg-gray-50 p-3 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium text-gray-900">{service.name}</h4>
                      </div>

                      {/* Edição de Tempo - Interface melhorada */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-2">
                          Duração do serviço
                        </label>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleCustomTimeChange(service.id, Math.max(15, customTime - 5))}
                            className="p-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                          >
                            <span className="sr-only">Diminuir 5 minutos</span>
                            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                            </svg>
                          </button>

                          <div className="relative flex-1">
                            <input
                              type="number"
                              min="15"
                              step="5"
                              value={customTime}
                              onChange={(e) => {
                                const value = parseInt(e.target.value);
                                handleCustomTimeChange(service.id, value);
                              }}
                              className="w-full px-3 py-2.5 text-center border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-md font-medium"
                            />
                            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                              min
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleCustomTimeChange(service.id, customTime + 5)}
                            className="p-2.5 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                          >
                            <span className="sr-only">Aumentar 5 minutos</span>
                            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-3 bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-gray-500">
                  Duração total: {formatTimeFromMinutes(calculateTotalTime())}
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowTimeModal(false)}
                  className="flex-1 py-2.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPricesAndTimes}
                  className="flex-1 py-2.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mensagem de pré-seleção */}
      {false && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded-r-md">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-800 font-medium">
                Alguns campos já foram preenchidos automaticamente:
              </p>
              <ul className="mt-1 text-sm text-blue-700 list-disc list-inside">
                {isTimePreSelected && formData.time && <li>Horário: <span className="font-medium">{formData.time}</span></li>}
                {isDatePreSelected && formData.date && <li>Data: <span className="font-medium">{formatSelectedDate(formData.date)}</span></li>}
                {isProfessionalPreSelected && <li>Profissional já selecionado</li>}
              </ul>
              <p className="mt-1 text-sm text-blue-800">
                Por favor, continue preenchendo os campos restantes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Serviços */}
      {showServices && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col overflow-y-auto my-auto">
            <div className="p-3 border-b border-gray-200 sticky top-0 bg-white z-10">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-medium text-gray-900">Selecionar Serviços</h3>
                <button 
                  onClick={() => setShowServices(false)} 
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-2 relative">
                <input
                  type="text"
                  value={searchService}
                  onChange={(e) => setSearchService(e.target.value)}
                  placeholder="Buscar serviço..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 pl-9 text-sm"
                  autoFocus
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            </div>
            
            <div className="p-3 overflow-y-auto flex-1 max-h-[40vh]">
              <div className="divide-y divide-gray-100">
                {services
                  .filter(service => 
                    searchService.trim() === '' || 
                    service.name.toLowerCase().includes(searchService.toLowerCase())
                  )
                  .map((service) => (
                    <div
                      key={service.id}
                      onClick={() => handleServiceToggle(service.name)}
                      className={`
                        p-3 cursor-pointer transition-colors rounded-lg mb-1
                        ${formData.services.some(s => s.id === service.id)
                          ? 'bg-indigo-50'
                          : 'hover:bg-gray-50'
                        }
                      `}
                    >
                      <div className="font-medium text-gray-900">{service.name}</div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <span className="flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {formatTimeFromMinutes(service.estimated_time)}
                        </span>
                        <span className="font-medium text-indigo-600">{formatPrice(service.price)}</span>
                        {formData.services.some(s => s.id === service.id) && (
                          <span className="ml-auto">
                            <Check className="h-4 w-4 text-indigo-600" />
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                
                {searchService.trim() !== '' && services.filter(s => 
                  s.name.toLowerCase().includes(searchService.toLowerCase())
                ).length === 0 && (
                  <div className="p-3 text-center text-sm text-gray-500">
                    Nenhum serviço encontrado
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-3 bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-gray-500">
                  {formData.services.length} serviço(s) selecionado(s)
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowServices(false)}
                  className="flex-1 py-2.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowServices(false);
                    if (formData.services.length > 0) {
                      // Mostrar o modal de preços e tempos primeiro
                      setShowTimeModal(true);
                      setFormStep(4);
                    }
                  }}
                  disabled={formData.services.length === 0}
                  className={`
                    flex-1 py-2.5 text-xs font-medium rounded-lg
                    ${formData.services.length > 0
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }
                  `}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Adicionar esta função auxiliar no início do arquivo, após os imports
function highlightMatch(text: string, query: string): JSX.Element {
  if (!query.trim()) return <>{text}</>;
  
  const regex = new RegExp(`(${query.trim()})`, 'gi');
  const parts = text.split(regex);
  
  return (
    <>
      {parts.map((part, i) => 
        regex.test(part) ? (
          <mark key={i} className="bg-indigo-100 text-indigo-800 rounded px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

// Adicionar esta função auxiliar junto con las otras funciones auxiliares al inicio del archivo
function isValidDate(dateString: string): boolean {
  try {
    const date = parseISO(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  } catch {
    return false;
  }
}