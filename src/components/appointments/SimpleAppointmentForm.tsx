import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-hot-toast';
import { X, Search, User, Calendar, Check, PlusCircle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useAppointments } from '../../contexts/AppointmentContext';

// Tipos e interfaces
interface SimpleAppointmentFormProps {
  selectedDate: Date;
  selectedTime: string;
  professionalId: string;
  professionalName: string;
  onClose: () => void;
  onSuccess?: () => void;
}

interface Client {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

interface Service {
  id: string;
  name: string;
  estimated_time: number;
  price: number;
}

// Utilitários
const formatDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes}min`;
  }
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (mins === 0) {
    return `${hours}h`;
  } else {
    return `${hours}h ${mins}min`;
  }
};

// Hook para gerenciar dados de clientes
const useClientsData = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const fetchClients = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      toast.error('Erro ao carregar clientes');
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchClients();
  }, []);
  
  return { clients, isLoading };
};

// Hook para gerenciar dados de serviços
const useServicesData = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [servicesByCategory, setServicesByCategory] = useState<Record<string, Service[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  
  const fetchServices = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('name');
      
      if (error) throw error;
      
      setServices(data || []);
      
      // Agrupar serviços por categoria
      const groupedServices: Record<string, Service[]> = {};
      const defaultCategory = 'Todos os Serviços';
      
      // Como a coluna category não existe no banco, usar apenas uma categoria padrão
      groupedServices[defaultCategory] = data || [];
      
      setServicesByCategory(groupedServices);
    } catch (error) {
      console.error('Erro ao carregar serviços:', error);
      toast.error('Erro ao carregar serviços');
    } finally {
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchServices();
  }, []);
  
  return { services, servicesByCategory, isLoading };
};

// Componente de Seleção de Cliente
const ClientSelection = ({ 
  onSelectClient, 
  onSetAnonymous,
  onBack
}: { 
  onSelectClient: (client: Client) => void, 
  onSetAnonymous: () => void,
  onBack: () => void
}) => {
  const { clients } = useClientsData();
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const clientInputRef = useRef<HTMLInputElement>(null);
  
  // Focar no input quando o componente montar
  useEffect(() => {
    setTimeout(() => {
      if (clientInputRef.current) {
        clientInputRef.current.focus();
      }
    }, 100);
  }, []);
  
  // Filtrar clientes
  const filteredClients = clientSearchTerm 
    ? clients.filter(client => 
        client.name.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
        (client.phone && client.phone.includes(clientSearchTerm))
      )
    : clients;
    
  const handleClientSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setClientSearchTerm(e.target.value);
    setIsAnonymous(false);
  };
  
  const handleSelectClient = (client: Client) => {
    onSelectClient(client);
  };
  
  const handleAnonymous = () => {
    setIsAnonymous(true);
    onSetAnonymous();
  };
  
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium text-gray-800">Selecione o Cliente</h2>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center justify-between">
          <div className="flex items-center">
            Cliente <span className="text-xs text-gray-500 ml-1">(opcional)</span>
          </div>
          
          <button
            type="button"
            onClick={handleAnonymous}
            className={`ml-2 px-2 py-1 text-xs rounded-md ${
              isAnonymous
                ? 'bg-green-100 text-green-800 border border-green-300'
                : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
            }`}
          >
            <span className="flex items-center">
              <User className="h-3 w-3 mr-1" />
              Anônimo
              {isAnonymous && <Check className="h-3 w-3 ml-1" />}
            </span>
          </button>
        </label>
        
        {isAnonymous ? (
          <div className="p-2 bg-green-50 rounded-md border border-green-200 flex items-center mb-3">
            <User className="h-5 w-5 text-green-500 mr-2" />
            <span className="text-green-700">Agendamento Anônimo</span>
            <button 
              className="ml-auto text-green-600 hover:text-green-800"
              onClick={() => setIsAnonymous(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              ref={clientInputRef}
              type="text"
              value={clientSearchTerm}
              onChange={handleClientSearch}
              placeholder="Buscar cliente por nome ou telefone"
              className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
        )}
      </div>
      
      {!isAnonymous && (
        <div className="max-h-[300px] overflow-y-auto pr-1">
          {filteredClients.length > 0 ? (
            <ul className="space-y-1">
              {filteredClients.map((client) => (
                <li key={client.id}>
                  <button
                    onClick={() => handleSelectClient(client)}
                    className="w-full px-3 py-2 rounded-md hover:bg-gray-100 text-left flex justify-between items-center"
                  >
                    <div>
                      <p className="font-medium text-gray-800">{client.name}</p>
                      {client.phone && (
                        <p className="text-sm text-gray-500">{client.phone}</p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : clientSearchTerm ? (
            <div className="text-center py-4 text-gray-500">
              <p>Nenhum cliente encontrado</p>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              <p>Digite para buscar um cliente ou selecione "Anônimo"</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Componente de Seleção de Serviço
const ServiceSelection = ({ 
  onSelectService, 
  clientName,
  isAnonymous,
  onBack 
}: { 
  onSelectService: (service: Service) => void,
  clientName?: string,
  isAnonymous: boolean,
  onBack: () => void
}) => {
  const { services, servicesByCategory } = useServicesData();
  const [serviceSearchTerm, setServiceSearchTerm] = useState('');
  const serviceInputRef = useRef<HTMLInputElement>(null);
  
  // Focar no input quando o componente montar
  useEffect(() => {
    setTimeout(() => {
      if (serviceInputRef.current) {
        serviceInputRef.current.focus();
      }
    }, 100);
  }, []);
  
  const handleServiceSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setServiceSearchTerm(e.target.value);
  };
  
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium text-gray-800">
        {isAnonymous ? 'Atendimento Anônimo' : (clientName ? `Cliente: ${clientName}` : 'Selecione o Serviço')}
      </h2>
      
      <div className="relative mb-4">
        <input
          ref={serviceInputRef}
          type="text"
          value={serviceSearchTerm}
          onChange={handleServiceSearch}
          placeholder="Buscar serviço por nome"
          className="w-full px-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
      </div>
      
      <div className="space-y-6 max-h-[400px] overflow-y-auto">
        {Object.entries(servicesByCategory).map(([category, categoryServices]) => {
          // Filtrar serviços da categoria com base na busca
          const visibleServices = serviceSearchTerm
            ? categoryServices.filter(s => 
                s.name.toLowerCase().includes(serviceSearchTerm.toLowerCase())
              )
            : categoryServices;
            
          if (visibleServices.length === 0) return null;
            
          return (
            <div key={category} className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700 flex items-center">
                {category} <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 rounded-full">{visibleServices.length}</span>
              </h3>
              
              <div className="space-y-2">
                {visibleServices.map(service => (
                  <div
                    key={service.id}
                    className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
                    onClick={() => onSelectService(service)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-sm font-medium">{service.name}</span>
                        <span className="block text-xs text-gray-500">{formatDuration(service.estimated_time)}</span>
                      </div>
                      <div className="text-sm font-medium text-gray-900">
                        {service.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Componente do Cabeçalho
const Header = ({ 
  selectedDate, 
  selectedTime, 
  professionalName,
  onClose
}: { 
  selectedDate: Date,
  selectedTime: string,
  professionalName: string,
  onClose: () => void
}) => (
  <div className="flex justify-between items-center border-b border-gray-200 pb-4">
    <div>
      <h2 className="text-xl font-bold text-gray-900">Adicionar agendamento</h2>
      <span className="text-sm text-gray-500 flex items-center mt-1">
        <Calendar className="w-3 h-3 mr-1" />
        {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })} • {selectedTime} • {professionalName}
      </span>
    </div>
    <button
      onClick={onClose}
      className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
    >
      <X className="h-6 w-6" />
    </button>
  </div>
);

// Componente Principal
export default function SimpleAppointmentForm({
  selectedDate,
  selectedTime,
  professionalId,
  professionalName,
  onClose,
  onSuccess
}: SimpleAppointmentFormProps) {
  // Estados
  const [step, setStep] = useState<'client' | 'service'>('service');
  const [isLoading, setIsLoading] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  
  // Context
  const { addAppointment } = useAppointments();
  
  // Navegar para seleção de serviço após selecionar cliente
  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    setIsAnonymous(false);
    setStep('service');
  };
  
  // Configurar como agendamento anônimo
  const handleSetAnonymous = () => {
    setIsAnonymous(true);
    setSelectedClient(null);
    setStep('service');
  };
  
  // Voltar para etapa anterior
  const handleBack = () => {
    if (step === 'service') {
      setStep('client');
    }
  };
  
  // Salvar agendamento após selecionar serviço
  const handleSelectService = async (service: Service) => {
    setIsLoading(true);
    
    try {
      // Verificar se o serviço tem ID válido
      if (!service.id || typeof service.id !== 'string' || service.id.trim() === '') {
        console.error('[ERRO] Serviço sem ID válido:', service);
        toast.error('Serviço inválido selecionado. Por favor, selecione outro serviço.');
        return;
      }
      
      // Calcular horário de término baseado na duração do serviço
      const startTime = selectedTime;
      const serviceDuration = service.estimated_time || 30;
      const endTime = calculateEndTime(startTime, serviceDuration);
      
      // Preparar dados completos do serviço
      const serviceData = {
        id: service.id,
        service_id: service.id, // Garantir que service_id esteja definido explicitamente
        professional_id: professionalId,
        original_price: service.price,
        final_price: service.price,
        duration: serviceDuration, 
        service_value: service.price,
        // Valores calculados conforme regra de negócio
        net_service_value: service.price * 0.9, // Exemplo: 90% do valor
        payment_fee: service.price * 0.05, // Exemplo: 5% de taxa
        salon_profit: service.price * 0.3, // Exemplo: 30% de lucro
        discount_payment_fee: false
      };
      
      // Verificação final de segurança
      if (!serviceData.service_id) {
        console.error('[ERRO CRÍTICO] service_id não definido após mapeamento:', serviceData);
        toast.error('Erro ao processar serviço. Por favor, tente novamente.');
        return;
      }
      
      const appointmentData = {
        client_id: isAnonymous ? null : (selectedClient?.id || null),
        professional_id: professionalId,
        _selectedServices: [serviceData],
        date: format(selectedDate, 'yyyy-MM-dd'),
        time: selectedTime,
        status: 'agendado' as const,
        notes: isAnonymous ? 'Atendimento anônimo' : ''
      };
      
      console.log('Criando agendamento com dados:', appointmentData);
      console.log('IMPORTANTE: O campo _selectedServices será removido automaticamente antes do envio ao Supabase');
      
      await addAppointment(appointmentData as any);
      toast.success('Agendamento criado com sucesso!');
      
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      toast.error('Erro ao criar agendamento');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Função para calcular o horário de término
  const calculateEndTime = (startTime: string, durationMinutes: number): string => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const startDate = new Date();
    startDate.setHours(hours, minutes, 0, 0);
    
    const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
    const endHours = endDate.getHours().toString().padStart(2, '0');
    const endMinutes = endDate.getMinutes().toString().padStart(2, '0');
    
    return `${endHours}:${endMinutes}`;
  };
  
  // Renderizar etapa atual
  const renderCurrentStep = () => {
    switch (step) {
      case 'client':
        return (
          <ClientSelection
            onSelectClient={handleSelectClient}
            onSetAnonymous={handleSetAnonymous}
            onBack={handleBack}
          />
        );
      case 'service':
        return (
          <ServiceSelection
            onSelectService={handleSelectService}
            clientName={selectedClient?.name}
            isAnonymous={isAnonymous}
            onBack={handleBack}
          />
        );
      default:
        return null;
    }
  };
  
  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <Header
        selectedDate={selectedDate}
        selectedTime={selectedTime}
        professionalName={professionalName}
        onClose={onClose}
      />
      
      {/* Conteúdo da etapa atual */}
      <div className="px-1 py-2">
        {renderCurrentStep()}
      </div>
      
      {/* Navegação */}
      {step === 'service' && (
        <div className="border-t border-gray-200 pt-4 flex justify-between">
          <button
            onClick={handleBack}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
          >
            Voltar
          </button>
          
          {isLoading && (
            <div className="text-sm text-indigo-600">Salvando...</div>
          )}
        </div>
      )}
    </div>
  );
} 