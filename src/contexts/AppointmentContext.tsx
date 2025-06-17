import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { isValidUUID } from '../lib/uuidUtils';
import type { Appointment } from '../lib/appointmentService';

interface AppointmentContextData {
  appointments: Appointment[];
  loading: boolean;
  error: string | null;
  loadAppointmentsByDate: (date: string, forceRefresh?: boolean) => Promise<void>;
  addAppointment: (appointment: Partial<Appointment> & {
    _serviceIds?: string[];
    _customTimes?: Record<string, number>;
    _customPrices?: Record<string, number>;
    _selectedServices?: Array<{
      id?: string;
      service_id?: string;
      custom_price?: number;
      custom_time?: number;
      payment_method_id?: string;
      created_at?: string;
    }>;
  }) => Promise<Appointment>;
  updateAppointment: (id: string, data: Partial<Appointment> | Record<string, any>) => Promise<void>;
  setAppointments: React.Dispatch<React.SetStateAction<Appointment[]>>;
  clearCache: () => void;
}

const AppointmentContext = createContext<AppointmentContextData>({} as AppointmentContextData);

export function AppointmentProvider({ children }: { children: React.ReactNode }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Cache para armazenar agendamentos por data
  const appointmentsCache = useRef<{
    [date: string]: {
      data: Appointment[];
      timestamp: number;
    }
  }>({});

  // Tempo de expiração do cache em milissegundos (30 minutos)
  const CACHE_EXPIRATION = 30 * 60 * 1000;

  const clearCache = useCallback(() => {
    appointmentsCache.current = {};
  }, []);

  // Função para processar agendamentos após busca
  const processAppointments = useCallback((appointments: any[]) => {
    return appointments.map(appointment => {
      // Calcular a duração total com base nos serviços
      const services = appointment.appointment_services || [];
      let totalDuration = 0;
      
      // Definir título para exibição com nome do primeiro serviço
      let serviceTitle = 'Serviço não especificado';
      
      if (services.length > 0) {
        // Somar as durações personalizadas de cada serviço
        totalDuration = services.reduce((sum: number, service: any) => {
          // Verificar custom_time primeiro
          if (service.custom_time && service.custom_time > 0) {
            return sum + service.custom_time;
          } 
          // Se não tiver custom_time, usar o estimated_time do serviço
          else if (service.service?.estimated_time && service.service.estimated_time > 0) {
            return sum + service.service.estimated_time;
          } 
          // Valor padrão se não encontrar tempo
          else {
            return sum + 30;
          }
        }, 0);
        
        // Usar o nome do primeiro serviço para o título
        if (services[0].service && services[0].service.name) {
          serviceTitle = services[0].service.name;
          
          // Adicionar indicador se houver mais serviços
          if (services.length > 1) {
            serviceTitle += ` (+${services.length - 1})`;
          }
        }
      }
      
      // Se não houver duração calculada, definir um valor padrão
      if (totalDuration === 0) {
        totalDuration = 30;
      }
      
      // Retornar objeto com campos calculados
      return {
        ...appointment,
        duration: totalDuration, // Campo virtual para uso interno
        text_label: `${appointment.client?.name || 'Cliente não especificado'}\n${serviceTitle}`
      };
    });
  }, []);

  const loadAppointmentsByDate = useCallback(async (date: string, forceRefresh = false) => {
    try {
      // Verificar cache primeiro
      const cachedData = appointmentsCache.current[date];
      const now = Date.now();
      
      if (!forceRefresh && cachedData && (now - cachedData.timestamp) < CACHE_EXPIRATION) {
        console.log('[AppointmentContext] Usando dados em cache para:', date);
        setAppointments(cachedData.data);
        return;
      }

      setLoading(true);
      console.log('[AppointmentContext] Carregando agendamentos do servidor para:', date);

      // 🔧 DIAGNÓSTICO: Log detalhado da consulta
      console.log('🔍 [DIAGNÓSTICO] Iniciando busca de agendamentos para data:', date);
      console.log('🔍 [DIAGNÓSTICO] Horário atual do sistema:', new Date().toISOString());
      console.log('🔍 [DIAGNÓSTICO] Timezone do navegador:', Intl.DateTimeFormat().resolvedOptions().timeZone);

      const { data, error: fetchError } = await supabase
        .from('appointments')
        .select(`
          id,
          client_id,
          professional_id,
          date,
          time,
          status,
          notes,
          created_at,
          updated_at,
          appointment_services (
            id,
            service_id,
            custom_price,
            custom_time,
            service:service_id (
              id,
              name,
              price,
              estimated_time
            )
          ),
          client:clients (
            id,
            name,
            phone,
            email
          ),
          professional:professionals (
            id,
            name,
            color
          )
        `)
        .eq('date', date)
        .order('time');

      if (fetchError) throw fetchError;

      // 🔧 DIAGNÓSTICO: Log dos resultados da consulta
      console.log('🔍 [DIAGNÓSTICO] Agendamentos retornados do banco:', data?.length || 0);
      if (data && data.length > 0) {
        console.log('🔍 [DIAGNÓSTICO] Primeiro agendamento encontrado:', {
          id: data[0].id,
          date: data[0].date,
          time: data[0].time,
          status: data[0].status,
          created_at: data[0].created_at
        });
        console.log('🔍 [DIAGNÓSTICO] Último agendamento encontrado:', {
          id: data[data.length - 1].id,
          date: data[data.length - 1].date,
          time: data[data.length - 1].time,
          status: data[data.length - 1].status,
          created_at: data[data.length - 1].created_at
        });
      } else {
        console.warn('🚨 [DIAGNÓSTICO] NENHUM agendamento foi retornado para a data:', date);
        console.warn('🚨 [DIAGNÓSTICO] Isso pode indicar um problema no banco de dados ou configuração de timezone');
      }

      // Processar os agendamentos para adicionar duração e texto
      const processedData = processAppointments(data || []);

      // 🔧 DIAGNÓSTICO: Log dos dados processados
      console.log('🔍 [DIAGNÓSTICO] Agendamentos após processamento:', processedData.length);

      // Atualizar cache
      appointmentsCache.current[date] = {
        data: processedData,
        timestamp: now
      };

      setAppointments(processedData);
      setError(null);

      // 🔧 DIAGNÓSTICO: Log final
      console.log('✅ [DIAGNÓSTICO] Agendamentos carregados com sucesso para', date, '- Total:', processedData.length);
      
    } catch (err) {
      console.error('[AppointmentContext] Erro ao carregar agendamentos:', err);
      console.error('🚨 [DIAGNÓSTICO] Erro detalhado:', {
        message: err instanceof Error ? err.message : 'Erro desconhecido',
        date: date,
        timestamp: new Date().toISOString()
      });
      setError('Erro ao carregar agendamentos');
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const addAppointment = useCallback(async (appointment: Partial<Appointment> & {
    _serviceIds?: string[];
    _customTimes?: Record<string, number>;
    _customPrices?: Record<string, number>;
    _selectedServices?: Array<{
      id?: string;
      service_id?: string;
      custom_price?: number;
      custom_time?: number;
      payment_method_id?: string;
      created_at?: string;
    }>;
  }): Promise<Appointment> => {
    try {
      console.log('[AppointmentContext] Iniciando adição de agendamento:', appointment);
      
      // Validar _selectedServices
      if (appointment._selectedServices && Array.isArray(appointment._selectedServices)) {
        // Verificar se cada serviço tem service_id válido
        const servicosValidos = appointment._selectedServices.map((s: any) => {
          // Se o serviço tem id mas não tem service_id, usar o id como service_id
          if (!s.service_id && s.id) {
            return {
              ...s,
              service_id: s.id,
              // Remover o id original para evitar duplicidade
              id: undefined
            };
          }
          return s;
        }).filter((s: any) => {
          const serviceId = s.service_id;
          return !!serviceId && typeof serviceId === 'string' && serviceId.trim() !== '' && isValidUUID(serviceId);
        });
        
        console.log(`[AppointmentContext] Serviços: ${appointment._selectedServices.length} total, ${servicosValidos.length} válidos`);
        
        if (servicosValidos.length === 0) {
          console.error('[AppointmentContext] Nenhum serviço válido para criar agendamento');
          throw new Error('Não é possível criar um agendamento sem serviços válidos. Todos os serviços devem ter service_id (id) definido e ser um UUID válido.');
        }
        
        // Criar novo objeto de agendamento com serviços validados
        const appointmentWithValidServices = {
          ...appointment,
          _selectedServices: servicosValidos
        };
        
        // Criar o agendamento usando a função do appointmentService
        const { createAppointment } = await import('../lib/appointmentService');
        const newAppointment = await createAppointment(appointmentWithValidServices);
        
        // Atualizar o cache e o estado
        if (newAppointment) {
          const date = newAppointment.date;
          if (appointmentsCache.current[date]) {
            appointmentsCache.current[date] = {
              data: [...appointmentsCache.current[date].data, newAppointment],
              timestamp: Date.now()
            };
          }
          setAppointments(prev => [...prev, newAppointment]);
        }
        
        return newAppointment;
      } else {
        throw new Error('Nenhum serviço selecionado para o agendamento.');
      }
    } catch (error) {
      console.error('[AppointmentContext] Erro ao adicionar agendamento:', error);
      throw error;
    }
  }, []);

  const updateAppointment = useCallback(async (id: string, data: Partial<Appointment> | Record<string, any>) => {
    try {
      setLoading(true);
      
      console.log('[AppointmentContext] Encaminhando dados para updateAppointment:', { id, data });
      
      // Usar a função updateAppointment do appointmentService.ts
      const { updateAppointment: updateAppointmentService } = await import('../lib/appointmentService');
      const updatedAppointment = await updateAppointmentService(id, data);
      
      console.log('[AppointmentContext] Agendamento atualizado com sucesso:', updatedAppointment);
      
      // Atualizar cache e estado
      if (updatedAppointment) {
        const date = updatedAppointment.date;
        if (appointmentsCache.current[date]) {
          appointmentsCache.current[date] = {
            data: appointmentsCache.current[date].data.map(apt => 
              apt.id === id ? updatedAppointment : apt
            ),
            timestamp: Date.now()
          };
        }
        setAppointments(prev => prev.map(apt => 
          apt.id === id ? updatedAppointment : apt
        ));
      }
    } catch (err) {
      console.error('[AppointmentContext] Erro ao atualizar agendamento:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <AppointmentContext.Provider
      value={{
        appointments,
        loading,
        error,
        loadAppointmentsByDate,
        addAppointment,
        updateAppointment,
        setAppointments,
        clearCache
      }}
    >
      {children}
    </AppointmentContext.Provider>
  );
}

export function useAppointments() {
  const context = useContext(AppointmentContext);
  if (!context) {
    throw new Error('useAppointments deve ser usado dentro de um AppointmentProvider');
  }
  return context;
}