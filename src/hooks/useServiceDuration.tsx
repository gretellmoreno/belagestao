import { useState, useCallback, useMemo } from 'react';
import { Service } from '../lib/serviceService';

interface UseServiceDurationProps {
  services: Service[];
  initialCustomTimes?: Record<string, number>;
  minServiceTime?: number;
}

export function useServiceDuration({
  services,
  initialCustomTimes = {},
  minServiceTime = 15
}: UseServiceDurationProps) {
  // Estado para armazenar tempos personalizados por serviço
  const [customTimes, setCustomTimes] = useState<Record<string, number>>(initialCustomTimes);

  // Função para atualizar o tempo personalizado de um serviço
  const updateCustomTime = useCallback((serviceName: string, time: number) => {
    // Garantir que o tempo não seja menor que o mínimo
    const safeTime = time < minServiceTime ? minServiceTime : time;
    
    setCustomTimes(prev => ({
      ...prev,
      [serviceName]: safeTime
    }));
  }, [minServiceTime]);

  // Função para remover um tempo personalizado
  const removeCustomTime = useCallback((serviceName: string) => {
    setCustomTimes(prev => {
      const updatedTimes = { ...prev };
      delete updatedTimes[serviceName];
      return updatedTimes;
    });
  }, []);

  // Função para calcular a duração total dos serviços selecionados
  const calculateTotalDuration = useCallback((selectedServiceNames: string[]): number => {
    return selectedServiceNames.reduce((total, serviceName) => {
      const service = services.find(s => s.name === serviceName);
      if (!service) return total;
      
      // Usar o tempo personalizado se existir, senão usar o tempo original do serviço
      const serviceTime = customTimes[serviceName] !== undefined 
        ? customTimes[serviceName] 
        : service.estimated_time;
        
      return total + (serviceTime || 30); // Fallback para 30 min se não houver tempo estimado
    }, 0);
  }, [services, customTimes]);

  // Calcular tempos individuais para cada serviço (para exibição)
  const servicesDurations = useMemo(() => {
    const durationsMap: Record<string, number> = {};
    
    services.forEach(service => {
      const customTime = customTimes[service.name];
      durationsMap[service.name] = customTime !== undefined 
        ? customTime 
        : (service.estimated_time || 30);
    });
    
    return durationsMap;
  }, [services, customTimes]);

  // Formatar duração em formato legível (ex: 1h 30min)
  const formatDuration = useCallback((minutes: number): string => {
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
  }, []);

  return {
    customTimes,
    servicesDurations,
    updateCustomTime,
    removeCustomTime,
    calculateTotalDuration,
    formatDuration
  };
} 