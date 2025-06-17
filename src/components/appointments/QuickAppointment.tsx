import React, { useState, useEffect, useRef } from 'react';
import { X, Check, Calendar, Search, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabaseClient';
import { useAppointments } from '../../contexts/AppointmentContext';
import { Client, Professional, Service } from '../../types';

interface QuickAppointmentProps {
  initialDate: string;
  initialTime: string;
  initialProfessionalId?: string;
  onClose: () => void;
  onSaved: () => void;
}

const QuickAppointment: React.FC<QuickAppointmentProps> = ({
  initialDate,
  initialTime,
  initialProfessionalId,
  onClose,
  onSaved
}) => {
  // Estados para controle do formulário
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProfessional, setSelectedProfessional] = useState<any>(null);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'service' | 'client'>('client'); // Começar com a seleção de cliente
  const [isWalkIn, setIsWalkIn] = useState(false);
  
  // Estados para dados
  const [clients, setClients] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [servicesByCategory, setServicesByCategory] = useState<Record<string, any[]>>({});
  const [serviceSearchTerm, setServiceSearchTerm] = useState('');
  
  // Contexto de agendamentos
  const { addAppointment } = useAppointments();
  
  // Referências para focagem automática
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Filtrar clientes baseado no termo de busca
  const filteredClients = clients.filter(client => 
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.phone && client.phone.includes(searchTerm))
  );
  
  // Filtrar serviços baseado no termo de busca
  const filteredServices = serviceSearchTerm
    ? services.filter(service => 
        service.name.toLowerCase().includes(serviceSearchTerm.toLowerCase())
      )
    : services;
  
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
  
  // Carregar clientes
  useEffect(() => {
    const fetchClients = async () => {
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
      }
    };
    
    fetchClients();
  }, []);
  
  // Carregar profissionais
  useEffect(() => {
    const fetchProfessionals = async () => {
      try {
        const { data, error } = await supabase
          .from('professionals')
          .select('*')
          .order('name');
        
        if (error) throw error;
        
        setProfessionals(data || []);
        
        // Pré-selecionar o profissional se fornecido
        if (initialProfessionalId && data) {
          const prof = data.find(p => p.id === initialProfessionalId);
          if (prof) {
            setSelectedProfessional(prof);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar profissionais:', error);
        toast.error('Erro ao carregar profissionais');
      }
    };
    
    fetchProfessionals();
  }, [initialProfessionalId]);
  
  // Carregar serviços
  useEffect(() => {
    const fetchServices = async () => {
      try {
        const { data, error } = await supabase
          .from('services')
          .select('*')
          .order('name');
        
        if (error) throw error;
        
        setServices(data || []);
        
        // Agrupar serviços por categoria
        const groupedServices: Record<string, any[]> = {};
        const defaultCategory = 'Todos os Serviços';
        
        // Como a coluna category não existe no banco, usar apenas uma categoria padrão
        groupedServices[defaultCategory] = data || [];
        
        setServicesByCategory(groupedServices);
      } catch (error) {
        console.error('Erro ao carregar serviços:', error);
        toast.error('Erro ao carregar serviços');
      }
    };
    
    fetchServices();
  }, []);
  
  // Efeito para focar no campo de busca quando o modal abrir
  useEffect(() => {
    if (searchInputRef.current && step === 'client') {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [step]);
  
  // Função para lidar com a seleção de cliente
  const handleSelectClient = (client: any) => {
    setSelectedClient(client);
    setIsWalkIn(false);
    setStep('service'); // Após selecionar o cliente, ir para a seleção de serviço
  };
  
  // Função para configurar como atendimento espontâneo
  const handleWalkIn = () => {
    setIsWalkIn(true);
    setSelectedClient(null);
    setStep('service'); // Após configurar como anônimo, ir para a seleção de serviço
  };
  
  // Função para selecionar serviço
  const handleSelectService = (service: any) => {
    setSelectedService(service);
    // Salvar automaticamente o agendamento após selecionar o serviço
    handleSaveAppointment(service);
  };
  
  // Função para procurar serviços
  const handleServiceSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setServiceSearchTerm(e.target.value);
  };
  
  // Função para voltar à etapa anterior
  const handleBack = () => {
    if (step === 'service') {
      setStep('client');
      setSelectedService(null);
    }
  };
  
  // Função para salvar o agendamento
  const handleSaveAppointment = async (service?: any) => {
    const serviceToUse = service || selectedService;
    
    if (!serviceToUse) {
      toast.error('Selecione um serviço');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Calcular horário de término baseado na duração do serviço
      const startTime = initialTime;
      const serviceDuration = serviceToUse.estimated_time || 30;
      const endTime = calculateEndTime(startTime, serviceDuration);
      
      // Preparar dados completos do serviço
      const serviceData = {
        service_id: serviceToUse.id,
        professional_id: selectedProfessional.id,
        custom_price: serviceToUse.price,
        custom_time: serviceToUse.estimated_time || serviceToUse.duration || 30,
        service_value: serviceToUse.price,
        // Valores calculados - podem ser ajustados conforme regra de negócio
        net_service_value: serviceToUse.price * 0.9, // Exemplo: 90% do valor
        payment_fee: 0,
        salon_profit: serviceToUse.price * 0.3, // Exemplo: 30% de lucro
        discount_payment_fee: false,
        commission_rate: serviceToUse.commission_rate || 0
      };
      
      const appointmentData = {
        date: initialDate,
        time: initialTime,
        client_id: isWalkIn ? null : (selectedClient?.id || null),
        professional_id: selectedProfessional.id,
        // Passar o serviço completo com todos os dados
        _selectedServices: [serviceData],
        status: 'pendente' as 'pendente' | 'agendado' | 'realizado' | 'ausente' | 'cancelado',
        // Remover duration - já está incluída nos dados de serviço
        notes: isWalkIn ? 'Atendimento anônimo' : ''
      };
      
      console.log('Dados preparados para criar agendamento:', appointmentData);
      console.log('IMPORTANTE: O campo _selectedServices será removido automaticamente antes do envio ao Supabase');
      
      // Criar o agendamento
      await addAppointment(appointmentData as any);
      toast.success('Agendamento criado com sucesso!');
      onSaved();
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
  
  // Renderização condicional baseada no passo atual
  const renderStep = () => {
    switch (step) {
      case 'service':
        return (
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
            <div className="space-y-6 max-h-[400px] overflow-y-auto">
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
                          className="p-4 border rounded-lg cursor-pointer hover:bg-gray-50"
                          onClick={() => handleSelectService(service)}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="text-base font-medium">{service.name}</span>
                              <span className="block text-sm text-gray-500">{formatDuration(service.duration)}</span>
                            </div>
                            <div className="flex items-center">
                              <span className="text-base font-medium text-gray-900">
                                {service.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </span>
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
        
      case 'client':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Adicionar cliente (opcional)</h2>
            
            {/* Serviço selecionado */}
            <div className="bg-indigo-50 p-3 rounded-lg">
              <h3 className="text-sm font-medium text-indigo-700">Serviço selecionado:</h3>
              <div className="mt-2 flex justify-between">
                <span className="font-medium">{selectedService?.name}</span>
                <span>{formatDuration(selectedService?.duration || 0)}</span>
              </div>
            </div>
            
            {/* Busca de cliente */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center justify-between">
                <div className="flex items-center">
                  Cliente <span className="text-xs text-gray-500 ml-1">(opcional)</span>
                </div>
                
                {/* Botão de Agendamento Espontâneo - Posicionado onde estava o retângulo vermelho na imagem */}
                <button
                  type="button"
                  onClick={handleWalkIn}
                  className={`ml-2 px-2 py-1 text-xs rounded-md ${
                    isWalkIn
                      ? 'bg-green-100 text-green-800 border border-green-300'
                      : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
                  }`}
                >
                  <span className="flex items-center">
                    <Users className="h-3 w-3 mr-1" />
                    Anônimo
                    {isWalkIn && <Check className="h-3 w-3 ml-1" />}
                  </span>
                </button>
              </label>
              
              {isWalkIn ? (
                <div className="p-2 bg-green-50 rounded-md border border-green-200 flex items-center mb-3">
                  <Users className="h-5 w-5 text-green-500 mr-2" />
                  <span className="text-green-700">Atendimento Espontâneo</span>
                  <button 
                    className="ml-auto text-green-600 hover:text-green-800"
                    onClick={() => setIsWalkIn(false)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    ref={searchInputRef}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Pesquisar cliente por nome ou telefone"
                  />
                  <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                </div>
              )}
            </div>
            
            {!isWalkIn && (
              <div className="max-h-[300px] overflow-y-auto pr-1">
                {filteredClients.length > 0 ? (
                  <ul className="space-y-1 mt-2">
                    {filteredClients.map((client) => (
                      <li key={client.id}>
                        <button
                          onClick={() => handleSelectClient(client)}
                          className={`w-full px-3 py-2 rounded-md hover:bg-gray-100 text-left flex justify-between items-center ${
                            selectedClient?.id === client.id ? 'bg-indigo-50 border border-indigo-200' : ''
                          }`}
                        >
                          <div>
                            <p className="font-medium text-gray-800">{client.name}</p>
                            {client.phone && (
                              <p className="text-sm text-gray-500">{client.phone}</p>
                            )}
                          </div>
                          {selectedClient?.id === client.id && (
                            <Check className="h-5 w-5 text-indigo-600" />
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : searchTerm ? (
                  <div className="text-center py-4 text-gray-500">
                    <p>Nenhum cliente encontrado</p>
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500">
                    <p>Digite para buscar um cliente ou selecione "Espontâneo"</p>
                  </div>
                )}
              </div>
            )}
            
            {/* Botão de confirmar */}
            <div className="pt-4 mt-4 border-t border-gray-200">
              <button
                onClick={handleSaveAppointment}
                disabled={isLoading}
                className={`w-full py-2 px-4 rounded-lg text-white ${
                  isLoading ? 'bg-indigo-300' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {isLoading ? 'Salvando...' : 'Confirmar Agendamento'}
              </button>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden w-full max-w-md">
      <div className="border-b border-gray-200 px-4 py-3 flex justify-between items-center">
        <h2 className="font-medium text-gray-800">
          {step === 'client' && 'Selecione o Cliente'}
          {step === 'service' && (isWalkIn ? 'Atendimento Anônimo' : (selectedClient ? selectedClient.name : 'Selecione o Serviço'))}
        </h2>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 flex items-center">
            <Calendar className="w-3 h-3 mr-1" />
            {initialDate} • {initialTime} {selectedProfessional && `• ${selectedProfessional.name}`}
          </span>
          <button 
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>
      
      <div className="p-4">
        {renderStep()}
      </div>
      
      {step !== 'client' && (
        <div className="border-t border-gray-200 px-4 py-3 flex justify-between">
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
};

export default QuickAppointment; 