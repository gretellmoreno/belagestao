import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Service } from '../types';
import { toast } from 'react-hot-toast';

export const useServices = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadServices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('name');

      if (error) throw error;

      setServices(data || []);
    } catch (err: any) {
      console.error('Erro ao carregar serviços:', err);
      setError(err.message || 'Erro ao carregar serviços');
      toast.error('Erro ao carregar serviços');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  return {
    services,
    loading,
    error,
    loadServices
  };
}; 