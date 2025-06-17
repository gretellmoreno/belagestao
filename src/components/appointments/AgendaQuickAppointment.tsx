import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-hot-toast';
import { X, Calendar, Clock, User, Users, Check, Plus } from 'lucide-react';
import { useAppointments } from '../../contexts/AppointmentContext';
import { getServices, type Service, validateAllServicesExist } from '../../lib/serviceService';
import { supabase } from '../../lib/supabaseClient';

type Client = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
};

interface AgendaQuickAppointmentProps {
  selectedDate: Date;
  selectedTime: string;
  professionalId: string;
  professionalName: string;
  onClose: () => void;
  onSuccess?: (appointment: any) => void;
}

export default function AgendaQuickAppointment({
  selectedDate,
  selectedTime,
  professionalId,
  professionalName,
  onClose,
  onSuccess
}: AgendaQuickAppointmentProps) {
  // Estados
  const [loading, setLoading] = useState(false);
  const [clientName, setClientName] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [showClientOptions, setShowClientOptions] = useState(false);
  const [matchingClients, setMatchingClients] = useState<Client[]>([]);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [serviceSearchTerm, setServiceSearchTerm] = useState('');
  const [services, setServices] = useState<Service[]>([]);
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientPhone, setNewClientPhone] = useState('');
  
  // Referências
  const clientNameRef = useRef<HTMLInputElement>(null);
  const serviceSearchRef = useRef<HTMLInputElement>(null);
  
  // Contexts
  const { addAppointment } = useAppointments();
  
  // Carregar serviços
  useEffect(() => {
    const loadServices = async () => {
      try {
        console.log('[AgendaQuickAppointment] Carregando serviços...');
        const servicesData = await getServices();
        
        if (servicesData && servicesData.length > 0) {
          console.log(`[AgendaQuickAppointment] ${servicesData.length} serviços carregados:`, servicesData.map(s => ({ id: s.id, name: s.name })));
          
          // Verificar se todos os serviços têm IDs UUID válidos
          const invalidServices = servicesData.filter(service => {
            if (!service.id || typeof service.id !== 'string') return true;
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            return !uuidRegex.test(service.id);
          });
          
          if (invalidServices.length > 0) {
            console.error('[AgendaQuickAppointment] Serviços com IDs inválidos detectados:', invalidServices);
            toast.error('Alguns serviços possuem dados inválidos. Por favor, recarregue a página.');
            return;
          }
          
          // Verificar se estamos usando dados mock (IDs conhecidos dos mocks)
          const mockServiceIds = [
            '123e4567-e89b-12d3-a456-426614174000',
            '123e4567-e89b-12d3-a456-426614174001',
            '123e4567-e89b-12d3-a456-426614174002',
            '123e4567-e89b-12d3-a456-426614174003',
            '123e4567-e89b-12d3-a456-426614174004'
          ];
          
          const usingMockData = servicesData.some(service => mockServiceIds.includes(service.id));
          if (usingMockData) {
            console.warn('[AgendaQuickAppointment] ATENÇÃO: Usando dados mock. Verifique a conexão com o banco de dados.');
            toast.error('Sistema usando dados de exemplo. Verifique a conexão com o banco de dados antes de criar agendamentos.', {
              duration: 5000
            });
          }
          
          setServices(servicesData);
        } else {
          console.warn('[AgendaQuickAppointment] Nenhum serviço foi carregado');
          toast.error('Nenhum serviço disponível. Verifique a conexão com o banco de dados.');
        }
      } catch (error) {
        console.error('[AgendaQuickAppointment] Erro ao carregar serviços:', error);
        toast.error('Erro ao carregar serviços. Verifique a conexão com o banco de dados.');
      }
    };
    
    loadServices();
  }, []);

  // Focar no campo do cliente quando o modal abrir
  useEffect(() => {
    setTimeout(() => {
      if (clientNameRef.current) {
        clientNameRef.current.focus();
      }
    }, 100);
  }, []);
  
  // Formatação da data
  const formattedDate = format(selectedDate, "dd 'de' MMMM', 'yyyy", { locale: ptBR });

  // Buscar clientes quando o nome mudar
  useEffect(() => {
    const searchClients = async () => {
      if (clientName.trim().length < 2) {
        setMatchingClients([]);
        setShowClientOptions(false);
        return;
      }

      try {
        const { data: clients, error } = await supabase
          .from('clients')
          .select('id, name, phone, email')
          .ilike('name', `%${clientName.trim()}%`)
          .order('name')
          .limit(5);

        if (error) throw error;

        setMatchingClients(clients || []);
        setShowClientOptions(true);
      } catch (error) {
        console.error('Erro ao buscar clientes:', error);
        setMatchingClients([]);
        setShowClientOptions(false);
      }
    };

    const timeoutId = setTimeout(searchClients, 300);
    return () => clearTimeout(timeoutId);
  }, [clientName]);

  // Função para aplicar máscara de telefone
  const formatPhoneNumber = (value: string) => {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, '');
    
    // Aplica a máscara (11) 99999-9999
    if (numbers.length <= 2) {
      return `(${numbers}`;
    } else if (numbers.length <= 7) {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    } else {
      return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
    }
  };

  // Função para lidar com mudança no telefone
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setNewClientPhone(formatted);
  };

  // Serviços filtrados pela busca
  const filteredServices = services.filter((service: Service) => 
    service.name.toLowerCase().includes(serviceSearchTerm.toLowerCase())
  );

  // Verificar se pode mostrar os serviços
  const canShowServices = selectedClient || isAnonymous;

  // Calcular duração total
  const calculateTotalDuration = () => {
    return selectedServices.reduce((total, service) => total + (service.estimated_time || 30), 0);
  };

  // Formatar duração
  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h${mins}min` : `${hours}h`;
    }
  };

  // Verificar se o botão de salvar deve estar habilitado
  const isSaveButtonEnabled = () => {
    // Verificar se há cliente ou é anônimo
    const hasClient = selectedClient || isAnonymous;
    
    // Verificar se há serviços selecionados
    const hasServices = selectedServices.length > 0;
    
    // Verificar se todos os serviços têm IDs válidos
    const hasValidServiceIds = selectedServices.every(service => {
      if (!service.id || typeof service.id !== 'string') {
        return false;
      }
      // Verificar formato UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      return uuidRegex.test(service.id);
    });
    
    return hasClient && hasServices && hasValidServiceIds;
  };

  // Selecionar cliente existente
  const handleSelectExistingClient = (client: Client) => {
    setSelectedClient(client);
    setClientName(client.name);
    setShowClientOptions(false);
    setIsAnonymous(false);
  };

  // Criar novo cliente
  const handleCreateNewClient = async () => {
    if (!clientName.trim()) {
      toast.error('Nome do cliente é obrigatório');
      return;
    }

    if (!newClientPhone.trim()) {
      toast.error('Telefone é obrigatório');
      return;
    }

    // Validar se o telefone tem pelo menos 10 dígitos
    const phoneNumbers = newClientPhone.replace(/\D/g, '');
    if (phoneNumbers.length < 10) {
      toast.error('Telefone deve ter pelo menos 10 dígitos');
      return;
    }

    try {
      setLoading(true);
      
      const { data: newClient, error } = await supabase
        .from('clients')
        .insert([{
          name: clientName.trim(),
          phone: newClientPhone.trim(),
          created_at: new Date().toISOString()
        }])
        .select('id, name, phone, email')
        .maybeSingle();

      if (error) throw error;

      if (!newClient) {
        throw new Error('Falha ao criar cliente - nenhum dado retornado');
      }

      setSelectedClient(newClient);
      setShowClientOptions(false);
      setShowNewClientForm(false);
      setNewClientPhone('');
      toast.success('Cliente cadastrado com sucesso!');
    } catch (error) {
      console.error('Erro ao criar cliente:', error);
      toast.error('Erro ao cadastrar cliente');
    } finally {
      setLoading(false);
    }
  };

  // Configurar agendamento anônimo
  const handleSetAnonymous = () => {
    setIsAnonymous(true);
    setSelectedClient(null);
    setClientName('');
    setShowClientOptions(false);
  };

  // Adicionar serviço
  const handleAddService = (service: Service) => {
    if (selectedServices.find(s => s.id === service.id)) {
      toast.error('Este serviço já foi selecionado');
      return;
    }
    setSelectedServices([...selectedServices, service]);
    setServiceSearchTerm('');
  };

  // Remover serviço
  const handleRemoveService = (serviceId: string) => {
    setSelectedServices(selectedServices.filter(s => s.id !== serviceId));
  };

  // Limpar seleção de cliente
  const handleClearClient = () => {
    setSelectedClient(null);
    setIsAnonymous(false);
    setClientName('');
    setSelectedServices([]);
    setShowClientOptions(false);
    setShowNewClientForm(false);
    
    setTimeout(() => {
      if (clientNameRef.current) {
        clientNameRef.current.focus();
      }
    }, 100);
  };

  // Enviar formulário
  const handleSubmit = async () => {
    if (!isSaveButtonEnabled()) {
      toast.error('Por favor, selecione um cliente e pelo menos um serviço.');
      return;
    }
    
    setLoading(true);
    try {
      console.log('[AgendaQuickAppointment] Iniciando criação de novo agendamento');
      console.log('Serviços selecionados:', selectedServices);
      
      // Preparar dados completos dos serviços no formato correto
      const servicesData = selectedServices.map((service, index) => {
        console.log(`[AgendaQuickAppointment] Validando serviço ${index + 1}:`, service);
        
        // Garantir que temos um ID válido
        if (!service.id || typeof service.id !== 'string') {
          console.error(`Serviço ${index + 1} sem ID válido:`, service);
          throw new Error(`Serviço "${service.name || 'desconhecido'}" não possui um ID válido`);
        }
        
        // Verificar se é um UUID válido
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(service.id)) {
          console.error(`Serviço ${index + 1} com ID inválido (não é UUID):`, service.id);
          throw new Error(`Serviço "${service.name || 'desconhecido'}" possui um ID inválido. Por favor, recarregue a página e tente novamente.`);
        }
        
        console.log(`[AgendaQuickAppointment] Serviço ${index + 1} validado com sucesso:`, {
          id: service.id,
          name: service.name,
          price: service.price,
          estimated_time: service.estimated_time
        });
        
        return {
          service_id: service.id, // Usar o id do serviço como service_id
          custom_price: service.price,
          custom_time: service.estimated_time,
        };
      });
      
      console.log('Serviços formatados:', servicesData);
      
      // VALIDAÇÃO CRÍTICA: Verificar se todos os serviços existem no banco
      console.log('[AgendaQuickAppointment] Validando se todos os serviços existem no banco...');
      const serviceIds = servicesData.map(s => s.service_id);
      const validation = await validateAllServicesExist(serviceIds);
      
      if (!validation.valid) {
        console.error('[AgendaQuickAppointment] Serviços inválidos detectados:', validation.invalidIds);
        throw new Error(`Os seguintes serviços não existem no banco de dados: ${validation.invalidIds.join(', ')}. Por favor, recarregue a página e tente novamente.`);
      }
      
      console.log('[AgendaQuickAppointment] Todos os serviços validados com sucesso!');
      
      // Dados do agendamento formatados
      const appointmentData = {
        date: format(selectedDate, 'yyyy-MM-dd'),
        time: selectedTime,
        client_id: isAnonymous ? null : (selectedClient?.id || null),
        professional_id: professionalId,
        _selectedServices: servicesData,
        status: 'agendado' as const,
        notes: isAnonymous ? 'Atendimento anônimo' : '',
      };
      
      console.log('Dados do agendamento para criação:', appointmentData);
      
      // Criar o agendamento
      const newAppointment = await addAppointment(appointmentData);
      
      console.log('Agendamento criado com sucesso:', newAppointment);
      
      // Limpar formulário e fechar modal
      handleClearClient();
      onSuccess?.(newAppointment);
      onClose?.();
      
      // Mostrar mensagem de sucesso
      toast.success('Agendamento criado com sucesso!');
    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      
      // Mostrar erro mais específico ao usuário
      let errorMessage = 'Erro ao criar agendamento. Por favor, tente novamente.';
      
      if (error instanceof Error) {
        if (error.message.includes('UUID') || error.message.includes('ID inválido')) {
          errorMessage = 'Erro nos dados dos serviços. Por favor, recarregue a página e tente novamente.';
        } else if (error.message.includes('serviço') || error.message.includes('Serviço')) {
          errorMessage = error.message;
        } else if (error.message.includes('invalid input syntax for type uuid')) {
          errorMessage = 'Erro de formato nos dados. Por favor, recarregue a página e tente novamente.';
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div 
      className="bg-white w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl max-h-[90vh] rounded-lg shadow-xl overflow-hidden mx-2 sm:mx-4 flex flex-col"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Cabeçalho */}
      <div className="bg-indigo-600 px-6 py-4">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center text-white mb-2">
              <Calendar className="w-5 h-5 mr-2" />
              <h2 className="text-lg font-medium">Agendamento Rápido</h2>
            </div>
            
            {/* Informações do agendamento */}
            <div className="text-indigo-100 text-sm space-y-1">
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-2" />
                <span>{formattedDate}</span>
                <span className="mx-2">•</span>
                <Clock className="w-4 h-4 mr-1" />
                <span>{selectedTime}</span>
              </div>
              
              <div className="flex items-center">
                <User className="w-4 h-4 mr-2" />
                <span>{professionalName}</span>
                
                {/* Informações do cliente quando selecionado */}
                {(selectedClient || isAnonymous) && (
                  <>
                    <span className="mx-2">•</span>
                    <Users className="w-4 h-4 mr-1" />
                    <span className="font-medium">
                      {isAnonymous ? 'Anônimo' : selectedClient?.name}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="text-white hover:text-indigo-100 ml-4"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      
      <div className="p-4 flex-1 overflow-y-auto">
        {/* ETAPA 1: Cliente (só aparece se não tiver cliente selecionado) */}
        {!selectedClient && !isAnonymous && (
          <div className="mb-4">
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm font-medium text-gray-700">
                1. Cliente
              </label>
              <button
                type="button"
                onClick={handleSetAnonymous}
                className="px-3 py-1 text-xs rounded-md transition-colors bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200"
              >
                <span className="flex items-center">
                  <Users className="h-3 w-3 mr-1" />
                  Anônimo
                </span>
              </button>
            </div>
            
            <div className="space-y-3">
              <input
                ref={clientNameRef}
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Digite o nome do cliente..."
                className="w-full p-3 border border-gray-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              
              {/* Opções de clientes encontrados */}
              {showClientOptions && !showNewClientForm && (
                <div className="bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {matchingClients.length > 0 ? (
                    <>
                      {matchingClients.map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => handleSelectExistingClient(client)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center border-b border-gray-100 last:border-b-0"
                        >
                          <User className="w-4 h-4 text-gray-400 mr-2" />
                          <div>
                            <span className="text-sm font-medium">{client.name}</span>
                            {client.phone && (
                              <span className="text-xs text-gray-500 ml-2">{client.phone}</span>
                            )}
                          </div>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setShowNewClientForm(true)}
                        className="w-full text-left px-3 py-2 hover:bg-indigo-50 flex items-center text-indigo-600 border-t border-gray-200"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        <span className="text-sm font-medium">Cadastrar "{clientName}" como novo cliente</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowNewClientForm(true)}
                      className="w-full text-left px-3 py-2 hover:bg-indigo-50 flex items-center text-indigo-600"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      <span className="text-sm font-medium">Cadastrar "{clientName}" como novo cliente</span>
                    </button>
                  )}
                </div>
              )}
              
              {/* Formulário de novo cliente */}
              {showNewClientForm && (
                <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                  <h4 className="text-sm font-medium text-indigo-800 mb-3">Cadastrar Novo Cliente</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-600">Nome *</label>
                      <input
                        type="text"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        placeholder="Nome completo"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Telefone *</label>
                      <input
                        type="text"
                        value={newClientPhone}
                        onChange={handlePhoneChange}
                        className="w-full p-2 border border-gray-300 rounded text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        placeholder="(11) 99999-9999"
                        maxLength={15}
                      />
                    </div>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={handleCreateNewClient}
                        disabled={loading || !clientName.trim() || !newClientPhone.trim()}
                        className="flex-1 bg-indigo-600 text-white px-3 py-2 rounded text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? 'Cadastrando...' : 'Cadastrar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewClientForm(false);
                          setNewClientPhone('');
                        }}
                        className="px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* ETAPA 2: Serviços (só aparece após selecionar cliente) */}
        {canShowServices && (
          <div className="mb-4">
            <label className="text-sm font-medium text-gray-700 block mb-2">
              Serviços
            </label>
            
            {/* Campo de busca para filtrar serviços */}
            <div className="relative mb-2">
              <input
                ref={serviceSearchRef}
                type="text"
                value={serviceSearchTerm}
                onChange={(e) => setServiceSearchTerm(e.target.value)}
                placeholder="Buscar serviços..."
                className="w-full p-2 border border-indigo-300 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
              />
            </div>
            
            {/* Lista de serviços disponíveis */}
            <div className="mb-3">
              <h4 className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">
                Serviços Disponíveis
              </h4>
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                {filteredServices.length > 0 ? (
                  filteredServices.map((service: Service) => {
                    const isSelected = selectedServices.find(s => s.id === service.id);
                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => handleAddService(service)}
                        disabled={!!isSelected}
                        className={`w-full text-left px-4 py-3 border-b border-gray-100 last:border-b-0 transition-colors ${
                          isSelected 
                            ? 'bg-green-50 text-green-800 cursor-not-allowed' 
                            : 'hover:bg-indigo-50 hover:text-indigo-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center">
                              <span className="text-sm font-medium">{service.name}</span>
                              {isSelected && (
                                <Check className="w-4 h-4 text-green-600 ml-2" />
                              )}
                            </div>
                            {service.price && (
                              <span className="text-xs text-gray-500">
                                R$ {service.price.toFixed(2)}
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-gray-500">
                              {formatDuration(service.estimated_time)}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="px-4 py-6 text-center text-gray-500">
                    <div className="text-sm">
                      {serviceSearchTerm ? 'Nenhum serviço encontrado' : 'Nenhum serviço disponível'}
                    </div>
                    {serviceSearchTerm && (
                      <div className="text-xs mt-1">
                        Tente buscar por outro termo
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* Serviços selecionados */}
            {selectedServices.length > 0 && (
              <div className="mb-3">
                <h4 className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">
                  Serviços Selecionados ({selectedServices.length})
                </h4>
                <div className="space-y-2">
                  {selectedServices.map(service => (
                    <div key={service.id} className="flex justify-between items-center bg-indigo-50 p-3 rounded-lg border border-indigo-200">
                      <div className="flex-1">
                        <span className="text-sm font-medium text-indigo-800">{service.name}</span>
                        {service.price && (
                          <div className="text-xs text-indigo-600">
                            R$ {service.price.toFixed(2)}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center">
                        <span className="text-xs text-indigo-600 mr-3">
                          {formatDuration(service.estimated_time)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveService(service.id)}
                          className="text-indigo-400 hover:text-indigo-600 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {selectedServices.length === 0 && (
              <div className="text-sm text-gray-500 text-center py-2">
                Selecione pelo menos um serviço da lista acima
              </div>
            )}
          </div>
        )}
        
        {/* Resumo */}
        {selectedServices.length > 0 && (
          <div className="mb-4 bg-gray-50 p-3 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-1">Resumo</h3>
            <div className="pt-1 mt-1 border-t border-gray-200 flex justify-between">
              <span className="font-medium text-sm">Tempo total:</span>
              <span className="font-medium text-sm">
                {formatDuration(calculateTotalDuration())}
              </span>
            </div>
          </div>
        )}
      </div>
      
      {/* Botões fixos na parte inferior */}
      <div className="border-t border-gray-200 p-4 bg-white">
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