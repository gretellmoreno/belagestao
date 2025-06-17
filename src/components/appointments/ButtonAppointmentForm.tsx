import React, { useState, useEffect, useRef, useMemo } from 'react';
import { format, parseISO, addMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'react-toastify';
import { getClients, type Client } from '../../lib/clientService';
import { getProfessionals, type Professional } from '../../lib/professionalService';
import { getServices } from '../../lib/serviceService';
import { X, Calendar, Clock, Search, PlusCircle, User, Check, ChevronRight, ChevronLeft, CreditCard } from 'lucide-react';
import { useAgendaData } from '../../hooks/useAgendaData';
import { useAppointments } from '../../contexts/AppointmentContext';
import { supabase } from '../../lib/supabaseClient';

// Interfaces locais para uso neste componente
interface LocalService {
  id: string;
  name: string;
  estimated_time: number;
  price: number;
}

interface ButtonAppointmentFormProps {
  selectedDate: Date;
  onClose: () => void;
  onSuccess?: () => void;
}

interface FormData {
  client_id?: string;
  professional_id: string;
  services: string[];
  date: string;
  time: string;
  notes: string;
  custom_times?: Record<string, number>;
}

// Estado inicial do formulário
const initialFormState: FormData = {
  client_id: '',
  professional_id: '',
  services: [],
  date: format(new Date(), 'yyyy-MM-dd'),
  time: '',
  notes: ''
};

export default function ButtonAppointmentForm({ selectedDate, onClose, onSuccess }: ButtonAppointmentFormProps) {
  // Substituir múltiplos hooks por um único
  const { 
    professionals,
    services,
    loading: baseDataLoading,
    error: baseDataError
  } = useAgendaData();

  // Converter services para LocalService
  const localServices = useMemo(() => 
    services.map(s => ({
      id: s.id,
      name: s.name,
      estimated_time: s.estimated_time || 30,
      price: s.price || 0
    })), [services]
  );

  // Remover hooks não utilizados e manter apenas os necessários
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<FormData>({
    professional_id: '',
    services: [],
    date: format(selectedDate, 'yyyy-MM-dd'),
    time: '',
    notes: ''
  });
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [clientSearchTerm, setClientSearchTerm] = useState<string>('');
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState<boolean>(false);
  const [selectedServices, setSelectedServices] = useState<LocalService[]>([]);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);
  const [isSpontaneous, setIsSpontaneous] = useState<boolean>(false);
  
  // Refs
  const clientInputRef = useRef<HTMLInputElement>(null);
  const clientDropdownRef = useRef<HTMLDivElement>(null);
  
  // Obter addAppointment do contexto
  const { addAppointment } = useAppointments();
  
  // Atualizar a função loadInitialData para usar os dados do hook
  useEffect(() => {
    if (!baseDataLoading && professionals.length > 0 && services.length > 0) {
      // Dados já estão carregados pelo hook useAgendaData
      console.log('Dados base carregados:', {
        professionals: professionals.length,
        services: services.length
      });
    }
  }, [baseDataLoading, professionals, services]);
  
  // Adicionar um listener para o evento de atualização de profissionais
  useEffect(() => {
    const handleProfessionalUpdated = () => {
      console.log('Profissional atualizado, dados já serão atualizados pelo useAgendaData');
    };

    window.addEventListener('professional_updated', handleProfessionalUpdated);
    return () => window.removeEventListener('professional_updated', handleProfessionalUpdated);
  }, []);
  
  // Filtrar clientes baseado no termo de busca
  useEffect(() => {
    if (clientSearchTerm) {
      const filtered = clients.filter(
        client => client.name.toLowerCase().includes(clientSearchTerm.toLowerCase())
      );
      setFilteredClients(filtered);
      setShowClientDropdown(true);
    } else {
      setFilteredClients([]);
      setShowClientDropdown(false);
    }
  }, [clientSearchTerm, clients]);
  
  // Manipuladores
  const handleClientSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setClientSearchTerm(e.target.value);
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
  
  const handleProfessionalSelect = (professional: Professional) => {
    if (professional && professional.id) {
      setFormData(prev => ({ ...prev, professional_id: professional.id as string }));
    }
  };
  
  const handleServiceToggle = (service: LocalService) => {
    // Atualizar formData.services array
    setFormData(prev => {
      const newServices = prev.services.includes(service.id)
        ? prev.services.filter(id => id !== service.id)
        : [...prev.services, service.id];
      
      // Retornar o novo estado atualizado
      return {
        ...prev,
        services: newServices
      };
    });
    
    // Atualizar também o estado selectedServices para manter sincronizado
    setSelectedServices(prev => {
      // Se o serviço já está selecionado, remova-o
      if (prev.find(s => s.id === service.id)) {
        return prev.filter(s => s.id !== service.id);
      } 
      // Se não está selecionado ainda, adicione-o 
      else {
        return [...prev, service];
      }
    });
  };
  
  const handleTimeSelect = (time: string) => {
    setFormData(prev => ({ ...prev, time }));
  };
  
  const handleDateChange = (date: string) => {
    setFormData(prev => ({ ...prev, date }));
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
      case 1: // Cliente e Profissional
        return Boolean(formData.professional_id);
      case 2: // Serviços
        return formData.services.length > 0;
      case 3: // Data e Hora
        return Boolean(formData.date && formData.time);
      default:
        return true;
    }
  };
  
  // Calcular duração total
  const calculateTotalTime = (): number => {
    return selectedServices.reduce((total, service) => total + service.estimated_time, 0);
  };
  
  // Função para calcular o horário de término
  const calculateEndTime = (startTime: string, totalMinutes: number): string => {
    const [hours, mins] = startTime.split(':').map(Number);
    const startDate = new Date();
    startDate.setHours(hours, mins, 0, 0);
    
    const endDate = new Date(startDate.getTime() + totalMinutes * 60000);
    const endHours = endDate.getHours().toString().padStart(2, '0');
    const endMinutes = endDate.getMinutes().toString().padStart(2, '0');
    
    return `${endHours}:${endMinutes}`;
  };
  
  // Enviar formulário
  const handleSubmit = async () => {
    if (!formData.professional_id || !formData.services || !formData.date || !formData.time) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      console.log('Criando agendamento com dados:', formData);
      setLoading(true);

      const formattedServices = formData.services.map(service => {
        const serviceDetails = localServices.find(s => s.id === service);
        return {
          service_id: service,
          professional_id: formData.professional_id,
          custom_price: undefined,
          custom_time: serviceDetails?.estimated_time || 30,
          created_at: new Date().toISOString()
        };
      });

      const appointmentData = {
        client_id: formData.client_id,
        professional_id: formData.professional_id,
        date: formData.date,
        time: formData.time,
        notes: formData.notes,
        status: "agendado",
        _selectedServices: formattedServices,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('Appointment data preparado:', appointmentData);
      
      // Usar o AppointmentContext para adicionar o agendamento
      const result = await addAppointment(appointmentData);
      
      if (result && result.id) {
        // Buscar o agendamento completo com os serviços após a criação
        const { data: completeAppointment, error: fetchError } = await supabase
          .from("appointments")
          .select(`
            *,
            client:clients(*),
            appointment_services(
              id, 
              service_id, 
              custom_price, 
              custom_time,
              service:services(id, name, price, estimated_time)
            )
          `)
          .eq("id", result.id)
          .single();
          
        if (fetchError) {
          console.error('Erro ao buscar dados completos do agendamento:', fetchError);
        } else if (completeAppointment) {
          console.log('Dados completos do agendamento:', completeAppointment);
          
          // Disparar evento para atualizar a UI com dados completos
          window.dispatchEvent(new CustomEvent('appointmentUpdated', { 
            detail: { 
              id: result.id,
              date: formData.date,
              status: 'agendado',
              forceRefresh: true,
              appointmentData: completeAppointment
            } 
          }));
          
          // Também disparar o evento appointmentCreated para compatibilidade
          window.dispatchEvent(new CustomEvent('appointmentCreated', {
            detail: {
              date: formData.date,
              appointment: completeAppointment,
              professionalId: formData.professional_id,
              forceRefresh: true
            }
          }));
        }
      }
      
      console.log('ButtonAppointmentForm - Agendamento criado:', result);
      toast.success('Agendamento criado com sucesso!');
      
      // Fechar formulário e chamar callback de sucesso
      onClose();
      if (onSuccess) onSuccess();
      
    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      toast.error('Erro ao criar agendamento. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };
  
  // Função para finalizar um atendimento
  const handleFinalizeAppointment = async (appointmentId: string, appointmentDate: string, paymentMethodId?: string, discountPaymentFee: boolean = false) => {
    try {
      setLoading(true);
      
      // Validação obrigatória do payment_method_id
      if (!paymentMethodId) {
        console.error("Payment method ID é obrigatório para finalizar agendamento");
        toast.error("Método de pagamento é obrigatório para finalizar o atendimento.");
        return false;
      }
      
      console.log(`[FINALIZAÇÃO] Iniciando finalização do agendamento ${appointmentId}`);
      console.log(`[FINALIZAÇÃO] Método de pagamento: ${paymentMethodId}`);
      console.log(`[FINALIZAÇÃO] Descontar taxa: ${discountPaymentFee}`);
      
      // Chamar a RPC finalize_appointment usando o novo formato com payload
      const { data, error } = await supabase.rpc('finalize_appointment', {
        payload: {
          p_appointment_id: appointmentId,
          p_payment_method_id: paymentMethodId,
          p_discount_payment_fee: discountPaymentFee
        }
      });
      
      if (error) {
        console.error('Erro ao finalizar atendimento:', error);
        // A função RPC agora pode lançar erro se o p_appointment_id não for válido
        const errorMessage = error.message || "Erro desconhecido";
        console.error('Detalhes do erro:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        toast.error(`Não foi possível finalizar o atendimento: ${errorMessage}`);
        return false;
      }
      
      console.log('Atendimento finalizado com sucesso:', data);
      
      // Verificar se o resultado indica sucesso
      if (data && data.success === false) {
        console.error("RPC retornou sucesso = false:", data.message);
        toast.error(`Erro ao finalizar: ${data.message || "Erro desconhecido"}`);
        return false;
      }
      
      // Disparar evento com informações completas para atualizar o relatório financeiro
      window.dispatchEvent(new CustomEvent('appointmentUpdated', {
        detail: {
          id: appointmentId,
          status: 'finalizado',
          date: appointmentDate,
          forceRefresh: true
        }
      }));
      
      toast.success('Atendimento finalizado com sucesso!');
      return true;
    } catch (error) {
      console.error('Erro inesperado ao finalizar atendimento:', error);
      // Extrair mensagem de erro mais específica
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(`Erro ao finalizar atendimento: ${errorMessage}`);
      return false;
    } finally {
      setLoading(false);
    }
  };
  
  // Renderizar etapas do formulário
  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return renderClientProfessionalStep();
      case 2:
        return renderServicesStep();
      case 3:
        return renderDateTimeStep();
      case 4:
        return renderConfirmationStep();
      default:
        return null;
    }
  };
  
  // Etapa 1: Seleção de Cliente e Profissional
  const renderClientProfessionalStep = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">Selecione o Cliente e Profissional</h2>
      
      {/* Cliente */}
      <div className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Cliente {!isSpontaneous && <span className="text-gray-400 text-xs">(opcional)</span>}
        </label>
        
        {isSpontaneous && (
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
        )}
        
        {!isSpontaneous && (
          <div className="relative">
            <input
              ref={clientInputRef}
              type="text"
              value={clientSearchTerm}
              onChange={handleClientSearch}
              placeholder="Buscar cliente..."
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
            
            {filteredClients.length > 0 ? (
              filteredClients.map(client => (
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
              ))
            ) : clientSearchTerm && filteredClients.length === 0 ? (
              <div className="px-4 py-2 text-gray-500 text-center">
                Nenhum cliente encontrado
              </div>
            ) : null}
          </div>
        )}

        {!isSpontaneous && !showClientDropdown && (
          <div className="mt-2">
            <button
              type="button"
              onClick={selectSpontaneous}
              className="px-3 py-2 text-sm rounded-lg flex items-center bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200"
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              Agendamento Anônimo
            </button>
          </div>
        )}
      </div>
      
      {/* Profissional */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Profissional</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {professionals.map(professional => (
            <div
              key={professional.id}
              className={`p-3 border rounded-lg cursor-pointer ${
                formData.professional_id === professional.id 
                  ? 'border-indigo-500 bg-indigo-50' 
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
              onClick={() => handleProfessionalSelect(professional)}
            >
              <div className="flex items-center">
                <div 
                  className="w-3 h-3 rounded-full mr-2" 
                  style={{ backgroundColor: professional.color || '#818CF8' }} 
                />
                <span className="text-sm font-medium">{professional.name}</span>
                {formData.professional_id === professional.id && (
                  <Check className="h-4 w-4 text-indigo-500 ml-auto" />
                )}
              </div>
              {professional.role && (
                <span className="text-xs text-gray-500 mt-1 block">{professional.role}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
  
  // Etapa 2: Seleção de Serviços
  const renderServicesStep = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">Selecione os Serviços</h2>
      
      <div className="space-y-2">
        {localServices.map(service => (
          <div
            key={service.id}
            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
              formData.services.includes(service.id)
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => handleServiceToggle(service)}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{service.name}</span>
              <div className="flex items-center space-x-2 text-xs text-gray-500">
                <span>{service.estimated_time}min</span>
                <span>•</span>
                <span>R$ {service.price.toFixed(2)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {selectedServices.length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700">Resumo</h3>
          <ul className="mt-2 space-y-1">
            {selectedServices.map(service => (
              <li key={service.id} className="flex justify-between text-sm">
                <span>{service.name}</span>
                <span>{service.estimated_time}min</span>
              </li>
            ))}
            <li className="flex justify-between text-sm font-medium border-t border-gray-200 pt-1 mt-1">
              <span>Total</span>
              <span>{calculateTotalTime()}min</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
  
  // Etapa 3: Seleção de Data e Hora
  const renderDateTimeStep = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">Selecione a Data e Horário</h2>
      
      {/* Data */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
        <div className="relative">
          <input
            type="date"
            value={formData.date}
            onChange={(e) => handleDateChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <Calendar className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />
        </div>
      </div>
      
      {/* Hora */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Horário</label>
        <div className="grid grid-cols-4 gap-2">
          {/* Horários fictícios - em uma implementação real, você carregaria horários disponíveis */}
          {['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'].map(time => (
            <div
              key={time}
              className={`py-2 px-3 rounded-lg border text-center cursor-pointer ${
                formData.time === time 
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
              onClick={() => handleTimeSelect(time)}
            >
              <span className="text-sm">{time}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Notas */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Observações (opcional)</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          placeholder="Adicione informações importantes..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 h-24 resize-none"
        />
      </div>
    </div>
  );
  
  // Etapa 4: Confirmação
  const renderConfirmationStep = () => {
    // Encontrar o cliente selecionado
    const selectedClient = clients.find(c => c.id === formData.client_id);
    
    // Encontrar o profissional selecionado
    const selectedProfessional = professionals.find(p => p.id === formData.professional_id);
    
    // Formatação da data
    const formattedDate = formData.date 
      ? format(new Date(formData.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
      : '';
    
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Confirme o Agendamento</h2>
        
        <div className="bg-gray-50 p-4 rounded-lg space-y-3">
          {/* Cliente */}
          <div>
            <h3 className="text-sm font-medium text-gray-500">Cliente</h3>
            <p className="text-gray-800 flex items-center">
              {isSpontaneous ? (
                <>
                  <PlusCircle className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-green-700">Anônimo</span>
                </>
              ) : (
                selectedClient?.name || 'Cliente não selecionado'
              )}
            </p>
          </div>
          
          {/* Profissional */}
          <div>
            <h3 className="text-sm font-medium text-gray-500">Profissional</h3>
            <p className="text-gray-800">{selectedProfessional?.name || 'Profissional não selecionado'}</p>
          </div>
          
          {/* Data e Hora */}
          <div>
            <h3 className="text-sm font-medium text-gray-500">Data e Hora</h3>
            <p className="text-gray-800">{formattedDate}, {formData.time}</p>
          </div>
          
          {/* Serviços */}
          <div>
            <h3 className="text-sm font-medium text-gray-500">Serviços</h3>
            <ul className="mt-1">
              {selectedServices.map(service => (
                <li key={service.id} className="text-gray-800 flex justify-between">
                  <span>{service.name}</span>
                  <span className="text-gray-600">{service.estimated_time}min</span>
                </li>
              ))}
            </ul>
            
            <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between">
              <span className="font-medium">Tempo Total</span>
              <span className="font-medium">{calculateTotalTime()}min</span>
            </div>
          </div>
          
          {/* Observações */}
          {formData.notes && (
            <div>
              <h3 className="text-sm font-medium text-gray-500">Observações</h3>
              <p className="text-gray-800 text-sm">{formData.notes}</p>
            </div>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900">Novo Agendamento</h2>
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
        >
          <X className="h-6 w-6" />
        </button>
      </div>
      
      {/* Indicador de Etapa */}
      <div className="flex justify-between items-center">
        {[1, 2, 3, 4].map(step => (
          <div 
            key={step}
            className={`flex items-center ${step < 4 ? 'flex-1' : ''}`}
          >
            <div 
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                currentStep >= step ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}
            >
              {step}
            </div>
            
            {step < 4 && (
              <div className={`h-1 flex-1 ${
                currentStep > step ? 'bg-indigo-600' : 'bg-gray-200'
              }`} />
            )}
          </div>
        ))}
      </div>
      
      {/* Conteúdo da Etapa */}
      <div className="min-h-[300px]">
        {renderStep()}
      </div>
      
      {/* Botões de Navegação */}
      <div className="flex justify-between pt-4 border-t border-gray-200">
        {currentStep > 1 ? (
          <button
            onClick={handlePrevStep}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Anterior
          </button>
        ) : (
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
        )}
        
        {currentStep < 4 ? (
          <button
            onClick={handleSubmit}
            disabled={!isStepValid(currentStep) || loading}
            className={`px-4 py-2 rounded-lg text-white flex items-center ${
              isStepValid(currentStep) && !loading
                ? 'bg-indigo-600 hover:bg-indigo-700'
                : 'bg-indigo-300 cursor-not-allowed'
            }`}
          >
            Próximo
            <ChevronRight className="h-4 w-4 ml-1" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-white ${
              loading
                ? 'bg-indigo-300 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {loading ? 'Salvando...' : 'Confirmar Agendamento'}
          </button>
        )}
      </div>
    </div>
  );
} 