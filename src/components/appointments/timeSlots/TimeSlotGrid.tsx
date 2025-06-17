import React from 'react';
import { Professional } from '../../../lib/professionalService';
import { Service } from '../../../lib/serviceService';
import { Appointment } from '../../../lib/appointmentService';
import { normalizeTime, formatDateToLocal } from '../../../lib/dateUtils';
import AppointmentCard from './AppointmentCard';

interface TimeSlotGridProps {
  selectedDate: Date;
  groupedTimeSlots: Record<string, string[]>;
  paginatedProfessionals: Professional[];
  professionals: Professional[];
  appointments: Appointment[];
  services: Service[];
  slotHeight: number;
  hourHeight: number;
  dragState: any | null;
  onSlotClick: (e: React.MouseEvent, time: string, professionalId: string) => void;
  onDragOver: (e: React.DragEvent, time: string, professionalId: string) => void;
  onDrop: (e: React.DragEvent, time: string, professionalId: string) => void;
  onDragStart: (e: React.DragEvent, appointment: Appointment) => void;
  onAppointmentClick: (appointment: Appointment) => void;
}

export default function TimeSlotGrid({
  selectedDate,
  groupedTimeSlots,
  paginatedProfessionals,
  professionals,
  appointments,
  services,
  slotHeight,
  hourHeight,
  dragState,
  onSlotClick,
  onDragOver,
  onDrop,
  onDragStart,
  onAppointmentClick
}: TimeSlotGridProps) {
  const getAppointmentsForSlot = (professionalId: string | undefined, slotTime: string) => {
    if (!professionalId) return [];

    const currentDateStr = formatDateToLocal(selectedDate);

    return appointments
      .filter(app => {
        if (!app || !app.date || !app.time) return false;
        const appDate = app.date.split('T')[0];
        return (
          app.professional_id === professionalId &&
          appDate === currentDateStr &&
          app.status !== 'cancelado' &&
          normalizeTime(app.time) === slotTime
        );
      })
      .sort((a, b) => normalizeTime(a.time || '').localeCompare(normalizeTime(b.time || '')));
  };

  // Renderizar a grade de horários
  return (
    <div className="flex flex-col w-full">
      {Object.entries(groupedTimeSlots)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([hour, slots]) => (
          <div key={`hour-${hour}`} className="flex flex-col w-full">
            <div className="flex w-full min-w-0">
              <div
                className="flex-shrink-0 w-[50px] sm:w-[60px] md:w-[70px] lg:w-[80px] flex flex-col border-b border-gray-200 border-l hover:bg-gray-50 excel-time-column sticky-time-column"
                style={{ height: `${hourHeight}px` }}
              >
                <div className="absolute top-0 left-0 w-full text-center py-1">
                  <span className="text-xs font-medium text-gray-500">{`${hour}:00`}</span>
                </div>

                {slots.map((time) => {
                  const [, minutes] = time.split(':').map(Number);
                  if (minutes === 0) return null;
                  const offsetTop = (minutes / 60) * hourHeight;

                  return (
                    <div
                      key={`time-${hour}-${minutes}`}
                      className="absolute w-full flex items-center justify-center"
                      style={{ height: `${slotHeight}px`, top: `${offsetTop}px` }}
                    >
                      <span className="text-xs text-gray-400 font-medium">{minutes}</span>
                    </div>
                  );
                })}
              </div>

              {paginatedProfessionals.map((professional, profIndex) => (
                <div
                  key={`prof-${professional.id}-${hour}-${profIndex}`}
                  className="border-b border-gray-200 border-l relative"
                  style={{ 
                    height: `${hourHeight}px`,
                    width: `calc((100% - 50px) / ${paginatedProfessionals.length})`,
                    flexShrink: 0,
                    flexGrow: 0
                  }}
                >
                  {slots.map((time, timeIndex) => {
                    const [, minutes] = time.split(':').map(Number);
                    const professionalId = professional.id || '';
                    const slotAppointments = getAppointmentsForSlot(professionalId, time);
                    const isDropTarget =
                      dragState?.dropTarget?.professionalId === professionalId &&
                      dragState?.dropTarget?.time === time;

                    const offsetTop = (minutes / 60) * hourHeight;

                    return (
                      <div
                        key={`slot-${professionalId}-${time}-${profIndex}-${timeIndex}`}
                        className={`absolute w-full hover:bg-indigo-50 transition-colors cursor-pointer group ${
                          isDropTarget ? 'bg-indigo-200 border border-indigo-500' : ''
                        }`}
                        style={{
                          height: `${slotHeight}px`,
                          backgroundColor: isDropTarget ? '#EBE9FB' : minutes % 30 === 0 ? '#fafafa' : '#fff',
                          top: `${offsetTop}px`,
                          borderBottom: '1px solid #f0f0f0'
                        }}
                        onClick={(e) => {
                          if (!slotAppointments.length && professionalId) onSlotClick(e, time, professionalId);
                        }}
                        onDragOver={(e) => professionalId && onDragOver(e, time, professionalId)}
                        onDrop={(e) => professionalId && onDrop(e, time, professionalId)}
                      >
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 z-20 flex items-center pointer-events-none transition-opacity" style={{ backgroundColor: '#EBE9FB' }}>
                          <span className="px-1 text-xs sm:text-sm text-indigo-700 font-medium">{time}</span>
                        </div>

                        {slotAppointments.map((appointment, appIndex) => {
                          let duration = 30; // Valor padrão
                          
                          if (appointment.appointment_services && appointment.appointment_services.length > 0) {
                            const totalTime = appointment.appointment_services
                              .map(s => s.custom_time || (s.service?.estimated_time || 30))
                              .reduce((acc, cur) => acc + cur, 0);
                            
                            duration = totalTime > 0 ? totalTime : 30;
                          } else if (appointment.services_relations && appointment.services_relations.length > 0) {
                            duration = appointment.services_relations.reduce((total, s: any) => 
                              total + (s.custom_time || (s.service?.estimated_time || 30)), 0);
                          } else {
                            duration = 30; // Valor padrão para agendamentos sem serviços
                          }

                          const appointmentTime = normalizeTime(appointment.time || '');
                          if (appointmentTime !== time) return null;

                          const height = (duration / 60) * hourHeight;
                          const isDragging = dragState?.appointment?.id === appointment.id;

                          return (
                            <AppointmentCard
                              key={`app-${appointment.id}-${appIndex}`}
                              appointment={appointment}
                              services={services}
                              professionals={professionals}
                              height={height}
                              isDragging={isDragging}
                              onDragStart={onDragStart}
                              onClick={onAppointmentClick}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
