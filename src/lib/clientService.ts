import { supabase } from './supabaseClient';
import { mockClients, simulateLoading } from './mockData';

export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  cpf?: string;
  birth_date?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  last_visit?: string;
}

const CLIENTS_TABLE = 'clients';

export async function getClients() {
  try {
    const { data, error } = await supabase
      .from(CLIENTS_TABLE)
      .select('*')
      .order('name');
    
    if (error) {
      await simulateLoading(300);
      return mockClients;
    }
    
    // Se não houver dados, mas não houver erro, usar dados mock
    if (!data || data.length === 0) {
      return mockClients;
    }
    
    return data;
  } catch (error) {
    await simulateLoading(300);
    return mockClients;
  }
}

export async function getClientById(id: string) {
  const { data, error } = await supabase
    .from(CLIENTS_TABLE)
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    console.error(`Error fetching client with id ${id}:`, error);
    throw error;
  }
  
  return data;
}

export async function createClient(client: Omit<Client, 'id'>) {
  const { data, error } = await supabase
    .from(CLIENTS_TABLE)
    .insert([{
      name: client.name,
      phone: client.phone,
      email: client.email,
      cpf: client.cpf,
      birth_date: client.birth_date,
      notes: client.notes,
      created_at: client.created_at,
      updated_at: client.updated_at
    }])
    .select();
  
  if (error) {
    console.error('Error creating client:', error);
    throw error;
  }
  
  return data?.[0];
}

export async function updateClient(id: string, client: Partial<Client>) {
  const updateData: Partial<Client> = {};
  
  if (client.name) updateData.name = client.name;
  if (client.phone) updateData.phone = client.phone;
  if (client.email) updateData.email = client.email;
  if (client.cpf) updateData.cpf = client.cpf;
  if (client.birth_date) updateData.birth_date = client.birth_date;
  if (client.notes) updateData.notes = client.notes;
  if (client.created_at) updateData.created_at = client.created_at;
  if (client.updated_at) updateData.updated_at = client.updated_at;
  if (client.last_visit) updateData.last_visit = client.last_visit;

  const { data, error } = await supabase
    .from(CLIENTS_TABLE)
    .update(updateData)
    .eq('id', id)
    .select();
  
  if (error) {
    console.error(`Error updating client with id ${id}:`, error);
    throw error;
  }
  
  return data?.[0];
}

export async function deleteClient(id: string) {
  const { error } = await supabase
    .from(CLIENTS_TABLE)
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error(`Error deleting client with id ${id}:`, error);
    throw error;
  }
  
  return true;
}

export async function searchClients(searchTerm: string, limit: number = 5) {
  const { data, error } = await supabase
    .from(CLIENTS_TABLE)
    .select('*')
    .or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
    .order('name')
    .limit(limit);
  
  if (error) {
    console.error('Error searching clients:', error);
    throw error;
  }
  
  return data || [];
} 