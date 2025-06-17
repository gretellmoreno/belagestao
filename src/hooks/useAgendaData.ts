import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Professional } from '../lib/professionalService';
import type { Service } from '../lib/serviceService';
import type { PaymentMethod } from '../types';

interface AgendaData {
  professionals: Professional[];
  services: Service[];
  paymentMethods: PaymentMethod[];
  loading: boolean;
  error: Error | null;
}

export function useAgendaData(): AgendaData {
  const [data, setData] = useState<AgendaData>({
    professionals: [],
    services: [],
    paymentMethods: [],
    loading: true,
    error: null
  });

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        // Fazer todas as requisições em paralelo
        const [
          { data: professionals, error: profError },
          { data: services, error: servError },
          { data: paymentMethods, error: payError }
        ] = await Promise.all([
          supabase
            .from('professionals')
            .select('*')
            .eq('active', true)
            .order('name'),
          supabase
            .from('services')
            .select('*')
            .eq('active', true)
            .order('name'),
          supabase
            .from('payment_methods')
            .select('*')
            .order('name')
        ]);

        if (profError) throw profError;
        if (servError) throw servError;
        if (payError) throw payError;

        if (isMounted) {
          setData({
            professionals: professionals || [],
            services: services || [],
            paymentMethods: paymentMethods || [],
            loading: false,
            error: null
          });
        }
      } catch (error) {
        console.error('Erro ao carregar dados da agenda:', error);
        if (isMounted) {
          setData(prev => ({
            ...prev,
            loading: false,
            error: error as Error
          }));
        }
      }
    };

    loadData();

    // Configurar subscription para atualizações
    const professionalsSub = supabase
      .channel('professionals-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'professionals'
      }, loadData)
      .subscribe();

    const servicesSub = supabase
      .channel('services-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'services'
      }, loadData)
      .subscribe();

    return () => {
      isMounted = false;
      professionalsSub.unsubscribe();
      servicesSub.unsubscribe();
    };
  }, []);

  return data;
} 