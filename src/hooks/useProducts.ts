import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export interface Product {
  id: string;
  name: string;
  price: number;
  cost_price: number;
  profit_margin?: number;
  stock: number;
  description?: string;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface UseProductsOptions {
  onlyActive?: boolean;
  realtimeUpdates?: boolean;
}

export function useProducts(options: UseProductsOptions = {}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { onlyActive = true, realtimeUpdates = true } = options;

  // Função para carregar os produtos
  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase.from('products').select('*');
      
      // Filtrar apenas produtos ativos, se solicitado
      if (onlyActive) {
        query = query.eq('active', true);
      }

      // Ordenar por nome
      query = query.order('name');

      const { data, error: supabaseError } = await query;

      if (supabaseError) {
        throw supabaseError;
      }

      setProducts(data || []);
    } catch (err) {
      console.error('Erro ao carregar produtos:', err);
      setError(err instanceof Error ? err : new Error('Erro desconhecido ao carregar produtos'));
    } finally {
      setLoading(false);
    }
  };

  // Carregar produtos inicialmente
  useEffect(() => {
    loadProducts();

    // Configurar atualização em tempo real se solicitado
    if (realtimeUpdates) {
      // Inscrever-se para receber atualizações da tabela de produtos
      const subscription = supabase
        .channel('products-changes')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'products' 
          }, 
          () => {
            // Quando houver qualquer alteração na tabela de produtos, recarregar
            loadProducts();
          }
        )
        .subscribe();

      // Limpar inscrição quando o componente for desmontado
      return () => {
        subscription.unsubscribe();
      };
    }
  }, [onlyActive, realtimeUpdates]);

  // Função para pesquisar produtos pelo nome
  const searchProducts = (searchTerm: string): Product[] => {
    if (!searchTerm) return products;
    
    return products.filter(product => 
      product.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  return {
    products,
    loading,
    error,
    searchProducts,
    refreshProducts: loadProducts
  };
} 