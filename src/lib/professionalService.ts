import { supabase } from './supabaseClient';
import { mockProfessionals, simulateLoading } from './mockData';

export interface Professional {
  id?: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  color: string;
  active: boolean;
  deduct_payment_fee?: boolean;
}

const PROFESSIONALS_TABLE = 'professionals';

export async function getProfessionals() {
  try {
    const { data, error } = await supabase
      .from(PROFESSIONALS_TABLE)
      .select('*')
      .order('name');
    
    if (error) {
      await simulateLoading(300);
      return mockProfessionals;
    }
    
    // Se não houver dados, mas não houver erro, usar dados mock
    if (!data || data.length === 0) {
      return mockProfessionals;
    }
    
    return data;
  } catch (error) {
    await simulateLoading(300);
    return mockProfessionals;
  }
}

export async function getProfessionalById(id: string) {
  const { data, error } = await supabase
    .from(PROFESSIONALS_TABLE)
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    console.error(`Error fetching professional with id ${id}:`, error);
    throw error;
  }
  
  return data;
}

export async function createProfessional(professional: Omit<Professional, 'id'>) {
  const { data, error } = await supabase
    .from(PROFESSIONALS_TABLE)
    .insert([professional])
    .select();
  
  if (error) {
    console.error('Error creating professional:', error);
    throw error;
  }
  
  return data?.[0];
}

export async function updateProfessional(id: string, professional: Partial<Professional>) {
  const { data, error } = await supabase
    .from(PROFESSIONALS_TABLE)
    .update(professional)
    .eq('id', id)
    .select();
  
  if (error) {
    console.error(`Error updating professional with id ${id}:`, error);
    throw error;
  }
  
  return data?.[0];
}

export async function deleteProfessional(id: string) {
  const { error } = await supabase
    .from(PROFESSIONALS_TABLE)
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error(`Error deleting professional with id ${id}:`, error);
    throw error;
  }
  
  return true;
} 