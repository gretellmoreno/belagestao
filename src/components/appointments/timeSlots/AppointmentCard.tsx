import { Appointment } from '../../../lib/appointmentService';
import { Service } from '../../../lib/serviceService';
import { Professional } from '../../../lib/professionalService';
import { Check } from 'lucide-react';
import { useMemo } from 'react';

interface AppointmentCardProps {
  appointment: Appointment;
  services: Service[];
  professionals: Professional[];
  height: number;
  isDragging: boolean;
  onDragStart?: (e: React.DragEvent, appointment: Appointment) => void;
  onClick?: (appointment: Appointment) => void;
}

export default function AppointmentCard({
  appointment,
  services,
  professionals,
  height,
  isDragging,
  onDragStart,
  onClick
}: AppointmentCardProps) {
  // Verificar se o agendamento está em transição ou sendo atualizado
  // Usando type assertion para acessar propriedades extras
  const isUpdating = (appointment as any)._updating === true;
  const isInTransition = (appointment as any)._transition === true;
  const lastUpdated = (appointment as any)._lastUpdated || 0;
  
  // Determinar classe de transição baseada em flags de estado
  const transitionClass = isInTransition 
    ? 'transition-all duration-300 ease-in-out' 
    : '';
  
  // Aplicar efeito de fade-in quando o agendamento estiver em transição
  const fadeInClass = isInTransition && Date.now() - lastUpdated < 2000
    ? 'animate-subtle-fade-in'
    : '';
  
  // Classe para agendamentos em atualização (semi-transparente)
  const updatingClass = isUpdating
    ? 'opacity-60'
    : '';
  
  // Determinar se é agendamento finalizado
  const isFinished = appointment.status === 'finalizado' || appointment.status === 'realizado';
  
  // Identificar cor do profissional
  const professionalColor = 
    professionals.find(p => p.id === appointment.professional_id)?.color || '#4F46E5';
  
  // Obter os nomes dos serviços
  const appointmentServices = useMemo(() => {
    console.log(`[AppointmentCard] Processando serviços para agendamento ${appointment.id}:`, {
      appointment_services: appointment.appointment_services,
      services_data: appointment.services_data,
      services: appointment.services,
      _selectedServices: (appointment as any)._selectedServices
    });

    // Primeiro tentar obter dos appointment_services (novo formato)
    if (appointment.appointment_services && appointment.appointment_services.length > 0) {
      return appointment.appointment_services.map(as => as.service?.name || '').filter(Boolean);
    }
    
    // Depois tentar obter do services_data (formato intermediário)
    if (appointment.services_data && appointment.services_data.length > 0) {
      return appointment.services_data.map(sd => {
        // Primeiro tentar obter o nome diretamente do objeto service se estiver presente
        if (sd.service && sd.service.name) {
          return sd.service.name;
        }
        // Senão, buscar no array de serviços pelo ID
        const service = services.find(s => s.id === sd.service_id);
        return service?.name || '';
      }).filter(Boolean);
    }
    
    // Tentar obter do _selectedServices (formato usado durante criação)
    const anyAppointment = appointment as any;
    if (anyAppointment._selectedServices && anyAppointment._selectedServices.length > 0) {
      const serviceIds = anyAppointment._selectedServices
        .map((ss: { service_id?: string, id?: string }) => ss.service_id || ss.id)
        .filter(Boolean);
        
      if (serviceIds.length > 0) {
        return serviceIds.map((serviceId: string) => {
          const service = services.find(s => s.id === serviceId);
          return service?.name || '';
        }).filter(Boolean);
      }
    }
    
    // Por fim, tentar obter do array de services (formato antigo)
    if (appointment.services && Array.isArray(appointment.services)) {
      // Tentar interpretar services como array de IDs
      if (typeof appointment.services[0] === 'string') {
        return appointment.services.map(serviceId => {
          const service = services.find(s => s.id === serviceId);
          return service?.name || '';
        }).filter(Boolean);
      }
      
      // Tentar interpretar services como array de objetos
      if (typeof appointment.services[0] === 'object') {
        return appointment.services.map((svc: any) => 
          svc.name || 
          (svc.id && services.find(s => s.id === svc.id)?.name) || 
          ''
        ).filter(Boolean);
      }
    }
    
    return [];
  }, [appointment, services]);
  
  // Obter o nome do cliente
  const clientName = getClientName(appointment);

  // Adaptar o tamanho da fonte com base na altura do card e no tamanho da tela
  const isMobile = window.innerWidth < 768;
  const isShortCard = height < 40;
  const clientFontSize = isMobile 
    ? (isShortCard ? "text-[10px]" : "text-[11px]")
    : (isShortCard ? "text-[12px]" : "text-[13px]");
  const serviceFontSize = isMobile 
    ? (isShortCard ? "text-[9px]" : "text-[10px]")
    : (isShortCard ? "text-[10px]" : "text-[12px]");
  
  // Adicionar padding adaptativo baseado no tamanho do card e dispositivo
  const cardPadding = isMobile 
    ? (isShortCard ? "px-0.5 py-0" : "px-1 py-0.5")
    : (isShortCard ? "px-1 py-0.5" : "px-1.5 py-1");

  return (
    <div
      className={`absolute w-full overflow-hidden rounded appointment-card ${transitionClass} ${fadeInClass} ${updatingClass}`}
      style={{
        height: `${height}px`,
        backgroundColor: isDragging ? '#EBE9FB80' : `${professionalColor}25`,
        borderLeft: `${isMobile ? '3px' : '4px'} solid ${professionalColor}`,
        cursor: 'pointer',
        boxShadow: isDragging ? '0 4px 6px rgba(0, 0, 0, 0.1)' : 'none',
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 25 : 15
      }}
      draggable
      onDragStart={(e) => onDragStart && onDragStart(e, appointment)}
      onClick={() => onClick && onClick(appointment)}
    >
      <div className={`flex flex-col h-full ${cardPadding}`}>
        <div className="flex justify-between items-start">
          <div className={`${clientFontSize} font-medium text-gray-900 leading-tight text-ellipsis overflow-hidden whitespace-nowrap`}>
            {clientName}
          </div>
          {isFinished && (
            <span className={`flex-shrink-0 bg-green-100 text-green-800 rounded-sm px-0.5 ml-0.5 ${isMobile ? 'text-[8px]' : 'text-[10px]'}`}>
              <Check className={`${isShortCard || isMobile ? 'h-2 w-2' : 'h-2.5 w-2.5'} inline-block`} />
            </span>
          )}
        </div>
        
        {appointmentServices.length > 0 && (
          <div className={`${serviceFontSize} text-gray-700 leading-tight text-ellipsis overflow-hidden whitespace-nowrap ${isShortCard || isMobile ? '' : 'mt-0.5'}`}>
            {appointmentServices.join(', ')}
          </div>
        )}
      </div>
    </div>
  );
}

// Função auxiliar para obter nome do cliente
function getClientName(appointment: Appointment): string {
  if (!appointment.client) {
    return 'Cliente';
  }
  
  if (typeof appointment.client === 'string') {
    return appointment.client || 'Cliente';
  }
  
  return appointment.client.name || 'Cliente';
}
