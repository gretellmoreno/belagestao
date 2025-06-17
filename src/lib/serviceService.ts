import { supabase, safeUuidEq } from './supabaseClient';
import { isValidUUID } from './uuidUtils';
import { mockServices, simulateLoading } from './mockData';

export interface Service {
  id: string;
  name: string;
  price: number;
  description: string;
  commission_rate: number;
  estimated_time: number;
  active: boolean;
  created_at: string;
  updated_at: string;
  type: 'service' | 'product';
}

export async function getServices() {
  try {
    console.log('[getServices] Iniciando busca de serviços no banco de dados...');
    
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('active', true)
      .order('name');
    
    if (error) {
      console.error('[getServices] Erro ao buscar serviços no banco:', error);
      console.warn('[getServices] Usando dados mock devido ao erro');
      await simulateLoading(300);
      return mockServices;
    }
    
    // Se não houver dados, mas não houver erro, usar dados mock
    if (!data || data.length === 0) {
      console.warn('[getServices] Nenhum serviço encontrado no banco, usando dados mock');
      return mockServices;
    }
    
    console.log(`[getServices] ${data.length} serviços carregados do banco de dados:`, data.map(s => ({ id: s.id, name: s.name })));
    
    // Validar se todos os IDs são UUIDs válidos
    const invalidServices = data.filter(service => !isValidUUID(service.id));
    if (invalidServices.length > 0) {
      console.error('[getServices] Serviços com IDs inválidos encontrados:', invalidServices);
      console.warn('[getServices] Usando dados mock devido a IDs inválidos no banco');
      return mockServices;
    }
    
    return data;
  } catch (error) {
    console.error('[getServices] Erro inesperado ao buscar serviços:', error);
    console.warn('[getServices] Usando dados mock devido ao erro inesperado');
    await simulateLoading(300);
    return mockServices;
  }
}

export async function getServiceById(id: string) {
  // Se o ID não for um UUID válido, retornar null
  if (!isValidUUID(id)) {
    console.warn(`ID de serviço inválido recebido: ${id}. Não será feita consulta ao banco.`);
    return null;
  }

  const query = supabase.from('services').select('*');
  const { data, error } = await safeUuidEq(query, 'id', id).maybeSingle();
  
  if (error) {
    console.error(`Error fetching service with id ${id}:`, error);
    return null;
  }
  
  if (!data) {
    console.warn(`Service with id ${id} not found`);
    return null;
  }
  
  return data;
}

export const createService = async (newService: Omit<Service, 'id' | 'created_at' | 'updated_at'>): Promise<Service> => {
  const serviceData = {
    name: newService.name,
    price: newService.price ?? 0,
    description: newService.description,
    commission_rate: newService.commission_rate ?? 30,
    estimated_time: newService.estimated_time ?? 30,
    active: newService.active
  };

  const { data, error } = await supabase
    .from('services')
    .insert([serviceData])
    .select();

  if (error) {
    console.error('Error creating service', error);
    throw new Error(error.message);
  }

  return data[0];
};

export const updateService = async (id: string, updatedService: Partial<Omit<Service, 'id' | 'created_at' | 'updated_at'>>): Promise<Service> => {
  // Verificar se o ID é válido
  if (!isValidUUID(id)) {
    console.error(`Tentativa de atualizar serviço com ID inválido: ${id}`);
    throw new Error('ID de serviço inválido');
  }

  const updateData: Record<string, any> = {};
  
  if (updatedService.name !== undefined) updateData.name = updatedService.name;
  if (updatedService.price !== undefined) updateData.price = updatedService.price ?? 0;
  if (updatedService.description !== undefined) updateData.description = updatedService.description;
  if (updatedService.commission_rate !== undefined) updateData.commission_rate = updatedService.commission_rate ?? 30;
  if (updatedService.estimated_time !== undefined) updateData.estimated_time = updatedService.estimated_time ?? 30;
  if (updatedService.active !== undefined) updateData.active = updatedService.active;

  const query = supabase.from('services').update(updateData);
  const { data, error } = await safeUuidEq(query, 'id', id).select();

  if (error) {
    console.error('Error updating service', error);
    throw new Error(error.message);
  }

  return data[0];
};

export async function deleteService(id: string) {
  // Verificar se o ID é válido
  if (!isValidUUID(id)) {
    console.error(`Tentativa de excluir serviço com ID inválido: ${id}`);
    throw new Error('ID de serviço inválido');
  }

  const query = supabase.from('services').delete();
  const { error } = await safeUuidEq(query, 'id', id);
  
  if (error) {
    console.error(`Error deleting service with id ${id}:`, error);
    throw error;
  }
  
  return true;
}

export async function validateServiceExists(serviceId: string): Promise<boolean> {
  try {
    console.log(`[validateServiceExists] Verificando se serviço ${serviceId} existe no banco...`);
    
    if (!isValidUUID(serviceId)) {
      console.error(`[validateServiceExists] ID inválido: ${serviceId}`);
      return false;
    }

    const { data, error } = await supabase
      .from('services')
      .select('id')
      .eq('id', serviceId)
      .eq('active', true)
      .maybeSingle();

    if (error) {
      console.error(`[validateServiceExists] Erro ao verificar serviço ${serviceId}:`, error);
      return false;
    }

    const exists = !!data;
    console.log(`[validateServiceExists] Serviço ${serviceId} ${exists ? 'encontrado' : 'não encontrado'} no banco`);
    return exists;
  } catch (error) {
    console.error(`[validateServiceExists] Erro inesperado ao verificar serviço ${serviceId}:`, error);
    return false;
  }
}

export async function validateAllServicesExist(serviceIds: string[]): Promise<{ valid: boolean; invalidIds: string[] }> {
  console.log(`[validateAllServicesExist] Validando ${serviceIds.length} serviços...`);
  
  // IDs dos dados mock conhecidos - TEMPORÁRIO até inserir serviços reais
  const knownMockIds = [
    '123e4567-e89b-12d3-a456-426614174000',
    '123e4567-e89b-12d3-a456-426614174001',
    '123e4567-e89b-12d3-a456-426614174002',
    '123e4567-e89b-12d3-a456-426614174003',
    '123e4567-e89b-12d3-a456-426614174004',
    '123e4567-e89b-12d3-a456-426614174005',
    '123e4567-e89b-12d3-a456-426614174006',
    '123e4567-e89b-12d3-a456-426614174007'
  ];
  
  const invalidIds: string[] = [];
  
  for (const serviceId of serviceIds) {
    // Primeiro verificar se é um ID mock conhecido
    if (knownMockIds.includes(serviceId)) {
      console.log(`[validateAllServicesExist] ID mock conhecido aceito: ${serviceId}`);
      continue;
    }
    
    // Se não for mock, validar no banco
    const exists = await validateServiceExists(serviceId);
    if (!exists) {
      invalidIds.push(serviceId);
    }
  }
  
  const valid = invalidIds.length === 0;
  console.log(`[validateAllServicesExist] Resultado: ${valid ? 'todos válidos' : `${invalidIds.length} inválidos`}`, { invalidIds });
  
  return { valid, invalidIds };
}