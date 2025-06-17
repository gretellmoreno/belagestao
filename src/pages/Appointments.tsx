import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import AppointmentForm from '../components/appointments/AppointmentForm';
import Calendar from '../components/appointments/Calendar';
import { AppointmentProvider, useAppointments } from '../contexts/AppointmentContext';
import { Toaster } from 'react-hot-toast';
import { format, isToday, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import TimeSlots from '../components/appointments/TimeSlots';
import { AgendaMonitor } from '../components/appointments/AgendaMonitor';
import type { Appointment as AppointmentType } from '../lib/appointmentService';
import { ChevronLeft, ChevronRight, CalendarIcon, X } from 'lucide-react';
import DatePicker, { registerLocale } from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import ProductSaleForm from '../components/products/ProductSaleForm';
import { SidebarProvider, useSidebar } from '../contexts/SidebarContext';
import { formatDate } from '../lib/dateUtils';
import { toast } from 'react-hot-toast';

// Registrar localización para pt-BR
registerLocale('pt-BR', ptBR);

// Definir um tipo local para o componente, que seja mais flexível que a interface original
interface Appointment {
  id: string;
  date: string;
  time: string;
  client?: { id: string; name: string } | string;
  professional?: string;
  professional_id?: string;
  duration: number | string;
  services?: string[];
  status?: string;
  notes?: string;
  /** @deprecated Campo custom_prices foi removido do banco de dados. Use services_data com final_price em vez disso. */
  custom_prices?: Record<string, any>;
  custom_times?: Record<string, any>;
  pending_amount?: number;
  additional_products?: string;
  skipped_services?: string;
  [key: string]: any; // Permitir propriedades adicionais
}

// Utilizamos a função formatDate do módulo dateUtils que já tem validação de segurança
const safeFormat = (date: Date | string, formatStr: string, options?: any) => {
  return formatDate(date, formatStr);
};

// Estilo global para o DatePicker
const datePickerStyle = `
  .react-datepicker-popper {
    z-index: 9999999 !important;
  }
  .react-datepicker {
    z-index: 9999999 !important;
    font-family: 'Inter', sans-serif;
    font-size: 0.7rem !important;
    border-radius: 8px !important;
    border: 1px solid #e5e7eb !important;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
    max-width: 260px !important;
  }
  
  .react-datepicker__month-container {
    float: none !important;
    width: 100% !important;
  }
  
  .react-datepicker__header {
    padding: 0.5rem !important;
    background-color: #f9fafb !important;
    border-bottom: 1px solid #e5e7eb !important;
  }
  
  .react-datepicker__current-month {
    font-size: 0.8rem !important;
    color: #111827 !important;
    font-weight: 600 !important;
    padding: 0.2rem 0 !important;
  }
  
  .react-datepicker__day-names {
    display: flex !important;
    justify-content: space-around !important;
    padding: 0.3rem 0 !important;
    margin-bottom: 0 !important;
  }
  
  .react-datepicker__day-name {
    color: #6366f1 !important;
    font-weight: 500 !important;
    margin: 0 !important;
    width: 1.5rem !important;
    font-size: 0.65rem !important;
  }
  
  .react-datepicker__month {
    margin: 0 !important;
    padding: 0.3rem !important;
  }
  
  .react-datepicker__week {
    display: flex !important;
    justify-content: space-around !important;
  }
  
  .react-datepicker__day {
    width: 1.5rem !important;
    height: 1.5rem !important;
    line-height: 1.5rem !important;
    margin: 0 !important;
    border-radius: 50% !important;
    color: #374151 !important;
    font-size: 0.7rem !important;
  }
  
  .react-datepicker__day:hover {
    background-color: #f3f4f6 !important;
  }
  
  .react-datepicker__day--selected {
    background-color: #6366f1 !important;
    color: white !important;
    font-weight: 600 !important;
  }
  
  .react-datepicker-wrapper,
  .react-datepicker__input-container {
    display: block;
    width: 100%;
  }
  
  .react-datepicker__navigation {
    top: 0.5rem !important;
  }
  
  .react-datepicker__navigation--previous {
    left: 0.5rem !important;
  }
  
  .react-datepicker__navigation--next {
    right: 0.5rem !important;
  }
  
  .react-datepicker__year-dropdown,
  .react-datepicker__month-dropdown {
    background-color: white !important;
    border-radius: 0.5rem !important;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1) !important;
    border: 1px solid #e5e7eb !important;
    padding: 0.5rem 0 !important;
    max-height: 200px !important;
    overflow-y: auto !important;
  }
  
  .react-datepicker__month-read-view,
  .react-datepicker__year-read-view {
    font-size: 0.7rem !important;
  }
  
  @media (max-width: 768px) {
    .react-datepicker-popper {
      position: fixed !important;
      top: 50% !important;
      left: 50% !important;
      transform: translate(-50%, -50%) !important;
    }
    
    .react-datepicker {
      max-width: 260px !important;
      margin: 0 auto !important;
    }
  }
`;

function AppointmentsContent() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showCalendar, setShowCalendar] = useState<boolean>(false);
  const [showForm, setShowForm] = useState<boolean>(false);
  const { loading, error, loadAppointmentsByDate } = useAppointments();
  const [editAppointment, setEditAppointment] = useState<Appointment | null>(null);
  const [showDesktopCalendar, setShowDesktopCalendar] = useState(false);
  const [showProductSaleModal, setShowProductSaleModal] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);
  const swipeRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const { expanded } = useSidebar();
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  const formattedDate = safeFormat(selectedDate, "dd 'de' MMMM", { locale: ptBR });
  const formattedYear = safeFormat(selectedDate, "yyyy");
  
  // Adicionar event listener para abrir automaticamente a agenda quando um agendamento for finalizado
  useEffect(() => {
    const handleAppointmentCreated = (event: Event) => {
      console.log('Agendamento criado/atualizado - abrindo agenda normal');
      
      // Fechar o modal de formulário
      setShowForm(false);
      
      // Se o evento contém uma data personalizada, atualizar a data selecionada
      const customEvent = event as CustomEvent;
      if (customEvent.detail && customEvent.detail.date) {
        try {
          const appointmentDate = parseISO(customEvent.detail.date);
          console.log('Atualizando para a data do agendamento:', customEvent.detail.date);
          
          // Verificar se a data selecionada é diferente da data do novo agendamento
          // Só atualiza a data se for diferente, para evitar re-renderizações desnecessárias
          if (safeFormat(selectedDate, 'yyyy-MM-dd') !== customEvent.detail.date) {
            setSelectedDate(appointmentDate);
          }
        } catch (error) {
          console.error('Erro ao converter data do agendamento:', error);
        }
      }
      
      // NÃO recarregar todos os agendamentos - isso causa o "piscar"
      // O novo agendamento já foi adicionado ao estado pelo AppointmentContext
    };
    
    // Listener para o evento appointmentUpdated (quando um agendamento é atualizado)
    const handleAppointmentUpdated = (event: Event) => {
      console.log('Agendamento atualizado - atualizando agenda');
      
      // Fechar o modal de formulário
      setShowForm(false);
      
      // Se o evento contém uma data personalizada, atualizar a data selecionada
      const customEvent = event as CustomEvent;
      if (customEvent.detail && customEvent.detail.date) {
        try {
          const appointmentDate = parseISO(customEvent.detail.date);
          console.log('Atualizando para a data do agendamento:', customEvent.detail.date);
          
          // Verificar se a data selecionada é diferente da data do novo agendamento
          // Só atualiza a data se for diferente, para evitar re-renderizações desnecessárias
          if (safeFormat(selectedDate, 'yyyy-MM-dd') !== customEvent.detail.date) {
            setSelectedDate(appointmentDate);
          }
        } catch (error) {
          console.error('Erro ao converter data do agendamento:', error);
        }
      }
    };
    
    // Registrar os event listeners
    window.addEventListener('appointmentCreated', handleAppointmentCreated as EventListener);
    window.addEventListener('appointmentUpdated', handleAppointmentUpdated as EventListener);
    
    // Limpar os event listeners quando o componente for desmontado
    return () => {
      window.removeEventListener('appointmentCreated', handleAppointmentCreated as EventListener);
      window.removeEventListener('appointmentUpdated', handleAppointmentUpdated as EventListener);
    };
  }, [selectedDate]);
  
  // Event listeners para os botões do cabeçalho mobile
  useEffect(() => {
    const handleNewAppointmentEvent = () => {
      console.log('Novo agendamento acionado pelo cabeçalho mobile');
      // Resetar qualquer agendamento que estava sendo editado
      setEditAppointment(null);
      // Abrir o modal de novo agendamento
      setShowForm(true);
    };
    
    const handleProductSaleEvent = () => {
      console.log('Venda de produto acionada pelo cabeçalho mobile');
      // Abrir o modal de venda de produtos
      setShowProductSaleModal(true);
    };
    
    // Registrar os event listeners
    window.addEventListener('openNewAppointment', handleNewAppointmentEvent);
    window.addEventListener('openProductSale', handleProductSaleEvent);
    
    // Adicionar log quando o componente é montado
    console.log('Appointments - Event listeners registrados');
    
    // Limpar os event listeners quando o componente for desmontado
    return () => {
      console.log('Appointments - Removendo event listeners');
      window.removeEventListener('openNewAppointment', handleNewAppointmentEvent);
      window.removeEventListener('openProductSale', handleProductSaleEvent);
    };
  }, []);

  // Depuración de fechas
  useEffect(() => {
    console.log('AppointmentsContent - Fecha seleccionada:', {
      date: selectedDate,
      formattedDate: safeFormat(selectedDate, 'yyyy-MM-dd'),
      todayDate: safeFormat(new Date(), 'yyyy-MM-dd')
    });
  }, [selectedDate]);

  useEffect(() => {
    const dateFormatted = safeFormat(selectedDate, 'yyyy-MM-dd');
    console.log('AppointmentsContent - Cargando citas para:', dateFormatted);
    loadAppointmentsByDate(dateFormatted);
  }, [selectedDate, loadAppointmentsByDate]);

  // Event handlers para el swipe
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const SWIPE_THRESHOLD = 100; // Umbral mínimo para considerar un swipe
    const diff = touchStartX.current - touchEndX.current;
    
    if (Math.abs(diff) > SWIPE_THRESHOLD) {
      if (diff > 0) {
        // Swipe a la izquierda (avanzar día)
        goToNextDay();
      } else {
        // Swipe a la derecha (retroceder día)
        goToPreviousDay();
      }
    }
    
    // Resetear valores
    touchStartX.current = null;
    touchEndX.current = null;
  }, []);

  // Fechar o calendário ao clicar fora dele
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowDesktopCalendar(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const isTodaySelected = isToday(selectedDate);

  const handleDateChange = (date: Date) => {
    console.log('AppointmentsContent - Fecha cambiada a:', safeFormat(date, 'yyyy-MM-dd'));
    setSelectedDate(date);
    setShowDesktopCalendar(false);
  };

  const handleEditAppointment = (appointment: Appointment) => {
    try {
      console.log('Appointments - Editando agendamento:', appointment);
      
      // Criar uma versão limpa do agendamento removendo campos problemáticos
      const safeAppointment = {
        id: appointment.id,
        client_id: appointment.client?.id || '',
        client_name: typeof appointment.client === 'object' ? appointment.client.name : '',
        professional_id: appointment.professional_id || '',
        professional_name: appointment.professional as string,
        date: appointment.date,
        time: appointment.time,
        duration: typeof appointment.duration === 'number' 
          ? appointment.duration 
          : (typeof appointment.duration === 'string' 
             ? parseInt(appointment.duration) || 30 
             : 30),
        services: Array.isArray(appointment.services) ? appointment.services : [],
        status: appointment.status || 'agendado',
        notes: appointment.notes || '',
        // Outros campos importantes
        custom_times: appointment.custom_times || {}
        // custom_prices foi removido pois não existe mais no banco de dados
      };
      
      console.log('Appointments - Agendamento preparado:', safeAppointment);
      
    // Definir o estado do agendamento a ser editado
      setEditAppointment(safeAppointment);
      
      // Abrir o formulário imediatamente
    setShowForm(true);
    } catch (error) {
      console.error('Erro ao preparar agendamento para edição:', error);
      toast.error('Erro ao preparar formulário de edição');
    }
  };

  const handleCancelEdit = () => {
    setEditAppointment(null);
  };

  const toggleDesktopCalendar = () => {
    setShowDesktopCalendar(!showDesktopCalendar);
  };

  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const handleNewAppointment = () => {
    console.log('AppointmentsContent - Nuevo agendamiento para:', safeFormat(selectedDate, 'yyyy-MM-dd'));
    setEditAppointment(null);
    setShowForm(true);
  };

  // Pré-carregar componentes para abertura mais rápida
  useEffect(() => {
    // Pré-inicializar estados para abertura mais rápida do modal 
    // para que ele abra mais rapidamente quando solicitado
    const preloadModal = async () => {
      if (!showForm) {
        // Simular uma inicialização antecipada do modal 
        // para que ele abra mais rapidamente quando solicitado
        const preloadState = { prepare: true };
        setMessage(null);
      }
    };
    preloadModal();
  }, [selectedDate]);

  return (
    <div className="h-full flex flex-col bg-gray-100">
      <div className="transition-all duration-300 w-full mx-0 px-0">
        <style>{datePickerStyle}</style>
        
        {/* Mensagem de status */}
        {message && (
          <div 
            className={`mb-4 p-3 rounded-md ${
              messageType === 'success' ? 'bg-green-50 text-green-800 border-l-4 border-green-500' : 
              'bg-red-50 text-red-800 border-l-4 border-red-500'
            }`}
          >
            {message}
          </div>
        )}

        <div className="px-1">
          {/* Mensagem de status */}
          {loading && (
            <div className="fixed top-4 right-4 z-50 bg-white rounded-lg shadow-lg p-3 text-sm text-gray-600 border-l-4 border-indigo-500 animate-pulse">
              Carregando agendamentos...
            </div>
          )}
          
          {error && (
            <div className="fixed top-4 right-4 z-50 bg-white rounded-lg shadow-lg p-3 text-sm text-red-600 border-l-4 border-red-500">
              {error}
            </div>
          )}

          {/* Versão Mobile */}
          <div className="md:hidden">
            <div className="bg-white rounded-lg shadow-sm mb-4">
              <div className="p-4">
                <div className="flex flex-col space-y-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-800">
                      {editAppointment ? 'Editando Agendamento' : 'Agenda do Dia'}
                    </h2>
                    {!isTodaySelected && (
                      <button
                        onClick={goToToday}
                        className="px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 transition-colors"
                      >
                        Hoje
                      </button>
                    )}
                  </div>
                  
                  <div 
                    ref={swipeRef}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    className="flex items-center justify-between bg-gray-50 rounded-lg p-2 relative overflow-hidden"
                  >
                    <div className="absolute inset-0 flex items-center justify-between pointer-events-none opacity-20">
                      <ChevronLeft className="w-8 h-8 text-indigo-500 ml-1" />
                      <ChevronRight className="w-8 h-8 text-indigo-500 mr-1" />
                    </div>
                    
                    <button 
                      onClick={goToPreviousDay}
                      className="p-2 rounded-full hover:bg-gray-200 text-gray-600 transition-colors w-10 h-10 flex items-center justify-center z-10"
                      aria-label="Dia anterior"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    
                    <div className="flex-1 px-2 py-1 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors rounded-md flex items-center justify-center z-10"
                    >
                      <p className="text-sm font-medium text-gray-700 capitalize">{formattedDate}</p>
                      <span className="text-xs text-gray-500 ml-1">{formattedYear}</span>
                    </div>
                    
                    <button 
                      onClick={goToNextDay}
                      className="p-2 rounded-full hover:bg-gray-200 text-gray-600 transition-colors w-10 h-10 flex items-center justify-center z-10"
                      aria-label="Próximo dia"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Visualização mobile de agendamentos */}
            <div 
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="bg-white rounded-lg shadow-sm overflow-hidden"
            >
              {/* Monitor de diagnóstico da agenda */}
              <AgendaMonitor 
                currentDate={format(selectedDate, 'yyyy-MM-dd')}
                isActive={true}
              />
              
              <TimeSlots 
                selectedDate={selectedDate} 
                onEditAppointment={handleEditAppointment as any} 
              />
            </div>

            {/* Modal de calendário para mobile */}
            {showCalendar && (
              <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-xl p-4 w-full max-w-sm">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-medium text-gray-900">Selecionar Data</h3>
                    <button 
                      onClick={() => setShowCalendar(false)}
                      className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <DatePicker
                    selected={selectedDate}
                    onChange={(date: Date) => {
                      handleDateChange(date);
                      setShowCalendar(false);
                    }}
                    inline
                    locale="pt-BR"
                    className="w-full"
                    calendarClassName="!w-full"
                    showMonthDropdown
                    showYearDropdown
                    dropdownMode="select"
                    monthsShown={1}
                  />
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      onClick={() => setShowCalendar(false)}
                      className="px-3 py-1.5 text-xs bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={goToToday}
                      className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                    >
                      Hoje
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Versão Desktop */}
          <div className="hidden md:block px-0">
            <div className="flex justify-between items-center mb-2 bg-white p-3 rounded-lg shadow-sm">
              <div className="flex items-center space-x-4">
                <h1 className="text-xl font-bold text-gray-800">
                  {editAppointment ? 'Editando Agendamento' : 'Agenda do Dia'}
                </h1>
                
                <div className="relative inline-block" ref={calendarRef}>
                  <button
                    onClick={toggleDesktopCalendar}
                    className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
                  >
                    <CalendarIcon className="h-4 w-4 text-gray-500" />
                    <span>{formattedDate}</span>
                    <span className="text-gray-500">{formattedYear}</span>
                  </button>
                  
                  {showDesktopCalendar && (
                    <div className="absolute mt-2 bg-white border border-gray-200 rounded-lg shadow-lg" style={{ zIndex: 2147483647 }}>
                      <DatePicker
                        selected={selectedDate}
                        onChange={handleDateChange}
                        locale="pt-BR"
                        inline
                      />
                    </div>
                  )}
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={goToPreviousDay}
                    className="p-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4 text-gray-500" />
                  </button>
                  
                  <button
                    onClick={goToNextDay}
                    className="p-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
                  >
                    <ChevronRight className="h-4 w-4 text-gray-500" />
                  </button>
                  
                  {!isTodaySelected && (
                    <button
                      onClick={goToToday}
                      className="px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
                    >
                      Hoje
                    </button>
                  )}
                </div>
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowProductSaleModal(true)}
                  className="px-3 py-2 bg-white border border-indigo-200 text-indigo-600 rounded-lg shadow-sm hover:bg-indigo-50 transition-colors text-sm font-medium flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  Venda
                </button>
                
                <button
                  onClick={handleNewAppointment}
                  className="px-3 py-2 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 transition-colors text-sm font-medium flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Agendar
                </button>
              </div>
            </div>

            {/* TimeSlots para visualização dos agendamentos */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              {/* Monitor de diagnóstico da agenda */}
              <AgendaMonitor 
                currentDate={format(selectedDate, 'yyyy-MM-dd')}
                isActive={true}
              />
              
              <TimeSlots 
                selectedDate={selectedDate} 
                onEditAppointment={handleEditAppointment as any} 
              />
            </div>
          </div>

          {/* Modal de Novo Agendamento/Edição - Compartilhado entre Mobile e Desktop */}
          {showForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden relative">
                <div className="p-4 overflow-y-auto">
                  <AppointmentForm 
                    selectedDate={selectedDate} 
                    editAppointment={editAppointment} 
                    onCancelEdit={handleCancelEdit}
                    onClose={() => setShowForm(false)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Modal de Venda de Produtos */}
          {showProductSaleModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden">
                <div className="p-3 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold">Venda de Produtos</h3>
                    <button 
                      onClick={() => setShowProductSaleModal(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="p-4 overflow-y-auto">
                  <ProductSaleForm onClose={() => setShowProductSaleModal(false)} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Appointments() {
  return (
    <AppointmentProvider>
      <SidebarProvider>
        <AppointmentsContent />
      </SidebarProvider>
    </AppointmentProvider>
  );
}
