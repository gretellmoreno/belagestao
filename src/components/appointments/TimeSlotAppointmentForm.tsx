import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-hot-toast';
import { createAppointment } from '../../lib/appointmentService';
import { supabase } from '../../lib/supabaseClient';
import { useAppointments } from '../../contexts/AppointmentContext';
import { X, Search, User, Check, ChevronRight, ChevronLeft, PlusCircle, Calendar } from 'lucide-react';

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

interface TimeSlotAppointmentFormProps {
  selectedDate: Date;
  selectedTime: string;
  professionalId: string;
  professionalName: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function TimeSlotAppointmentForm({ 
  selectedDate, 
  selectedTime, 
  professionalId,
  professionalName,
  onClose, 
  onSuccess 
}: TimeSlotAppointmentFormProps) {
  // Estados
  const [currentStep, setCurrentStep] = useState<number>(1); // Começar na seleção de serviços
  const [formData, setFormData] = useState({
    client_id: '' as string | undefined,
    professional_id: professionalId,
    services: [] as string[],
    date: format(selectedDate, 'yyyy-MM-dd'),
    time: selectedTime,
    notes: '',
    duration: 30
  });
  
  const { addAppointment } = useAppointments();
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [servicesByCategory, setServicesByCategory] = useState<Record<string, Service[]>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [clientSearchTerm, setClientSearchTerm] = useState<string>('');
  const [serviceSearchTerm, setServiceSearchTerm] = useState<string>('');
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [filteredServices, setFilteredServices] = useState<Service[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState<boolean>(false);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [isSpontaneous, setIsSpontaneous] = useState<boolean>(false);
  
  // Refs
  const clientInputRef = useRef<HTMLInputElement>(null);
  const clientDropdownRef = useRef<HTMLDivElement>(null);
  
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
        
        // Agrupar serviços por categoria
        const groupedServices: Record<string, Service[]> = {};
        const defaultCategory = 'Todos os Serviços';
        
        // Como a coluna category não existe no banco, usar apenas uma categoria padrão
        groupedServices[defaultCategory] = servicesData || [];
        
        setServicesByCategory(groupedServices);
        setFilteredServices(servicesData || []);
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
  
  // Filtrar serviços baseado no termo de busca
  useEffect(() => {
    if (serviceSearchTerm) {
      const filtered = services.filter(
        service => service.name.toLowerCase().includes(serviceSearchTerm.toLowerCase())
      );
      setFilteredServices(filtered);
    } else {
      setFilteredServices(services);
    }
  }, [serviceSearchTerm, services]);
  
  // Manipuladores
  const handleClientSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setClientSearchTerm(e.target.value);
    setShowClientDropdown(true);
    setIsSpontaneous(false);
  };
  
  const handleServiceSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setServiceSearchTerm(e.target.value);
  };
  
  const selectClient = (client: Client) => {
    setFormData(prev => ({ ...prev, client_id: client.id }));
    setClientSearchTerm(client.name);
    setShowClientDropdown(false);
    setIsSpontaneous(false);
  };
  
  const selectSpontaneous = () => {
    setFormData(prev => ({ ...prev, client_id: undefined }));
    setClientSearchTerm('Anônimo');
    setShowClientDropdown(false);
    setIsSpontaneous(true);
  };
  
  const handleServiceToggle = (service: Service) => {
    setFormData(prev => {
      const serviceId = service.id;
      const services = prev.services.includes(serviceId)
        ? prev.services.filter(id => id !== serviceId)
        : [...prev.services, serviceId];
      
      return { ...prev, services };
    });
    
    setSelectedServices(prev => {
      const exists = prev.some(s => s.id === service.id);
      return exists 
        ? prev.filter(s => s.id !== service.id)
        : [...prev, service];
    });
  };
  
  const handleNextStep = () => {
    setCurrentStep(prev => prev + 1);
  };
  
  const handlePrevStep = () => {
    setCurrentStep(prev => Math.max(1, prev - 1));
  };
  
