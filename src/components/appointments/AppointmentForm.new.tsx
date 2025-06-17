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

  // Usar o initialFormState definido acima
  const [formData, setFormData] = useState<FormData>({...initialFormState});
  const [submitting, setSubmitting] = useState(false);
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