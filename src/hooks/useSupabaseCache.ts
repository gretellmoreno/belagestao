import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

interface CacheItem<T> {
  data: T;
  timestamp: number;
}

// Aumentar duração do cache para 12 horas
const CACHE_DURATION = 12 * 60 * 60 * 1000; 
const LOCAL_STORAGE_PREFIX = 'bela_gestao_cache_';

// Cache em memória
const memoryCache: { [key: string]: CacheItem<any> } = {};

// Inicializar o cache da memória com dados do localStorage
function initializeMemoryCache() {
  try {
    // Buscar todas as chaves do localStorage que começam com o prefixo
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(LOCAL_STORAGE_PREFIX)) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '');
          if (data && data.timestamp) {
            memoryCache[key.replace(LOCAL_STORAGE_PREFIX, '')] = data;
          }
        } catch (error) {
          console.error('Erro ao carregar dados do cache do localStorage:', error);
        }
      }
    });
    
  } catch (error) {
    
  }
}

// Inicializar o cache na primeira carga
initializeMemoryCache();

export function useSupabaseCache<T>(
  table: string,
  options: {
    select?: string;
    filters?: { column: string; value: any }[];
    orderBy?: { column: string; ascending?: boolean };
    cacheKey?: string;
    cacheDuration?: number;
  } = {}
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const cacheKey = options.cacheKey || `${table}-${JSON.stringify(options)}`;
  const cacheDuration = options.cacheDuration || CACHE_DURATION;
  const localStorageKey = `${LOCAL_STORAGE_PREFIX}${cacheKey}`;

  // Função para salvar no localStorage
  const saveToLocalStorage = useCallback((key: string, data: CacheItem<any>) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      
    }
  }, []);

  const fetchData = useCallback(async (force: boolean = false) => {
    // Verificar cache em memória
    const cachedData = memoryCache[cacheKey];
    const now = Date.now();
    
    if (!force && cachedData && now - cachedData.timestamp < cacheDuration) {
      
      setData(cachedData.data);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let query = supabase.from(table).select(options.select || '*');

      // Aplicar filtros
      if (options.filters) {
        options.filters.forEach(filter => {
          query = query.eq(filter.column, filter.value);
        });
      }

      // Aplicar ordenação
      if (options.orderBy) {
        query = query.order(options.orderBy.column, {
          ascending: options.orderBy.ascending ?? true
        });
      }

      const { data: result, error: queryError } = await query;

      if (queryError) throw queryError;

      // Atualizar cache de memória
      memoryCache[cacheKey] = {
        data: result,
        timestamp: now
      };
      
      // Atualizar localStorage
      saveToLocalStorage(localStorageKey, memoryCache[cacheKey]);

      setData(result as T[]);
      setError(null);
    } catch (err) {
      setError(err as Error);
      
      
      // Tentar usar cache expirado como fallback
      if (cachedData) {
        
        setData(cachedData.data as T[]);
      }
    } finally {
      setLoading(false);
    }
  }, [table, cacheKey, cacheDuration, options.select, options.filters, options.orderBy, localStorageKey, saveToLocalStorage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const invalidateCache = useCallback(() => {
    
    delete memoryCache[cacheKey];
    try {
      localStorage.removeItem(localStorageKey);
    } catch (error) {
      console.error('Erro ao remover item do localStorage:', error);
    }
    fetchData(true);
  }, [cacheKey, fetchData, localStorageKey, table]);

  // Configurar listener para dados em tempo real se a tabela suportar
  useEffect(() => {
    // Verificar se a tabela é uma daquelas que precisa de atualização em tempo real
    const realtimeTables = ['appointments', 'clients', 'professionals', 'services'];
    if (!realtimeTables.includes(table)) return;
    
    
    
    const channel = supabase
      .channel(`${table}-changes`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: table
      }, (payload) => {
        console.log(`Alteração detectada na tabela ${table}:`, payload);
        // Recarregar os dados quando houver alterações
        fetchData(true);
      })
      .subscribe();
    
    return () => {
      
      channel.unsubscribe();
    };
  }, [table, fetchData]);

  return { data, loading, error, refetch: invalidateCache };
} 