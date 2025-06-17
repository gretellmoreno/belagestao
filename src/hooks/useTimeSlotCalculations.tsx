import { useMemo } from 'react';

interface TimeSlotCalculationsProps {
  workingHoursStart?: number;  // Ex: 6 for 6 AM
  workingHoursEnd?: number;    // Ex: 23 for 11 PM
  interval?: number;           // Ex: 15 for 15 min intervals
  maxEndTime?: number;         // Ex: 1260 for 21:00 (21 hours * 60 minutes)
}

export function useTimeSlotCalculations({
  workingHoursStart = 6,
  workingHoursEnd = 23,
  interval = 15,
  maxEndTime = 1260 // 21:00 (21 hours * 60 minutes)
}: TimeSlotCalculationsProps = {}) {
  
  // Gerar todos os slots de tempo disponíveis
  const allTimeSlots = useMemo(() => {
    const slots = [];
    for (let hour = workingHoursStart; hour < workingHoursEnd; hour++) {
      for (let minute = 0; minute < 60; minute += interval) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(time);
      }
    }
    return slots;
  }, [workingHoursStart, workingHoursEnd, interval]);

  // Agrupar slots por hora
  const groupedTimeSlots = useMemo(() => {
    const grouped: { [hour: string]: string[] } = {};
    
    allTimeSlots.forEach(time => {
      const hour = time.substring(0, 2);
      if (!grouped[hour]) {
        grouped[hour] = [];
      }
      grouped[hour].push(time);
    });
    
    return grouped;
  }, [allTimeSlots]);

  // Mapear um horário para um índice de posição vertical na grade
  const mapTimeToSlotIndex = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;
    const startOfDayMinutes = workingHoursStart * 60;
    return Math.floor((totalMinutes - startOfDayMinutes) / interval);
  };

  // Converter minutos para horário formatado (HH:MM)
  const minutesToTimeString = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  // Verificar se um slot está disponível, considerando horários ocupados e duração do serviço
  const isSlotAvailable = (
    slot: string,
    occupiedSlots: string[],
    serviceDuration: number
  ): boolean => {
    // Converter o horário do slot para minutos desde o início do dia
    const [hours, minutes] = slot.split(':').map(Number);
    const slotMinutes = hours * 60 + minutes;
    
    // Calcular o horário final do serviço
    const endTimeMinutes = slotMinutes + serviceDuration;
    
    // Não permitir agendamentos que terminem depois do horário máximo definido
    if (endTimeMinutes > maxEndTime) {
      return false;
    }

    // Verificar se algum dos horários necessários está ocupado
    const numSlots = Math.ceil(serviceDuration / interval) - 1; // Subtrair 1 para não verificar o último slot
    for (let i = 0; i < numSlots; i++) {
      const checkMinutes = slotMinutes + (i * interval);
      const checkSlot = minutesToTimeString(checkMinutes);
      
      if (occupiedSlots.includes(checkSlot)) {
        return false;
      }
    }
    
    return true;
  };

  // Filtrar slots disponíveis com base nos ocupados e na duração do serviço
  const filterAvailableSlots = (
    occupiedSlots: string[],
    serviceDuration: number
  ): string[] => {
    return allTimeSlots.filter(slot => 
      isSlotAvailable(slot, occupiedSlots, serviceDuration)
    );
  };

  return {
    allTimeSlots,
    groupedTimeSlots,
    mapTimeToSlotIndex,
    minutesToTimeString,
    isSlotAvailable,
    filterAvailableSlots
  };
} 