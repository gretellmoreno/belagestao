import React from 'react';
import { Trash, CheckCircle } from 'lucide-react';
import { Appointment, AppointmentServiceData } from '../../../lib/appointmentService';
import { Professional } from '../../../lib/professionalService';
import { Service } from '../../../lib/serviceService';
import { formatAppointmentDateTime } from '../../../lib/dateUtils';
import AppointmentStatusBadge from '../shared/AppointmentStatusBadge';
import Modal from '../../shared/Modal';

interface AppointmentDetailsModalProps {
  appointment: Appointment;
  professionals: Professional[];
  services: Service[];
  onClose: () => void;
  onCancel: () => void;
  onComplete: () => void;
}

export default function AppointmentDetailsModal({
  appointment,
  professionals,
  services,
  onClose,
  onCancel,
  onComplete
}: AppointmentDetailsModalProps) {
  const renderDateTime = (date: string, time: string) => {
    try {
      return formatAppointmentDateTime(date, time);
    } catch (error) {
      console.error('Erro ao formatar data/hora do modal:', error);
      return `${date} às ${time}`;
    }
  };

  const getClientName = () => {
    if (!appointment.client) return 'Anônimo';
    return typeof appointment.client === 'string' 
      ? appointment.client || 'Anônimo'
      : appointment.client.name || 'Anônimo';
  };

  const formatDuration = (duration: number | string | undefined) => {
    if (!duration) return '30 min';
    if (typeof duration === 'string') {
      const parsedDuration = parseInt(duration);
      return `${!isNaN(parsedDuration) ? parsedDuration : 30} min`;
    }
    return `${duration} min`;
  };

  const calculateTotalDuration = () => {
    if (appointment.appointment_services && appointment.appointment_services.length > 0) {
      return appointment.appointment_services.reduce((total, service: any) => {
        const serviceDuration = service.custom_time || (service.service?.estimated_time || 30);
        return total + serviceDuration;
      }, 0);
    }
    
    if (appointment.services_relations && appointment.services_relations.length > 0) {
      return appointment.services_relations.reduce((total, service: any) => {
        const serviceDuration = service.custom_time || (service.service?.estimated_time || 30);
        return total + serviceDuration;
      }, 0);
    }
    
    return 30; // Valor padrão se não houver serviços
  };

  const renderServices = () => {
    if (appointment.services_relations && appointment.services_relations.length > 0) {
      return (
        <ul className="space-y-1">
          {appointment.services_relations.map((serviceRelation: AppointmentServiceData, index) => {
            const serviceName = services.find(s => s.id === serviceRelation.service_id)?.name || 'Serviço';
            const hasCustomPrice = (serviceRelation as any).custom_price !== undefined;
            const hasCustomDuration = (serviceRelation as any).custom_time !== undefined;
            
            return (
              <li key={index} className="text-sm py-1 break-words flex justify-between">
                <span>{serviceName}</span>
                {(hasCustomPrice || hasCustomDuration) && (
                  <span className="text-xs text-gray-500">
                    {hasCustomPrice && `R$ ${(serviceRelation as any).custom_price?.toFixed(2)}`}
                    {hasCustomPrice && hasCustomDuration && ' - '}
                    {hasCustomDuration && `${(serviceRelation as any).custom_time} min`}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      );
    } 
    
    if (Array.isArray(appointment.services) && appointment.services.length > 0) {
      return (
        <ul className="space-y-1">
          {appointment.services.map((service, index) => {
            let serviceName = service;
            
            if (typeof service === 'string') {
              const serviceObj = services.find(s => s.id === service);
              serviceName = serviceObj?.name || 'Serviço';
            }
            
            return (
              <li key={index} className="text-sm py-1 break-words">
                {serviceName}
              </li>
            );
          })}
        </ul>
      );
    }
    
    return 'Nenhum serviço especificado';
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Comanda"
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-500">Cliente</div>
            <div className="font-medium break-words">{getClientName()}</div>
          </div>
          
          <div>
            <div className="text-sm text-gray-500">Profissional</div>
            <div className="font-medium break-words">
              {professionals.find(p => String(p.id) === String(appointment.professional_id))?.name || 'Não encontrado'}
            </div>
          </div>
          
          <div>
            <div className="text-sm text-gray-500">Data e Horário</div>
            <div className="font-medium">
              {renderDateTime(appointment.date, appointment.time || '')}
            </div>
          </div>
          
          <div>
            <div className="text-sm text-gray-500">Duração</div>
            <div className="font-medium">{formatDuration(calculateTotalDuration())}</div>
          </div>
        </div>
        
        <div>
          <div className="text-sm text-gray-500">Status</div>
          <div className="font-medium">
            <AppointmentStatusBadge status={appointment.status || 'agendado'} />
          </div>
        </div>
        
        <div>
          <div className="text-sm text-gray-500">Serviços</div>
          <div className="font-medium">{renderServices()}</div>
        </div>
        
        {appointment.notes && (
          <div>
            <div className="text-sm text-gray-500">Observações</div>
            <div className="text-sm border p-2 rounded bg-gray-50">{appointment.notes}</div>
          </div>
        )}
        
        <div className="pt-3 grid grid-cols-2 gap-2">
          {appointment.status !== 'realizado' && (
            <button
              onClick={onComplete}
              className="flex items-center justify-center px-3 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
            >
              <CheckCircle className="h-4 w-4 mr-2" /> Atendido
            </button>
          )}
          
          {appointment.status !== 'cancelado' && (
            <button
              onClick={onCancel}
              className="flex items-center justify-center px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
            >
              <Trash className="h-4 w-4 mr-2" /> Excluir
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
} 