  // Validação de formulário
  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 1: // Serviços
        return formData.services.length > 0;
      case 2: // Cliente (opcional) e confirmação
        return true; // Cliente é opcional agora
      default:
        return true;
    }
  };
  
  // Formatar duração
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
  
  // Calcular duração total
  const calculateTotalDuration = (): number => {
    return selectedServices.reduce((total, service) => total + service.estimated_time, 0);
  };
  
  // Enviar formulário
  const handleSubmit = async () => {
    setLoading(true);
    
    try {
      console.log('[TimeSlotAppointmentForm] Iniciando criação de novo agendamento');
      
      // Verificar se todos os campos obrigatórios estão preenchidos
      if (!formData.professional_id || !formData.services.length || !formData.date || !formData.time) {
        toast.error('Por favor, selecione pelo menos um serviço.');
        return;
      }
      
      // Calcular valor total dos serviços
      const totalValue = selectedServices.reduce((sum, service) => sum + service.price, 0);
      
      // Preparar dados dos serviços
      const servicesData = selectedServices.map(service => ({
        service_id: service.id,
        service_value: service.price,
        net_service_value: service.price * 0.9, // 90% do valor como exemplo
        payment_fee: 0,
        salon_profit: service.price * 0.3, // 30% como exemplo
        discount_payment_fee: false,
        commission_rate: 0 // Valor padrão
      }));
      
      // Encontrar o cliente selecionado
      const selectedClient = clients.find(c => c.id === formData.client_id);
      
      // Preparar payload final
      const appointmentData = {
        client_id: selectedClient?.id || null,
        professional_id: professionalId,
        date: format(selectedDate, 'yyyy-MM-dd'),
        time: selectedTime,
        notes: formData.notes,
        status: 'agendado' as const,
        _selectedServices: servicesData
      };
      
      // Log para depuração
      console.log('Dados preparados para criar agendamento:', appointmentData);
      console.log('IMPORTANTE: O campo _selectedServices será removido automaticamente antes do envio ao Supabase');
      
      try {
        // Criar o agendamento (usamos as any para permitir propriedades temporárias)
        await addAppointment(appointmentData as any);
        
        // Disparar evento para atualizar a agenda
        window.dispatchEvent(new CustomEvent('appointmentCreated', {
          detail: {
            date: appointmentData.date,
            professionalId: appointmentData.professional_id
          }
        }));
        
        // Fechar modal e mostrar mensagem de sucesso
        onClose();
        toast.success('Agendamento criado com sucesso!');
      } catch (error) {
        console.error('Erro ao criar agendamento:', error);
        toast.error('Erro ao criar agendamento. Verifique os dados e tente novamente.');
      }
      
    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      toast.error('Erro ao criar agendamento. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };
  
  // Renderizar etapas do formulário
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return renderServicesStep();
      case 2:
        return renderClientAndConfirmationStep();
      default:
        return null;
    }
  };
  
  // Etapa 1: Seleção de Serviços (Primeira etapa agora)
  const renderServicesStep = () => (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900">Selecionar um serviço</h2>
      
      {/* Campo de busca de serviço */}
      <div className="relative mb-6">
        <div className="relative">
          <input
            type="text"
            value={serviceSearchTerm}
            onChange={handleServiceSearch}
            placeholder="Buscar serviço por nome"
            className="w-full px-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
        </div>
      </div>
      
      {/* Lista de serviços agrupados por categoria */}
      <div className="space-y-6">
        {Object.entries(servicesByCategory).map(([category, categoryServices]) => {
          // Filtrar serviços da categoria atual com base na busca
          const visibleServices = serviceSearchTerm
            ? categoryServices.filter(s => 
                s.name.toLowerCase().includes(serviceSearchTerm.toLowerCase())
              )
            : categoryServices;
            
          if (visibleServices.length === 0) return null;
            
          return (
            <div key={category} className="space-y-2">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                {category} <span className="ml-2 text-sm bg-gray-100 text-gray-500 px-2 rounded-full">{visibleServices.length}</span>
              </h3>
              
              <div className="space-y-2">
                {visibleServices.map(service => (
                  <div
                    key={service.id}
                    className={`p-4 border rounded-lg cursor-pointer ${
                      formData.services.includes(service.id) 
                        ? 'border-indigo-500 bg-indigo-50' 
                        : 'border-gray-100 hover:bg-gray-50'
                    }`}
                    onClick={() => handleServiceToggle(service)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-base font-medium">{service.name}</span>
                        <span className="block text-sm text-gray-500">{formatDuration(service.estimated_time)}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-base font-medium text-gray-900 mr-3">
                          {service.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                        {formData.services.includes(service.id) && (
                          <div className="h-6 w-6 bg-indigo-500 rounded-full flex items-center justify-center">
                            <Check className="h-4 w-4 text-white" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Resumo de serviços selecionados */}
      {selectedServices.length > 0 && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Serviços selecionados</h3>
          <ul className="space-y-1">
            {selectedServices.map(service => (
              <li key={service.id} className="flex justify-between text-sm">
                <span>{service.name}</span>
                <div className="flex space-x-4">
                  <span className="text-gray-600">{formatDuration(service.estimated_time)}</span>
                  <span className="font-medium">
                    {service.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </li>
            ))}
            <li className="flex justify-between text-sm font-medium border-t border-gray-200 pt-2 mt-2">
              <span>Total</span>
              <div className="flex space-x-4">
                <span>{formatDuration(calculateTotalDuration())}</span>
                <span>
                  {selectedServices
                    .reduce((total, service) => total + service.price, 0)
                    .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
  
  // Etapa 2: Seleção de Cliente (opcional) e Confirmação
  const renderClientAndConfirmationStep = () => {
    // Encontrar o cliente selecionado
    const selectedClient = clients.find(c => c.id === formData.client_id);
    
    // Formatação da data
    const formattedDate = formData.date 
      ? format(new Date(formData.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
      : '';
    
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-gray-800">Adicionar cliente (opcional)</h2>
        
        {/* Cliente - Opcional */}
        <div className="relative">
          <div className="flex items-center mb-3">
            <User className="h-5 w-5 text-gray-400 mr-2" />
            <label className="text-sm font-medium text-gray-700">Cliente</label>
            <span className="text-xs text-gray-500 ml-1">(opcional)</span>
          </div>
          
          {isSpontaneous ? (
            <div className="mb-2 p-2 bg-green-50 rounded-md border border-green-200 flex items-center">
              <PlusCircle className="h-5 w-5 text-green-500 mr-2" />
              <span className="text-green-700">Agendamento Anônimo</span>
              <button 
                className="ml-auto text-green-600 hover:text-green-800"
                onClick={() => {
                  setIsSpontaneous(false);
                  setClientSearchTerm('');
                  setFormData(prev => ({ ...prev, client_id: '' }));
                }}
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
                placeholder="Buscar cliente ou deixe vazio"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <Search className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
          )}
          
          {showClientDropdown && !isSpontaneous && (
            <div 
              ref={clientDropdownRef}
              className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-lg max-h-60 overflow-auto"
            >
              {/* Opção de agendamento anônimo sempre no topo */}
              <div
                className="px-4 py-2 bg-green-50 hover:bg-green-100 cursor-pointer flex items-center border-b border-gray-200"
                onClick={selectSpontaneous}
              >
                <PlusCircle className="h-5 w-5 text-green-500 mr-2" />
                <span className="font-medium">Agendamento Anônimo</span>
              </div>
              
              {filteredClients.map(client => (
                <div
                  key={client.id}
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center"
                  onClick={() => selectClient(client)}
                >
                  <User className="h-5 w-5 text-gray-400 mr-2" />
                  <span>{client.name}</span>
                  {formData.client_id === client.id && (
                    <Check className="h-5 w-5 text-green-500 ml-auto" />
                  )}
                </div>
              ))}
            </div>
          )}
          
          {!isSpontaneous && !showClientDropdown && (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={selectSpontaneous}
                className="px-3 py-2 text-sm rounded-lg flex items-center bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200"
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Agendamento Anônimo
              </button>
              <div className="text-xs text-gray-500 flex items-center">
                <span>Ou selecione um cliente cadastrado</span>
              </div>
            </div>
          )}
        </div>
        
        <div className="border-t border-gray-200 my-6"></div>
        
        <h2 className="text-lg font-semibold text-gray-800">Confirme o Agendamento</h2>
        
        <div className="bg-gray-50 p-4 rounded-lg space-y-3">
          {/* Cliente (se selecionado) */}
          <div>
            <h3 className="text-sm font-medium text-gray-500">Cliente</h3>
            <p className="text-gray-800 flex items-center">
              {isSpontaneous ? (
                <>
                  <PlusCircle className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-green-700">Anônimo</span>
                </>
              ) : (
                selectedClient?.name || 'Sem cliente selecionado'
              )}
            </p>
          </div>
          
          {/* Data e Hora */}
          <div>
            <h3 className="text-sm font-medium text-gray-500">Data e Hora</h3>
            <p className="text-gray-800">{formattedDate}, {formData.time}</p>
          </div>
          
          {/* Serviços */}
          <div>
            <h3 className="text-sm font-medium text-gray-500">Serviços</h3>
            <ul className="space-y-1">
              {selectedServices.map(service => (
                <li key={service.id} className="flex justify-between">
                  <span>{service.name}</span>
                  <div className="flex space-x-4">
                    <span className="text-gray-500">{formatDuration(service.estimated_time)}</span>
                    <span className="font-medium">
                      {service.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                </li>
              ))}
              <li className="flex justify-between pt-2 border-t border-gray-200 font-medium">
                <span>Total</span>
                <div className="flex space-x-4">
                  <span>{formatDuration(calculateTotalDuration())}</span>
                  <span>
                    {selectedServices
                      .reduce((total, service) => total + service.price, 0)
                      .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </li>
            </ul>
          </div>
          
          {/* Observações */}
          <div>
            <h3 className="text-sm font-medium text-gray-500">Observações (opcional)</h3>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Adicione informações importantes..."
              className="w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 h-20 resize-none"
            />
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
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
      
      {/* Botões de navegação entre passos */}
      <div className="flex items-center justify-between">
        {currentStep > 1 && (
          <button 
            className="px-3 py-1 text-sm flex items-center text-gray-600 hover:bg-gray-100 rounded" 
            onClick={handlePrevStep}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Voltar
          </button>
        )}
        
        <div className="text-sm text-gray-500">
          Passo {currentStep} de 2
        </div>
        
        {currentStep < 2 && isStepValid(currentStep) && (
          <button 
            className="px-3 py-1 text-sm flex items-center text-indigo-600 hover:bg-indigo-50 rounded" 
            onClick={handleNextStep}
          >
            Avançar
            <ChevronRight className="w-4 h-4 ml-1" />
          </button>
        )}
      </div>
      
      {/* Conteúdo da Etapa */}
      <div className="min-h-[400px]">
        {renderStep()}
      </div>
      
      {/* Botão de confirmação na última etapa */}
      {currentStep === 2 && (
        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className={`w-full py-2 px-4 rounded-md text-white ${
              loading ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {loading ? 'Salvando...' : 'Confirmar Agendamento'}
          </button>
        </div>
      )}
    </div>
  );
} 