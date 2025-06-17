import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Professional } from '../types';
import { toast } from 'react-hot-toast';

export const useProfessionals = () => {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfessionals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('professionals')
        .select('*')
        .order('name');

      if (error) throw error;

      setProfessionals(data || []);
    } catch (err: any) {
      console.error('Erro ao carregar profissionais:', err);
      setError(err.message || 'Erro ao carregar profissionais');
      toast.error('Erro ao carregar profissionais');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfessionals();
  }, [loadProfessionals]);

  return {
    professionals,
    loading,
    error,
    loadProfessionals
  };
}; 