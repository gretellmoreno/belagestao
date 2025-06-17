import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Client } from '../types';
import { toast } from 'react-hot-toast';

export const useClients = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadClients = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');

      if (error) throw error;

      setClients(data || []);
    } catch (err: any) {
      console.error('Erro ao carregar clientes:', err);
      setError(err.message || 'Erro ao carregar clientes');
      toast.error('Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  return {
    clients,
    loading,
    error,
    loadClients
  };
}; 