import { useState, useCallback, useEffect } from 'react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabaseClient';

interface UseOccupiedSlotsProps {
  interval?: number;  // Intervalo entre slots em minutos
  maxHour?: number;   // Hora máxima para mostrar slots (ex: 20 para 20:00)
}

export function useOccupiedSlots({
  interval = 15,
  maxHour = 20
}: UseOccupiedSlotsProps = {}) {
  const [occupiedSlotsCache, setOccupiedSlotsCache] = useState<Record<string, string[]>>({});
  const [loadingSlots, setLoadingSlots] = useState<boolean>(false);

  // Função para obter os slots ocupados para uma data e profissional específicos
  const getOccupiedTimeSlots = useCallback(async (
    date: string,
    professionalId: string,
    excludeAppointmentId?: string
  ) => {
    try {
      if (!professionalId) {
        console.log('Nenhum profissional selecionado, retornando lista vazia');
        return [];
      }
      
      // Criar uma consulta Supabase para buscar agendamentos com seus serviços
      let query = supabase
        .from('appointments')
        .select(`
          id, 
          time, 
          status, 
          appointment_services(custom_time)
        `)
        .eq('date', date)
        .eq('professional_id', professionalId)
        .in('status', ['agendado', 'realizado', 'pendente']); // Considerar apenas agendamentos ativos
      
      // Se estiver editando, excluir o agendamento atual da listagem de ocupados
      if (excludeAppointmentId) {
        query = query.neq('id', excludeAppointmentId);
      }
      
      // Executar a consulta
      const { data: appointments, error } = await query;

      if (error) {
        console.error('Erro ao buscar horários ocupados:', error);
        throw error;
      }

      console.log('Agendamentos encontrados:', appointments?.length);
      
      const occupiedSlots = new Set<string>();
      
      appointments?.forEach(appointment => {
        try {
          // Converter o horário inicial para minutos
          const [hours, minutes] = appointment.time.split(':').map(Number);
          const startMinutes = hours * 60 + minutes;
          
          // Calcular a duração total somando os custom_time dos serviços
          const totalDuration = appointment.appointment_services
            ?.map((s: any) => s.custom_time || 0)
            ?.reduce((acc: number, cur: number) => acc + cur, 0) || 30; // 30 min como fallback
          
          // Calcular o horário final
          const endMinutes = startMinutes + totalDuration;
          
          // Marcar todos os slots de X em X minutos que estão ocupados por este agendamento
          for (let currentMinute = startMinutes; currentMinute < endMinutes; currentMinute += interval) {
            const slotHour = Math.floor(currentMinute / 60);
            const slotMinute = currentMinute % 60;
            
            // Não adicionar slots após a hora máxima configurada
            if (slotHour >= maxHour) continue;
            
            const timeSlot = `${String(slotHour).padStart(2, '0')}:${String(slotMinute).padStart(2, '0')}`;
            occupiedSlots.add(timeSlot);
          }
        } catch (err) {
          console.error('Erro ao processar horário do agendamento:', err, appointment);
        }
      });

      const occupiedArray = Array.from(occupiedSlots);
      return occupiedArray;
    } catch (error) {
      console.error('Erro ao carregar horários ocupados:', error);
      return [];
    }
  }, [interval, maxHour]);

  // Função para carregar os slots ocupados e atualizar o cache
  const loadOccupiedSlots = useCallback(async (
    date: Date,
    professionalId: string,
    excludeAppointmentId?: string
  ) => {
    if (!professionalId) {
      console.log('Nenhum profissional selecionado, não carregando horários ocupados');
      return [];
    }

    try {
      setLoadingSlots(true);
      
      // Formatar a data para o formato correto
      const dateStr = format(date, 'yyyy-MM-dd');
      const cacheKey = `${dateStr}-${professionalId}-${excludeAppointmentId || ''}`;
      
      // Verificar se já temos esses dados em cache
      if (occupiedSlotsCache[cacheKey]) {
        console.log('Usando dados de cache para:', cacheKey);
        setLoadingSlots(false);
        return occupiedSlotsCache[cacheKey];
      }
      
      // Buscar os slots ocupados
      console.log('Buscando horários ocupados para:', dateStr, professionalId);
      const slots = await getOccupiedTimeSlots(dateStr, professionalId, excludeAppointmentId);
      
      // Atualizar o cache
      setOccupiedSlotsCache(prev => ({
        ...prev,
        [cacheKey]: slots
      }));
      
      return slots;
    } catch (error) {
      console.error('Erro ao carregar horários ocupados:', error);
      return [];
    } finally {
      setLoadingSlots(false);
    }
  }, [getOccupiedTimeSlots, occupiedSlotsCache]);

  // Limpar o cache quando necessário
  const clearCache = useCallback(() => {
    setOccupiedSlotsCache({});
  }, []);

  return {
    loadingSlots,
    occupiedSlotsCache,
    getOccupiedTimeSlots,
    loadOccupiedSlots,
    clearCache
  };
} 