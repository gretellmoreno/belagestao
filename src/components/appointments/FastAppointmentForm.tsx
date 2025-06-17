import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-hot-toast';
import { useAppointments } from '../../contexts/AppointmentContext';
import { supabase } from '../../lib/supabaseClient';
import { X, Search, ChevronRight, Check, User, Calendar, Clock } from 'lucide-react';

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

interface Professional {
  id: string;
  name: string;
  color?: string;
}

interface FastAppointmentFormProps {
  selectedDate: Date;
  selectedTime: string;
  professionalId: string;
  professionalName: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function FastAppointmentForm({
  selectedDate,
  selectedTime,
  professionalId,
  professionalName,
  onClose,
  onSuccess
}: FastAppointmentFormProps) {
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [isSpontaneous, setIsSpontaneous] = useState(false);
  
  const { addAppointment } = useAppointments();
  
  const formattedDate = format(selectedDate, "dd 'de' MMMM", { locale: ptBR });
  
  // Carregar dados iniciais
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        // Carregar clientes
        const { data: clientsData, error: clientsError } = await supabase
          .from('clients')
          .select('*')
          .order('name');
        
        if (clientsError) throw clientsError;
        
        // Carregar serviços
        const { data: servicesData, error: servicesError } = await supabase
          .from('services')
          .select('*')
          .order('name');
        
        if (servicesError) throw servicesError;
        
        setClients(clientsData || []);
        setServices(servicesData || []);
      } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
        toast.error('Erro ao carregar dados. Por favor, tente novamente.');
      } finally {
        setLoading(false);
      }
    };
    
    loadInitialData();
  }, []);
  
  // Filtrar clientes baseado no termo de busca
  useEffect(() => {
    if (clientSearchTerm) {
      const filtered = clients.filter(
        client => client.name.toLowerCase().includes(clientSearchTerm.toLowerCase())
      );
      setFilteredClients(filtered);
    } else {
      setFilteredClients([]);
    }
  }, [clientSearchTerm, clients]);
  
  // Manipuladores
  const handleClientSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setClientSearchTerm(e.target.value);
    setShowClientDropdown(true);
    setIsSpontaneous(false);
    setSelectedClient(null);
  };
  
  const selectClient = (client: Client) => {
    setSelectedClient(client);
    setClientSearchTerm(client.name);
    setShowClientDropdown(false);
    setIsSpontaneous(false);
  };
  
  const selectSpontaneous = () => {
    setSelectedClient(null);
    setClientSearchTerm('Anônimo');
    setShowClientDropdown(false);
    setIsSpontaneous(true);
  };
  
  const toggleService = (service: Service) => {
    setSelectedServices(prev => {
      const isSelected = prev.some(s => s.id === service.id);
      if (isSelected) {
        return prev.filter(s => s.id !== service.id);
      } else {
        return [...prev, service];
      }
    });
  };
  
  // Calcular duração total
  const calculateTotalDuration = (): number => {
    return selectedServices.reduce((total, service) => total + service.estimated_time, 0);
  };
  
  // Calcular valor total dos serviços
  const calculateTotalPrice = (): number => {
    return selectedServices.reduce((sum, service) => sum + service.price, 0);
  };
  
  // Formatação
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
  
  // Verificar se o botão salvar deve estar ativo
  const isSaveButtonEnabled = () => {
    return selectedServices.length > 0; // Cliente pode ser anônimo
  };
  
  // Enviar formulário
  const handleSubmit = async () => {
    if (!isSaveButtonEnabled()) {
      toast.error('Por favor, selecione pelo menos um serviço.');
      return;
    }
    
    setLoading(true);
    try {
      // Preparar dados dos serviços
      const servicesData = selectedServices.map(service => ({
        service_id: service.id,
        professional_id: professionalId,
        custom_price: service.price,
        custom_time: service.estimated_time,
        service_value: service.price,
        net_service_value: service.price * 0.9, // 90% do valor como exemplo
        payment_fee: 0,
        salon_profit: service.price * 0.3, // 30% como exemplo
        discount_payment_fee: false,
        commission_rate: 0 // Valor padrão
      }));
      
      // Dados do agendamento formatados
      const appointmentData = {
        client_id: selectedClient?.id || null,
        professional_id: professionalId,
        _selectedServices: servicesData,
        date: format(selectedDate, 'yyyy-MM-dd'),
        time: selectedTime,
        status: 'agendado' as const
      };
      
      console.log('Dados preparados para criar agendamento:', appointmentData);
      console.log('IMPORTANTE: O campo _selectedServices será removido automaticamente antes do envio ao Supabase');
      
      // Criar o agendamento
      await addAppointment(appointmentData as any);
      toast.success('Agendamento criado com sucesso!');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      toast.error('Erro ao criar agendamento. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="bg-white w-full max-w-md rounded-lg shadow-xl overflow-hidden">
      {/* Cabeçalho */}
      <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center text-white">
          <Calendar className="w-5 h-5 mr-2" />
          <h2 className="text-lg font-medium">Novo Agendamento Rápido</h2>
        </div>
        <button 
          onClick={onClose}
          className="text-white hover:text-indigo-100"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      
      <div className="p-6">
        {/* Informações pré-selecionadas */}
        <div className="mb-6 bg-indigo-50 p-4 rounded-lg">
          <div className="flex items-center mb-2">
            <Calendar className="w-4 h-4 text-indigo-600 mr-2" />
            <p className="text-sm text-gray-700">
              <span className="font-medium">{formattedDate}</span>
            </p>
          </div>
          <div className="flex items-center mb-2">
            <Clock className="w-4 h-4 text-indigo-600 mr-2" />
            <p className="text-sm text-gray-700">
              <span className="font-medium">{selectedTime}</span>
              <span className="mx-1">•</span>
              <span className="font-medium text-indigo-600">{professionalName}</span>
            </p>
          </div>
        </div>
        
        {/* Cliente */}
        <div className="mb-6">
          <label htmlFor="client" className="block text-sm font-medium text-gray-700 mb-1">
            Cliente
          </label>
          <div className="relative">
            <input
              id="client"
              type="text"
              value={clientSearchTerm}
              onChange={handleClientSearch}
              placeholder="Buscar cliente..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            
            {showClientDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg max-h-60 overflow-auto">
                <div className="py-1">
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-100 flex items-center"
                    onClick={selectSpontaneous}
                  >
                    <span className="font-medium text-indigo-600">Atendimento anônimo</span>
                  </button>
                  
                  {filteredClients.length === 0 && clientSearchTerm ? (
                    <div className="px-4 py-2 text-sm text-gray-500">
                      Nenhum cliente encontrado
                    </div>
                  ) : (
                    filteredClients.map(client => (
                      <button
                        key={client.id}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-100 flex items-center"
                        onClick={() => selectClient(client)}
                      >
                        {client.name}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Serviços */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Serviços
          </label>
          <div className="mt-1 bg-white rounded-md border border-gray-300 divide-y divide-gray-200 overflow-hidden">
            {services.length === 0 ? (
              <div className="p-4 text-sm text-gray-500 text-center">
                Carregando serviços...
              </div>
            ) : (
              services.map(service => (
                <div
                  key={service.id}
                  className={`flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer ${
                    selectedServices.some(s => s.id === service.id) ? 'bg-indigo-50' : ''
                  }`}
                  onClick={() => toggleService(service)}
                >
                  <div className="flex-1">
                    <div className="flex items-center">
                      <div className="text-sm font-medium text-gray-900">{service.name}</div>
                      <div className="ml-2 text-xs font-medium text-gray-500">
                        ({formatDuration(service.estimated_time)})
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      R$ {service.price.toFixed(2).replace('.', ',')}
                    </div>
                  </div>
                  
                  <div className="ml-4">
                    {selectedServices.some(s => s.id === service.id) ? (
                      <div className="h-5 w-5 text-indigo-600">
                        <Check className="h-5 w-5" />
                      </div>
                    ) : (
                      <div className="h-5 w-5 border border-gray-300 rounded-md" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Resumo */}
        {selectedServices.length > 0 && (
          <div className="mb-6 bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Resumo</h3>
            <div className="space-y-1">
              {selectedServices.map(service => (
                <div key={service.id} className="flex justify-between text-sm">
                  <span>{service.name}</span>
                  <span className="font-medium">
                    {formatDuration(service.estimated_time)}
                  </span>
                </div>
              ))}
              <div className="pt-2 mt-2 border-t border-gray-200 flex justify-between">
                <span className="font-medium">Tempo total:</span>
                <span className="font-medium">
                  {formatDuration(calculateTotalDuration())}
                </span>
              </div>
            </div>
          </div>
        )}
        
        {/* Botões */}
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 border border-gray-300 rounded-md shadow-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isSaveButtonEnabled() || loading}
            className={`px-4 py-2 text-sm font-medium text-white rounded-md shadow-sm ${
              isSaveButtonEnabled() && !loading
                ? 'bg-indigo-600 hover:bg-indigo-700'
                : 'bg-indigo-400 cursor-not-allowed'
            }`}
          >
            {loading ? 'Salvando...' : 'Criar Agendamento'}
          </button>
        </div>
      </div>
    </div>
  );
} 