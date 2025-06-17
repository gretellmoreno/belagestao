import { supabase } from './supabaseClient';
import type { Client } from './clientService';
import type { Professional } from './professionalService';
import { format } from 'date-fns';

// Interface para dados de serviço no agendamento
export interface AppointmentServiceData {
  service_id: string;
  professional_id?: string | number; // Este campo não existe na tabela appointment_services - não usar no insert()
  custom_price?: number;            // Valor cobrado por esse serviço neste agendamento específico
  custom_time?: number;             // Tempo personalizado do serviço (em minutos)
  created_at?: string;              // Pode ser automático, ou usar new Date().toISOString()
  net_service_value?: number;       // Valor líquido (ex: após taxa de pagamento)
  payment_fee?: number;             // Valor da taxa de pagamento aplicada a esse serviço
  salon_profit?: number;            // Lucro líquido do salão (após comissões e taxas)
  discount_payment_fee?: boolean;   // true se a taxa de pagamento for descontada do profissional
  commission_rate?: number;         // Porcentagem de comissão do serviço (ex: 40 para 40%)
  payment_method_id?: string;       // ID do método de pagamento utilizado para este serviço
  
  // Campos legados (não mais usados)
  original_price?: number;          // @deprecated - Use custom_price
  final_price?: number;             // @deprecated - Não usar mais
  service_value?: number;           // @deprecated - Use custom_price
}

// Interface para dados de produto no agendamento
export interface AppointmentProductData {
  product_id: string;
  quantity: number;
  price?: number;
  product?: { id: string; name: string; price: number };
}

// Interface para dados de venda no agendamento
export interface AppointmentSaleData {
  payment_method_id: string | number;
  subtotal: number;
  fee?: number;
  total: number;
  created_at?: string;
  status?: string;
  source?: string;
}

// Interface para dados de método de pagamento
export interface Payment {
  id: number;
  amount: number;
  method: string;
  status: string;
}

// Interface para dados de agendamento
/**
 * IMPORTANTE:
 * - Campos que começam com _ (ex: _selectedServices) são considerados temporários e
 *   devem ser usados APENAS no frontend. Eles nunca devem ser enviados ao banco de dados.
 * - Estes campos são removidos automaticamente antes do envio ao Supabase.
 * - Para adicionar novos campos temporários, sempre use o prefixo _ para indicar que
 *   são propriedades auxiliares que não existem na tabela appointments.
 */
export interface Appointment {
  id: string;
  client_id: string | null;  // Permite valor null para agendamentos anônimos
  professional_id: string;
  date: string;
  status: string;
  created_at: string;
  updated_at: string;
  client?: Client;
  professional?: Professional;
  payment?: Payment;
  payment_method_id?: string;     // ID do método de pagamento do agendamento (depreciado - usar o campo nos serviços individuais)
  custom_times?: Record<string, number>;
  products_data_json?: ProductData[];
  services_relations?: AppointmentServiceData[];
  appointment_services?: Array<{
    service_id: string;
    custom_price?: number;
    custom_time?: number;
    payment_method_id?: string;
    net_service_value?: number;
    payment_fee?: number;
    salon_profit?: number;
    discount_payment_fee?: boolean;
    service?: {
      id: string;
      name: string;
      price?: number;
      estimated_time?: number;
    };
  }>;
  sales_data_json?: any;
  time?: string;
  notes?: string;
  services?: any[];
  services_data?: any[];
  services_total_value?: number;
  services_data_json?: ServiceData[]; // @deprecated - Este campo não existe mais na tabela appointments
}

export interface ServiceData {
  id: number;
  name: string;
  price: number;
  estimated_time: number;  // Renomeado de duration para estimated_time
  description?: string;
}

export interface ProductData {
  id: number;
  name: string;
  quantity: number;
  price: number;
}

// Variável para armazenar o nome correto da tabela
const APPOINTMENTS_TABLE = 'appointments';
const APPOINTMENT_SERVICES_TABLE = 'appointment_services';

export async function getAppointments() {
  try {
    console.log('Carregando todos os agendamentos...');
    
    // Buscar agendamentos com dados relacionados necessários
    const { data, error: fetchError } = await supabase
      .from(APPOINTMENTS_TABLE)
      .select(`
        *,
        professional:professional_id(id,name),
        client:client_id(id,name,phone,email),
        appointment_services(
          service_id,
          custom_price,
          custom_time,
          service:service_id(id, name, price, estimated_time)
        )
      `)
      .order('date')
      .order('time');
    
    if (fetchError) {
      console.error('Error fetching appointments:', fetchError);
      throw new Error('Failed to get appointments');
    }
    
    console.log(`Encontrados ${data?.length || 0} agendamentos no total`);
    
    // Criar array para armazenar agendamentos processados
    const processedAppointments = [];
    
    // Definir o tipo explicitamente para evitar erros
    interface ServiceData {
      service_id: string;
      service_name: string;
      price: number;
      estimated_time: number;  // Renomeado de duration para estimated_time
      custom_time?: number;
      original_price?: number;
      final_price?: number;
    }
    
    // Processar cada agendamento individualmente para incorporar os dados dos serviços
    for (const appointment of data || []) {
      // Extrair os serviços que já vieram no select
      const appointmentServices = appointment.appointment_services || [];
      
      // Extrair e formatar os dados dos serviços
      let service_text = 'Serviço não especificado';
      const services_data: ServiceData[] = [];
      
      if (appointmentServices.length > 0) {
        // Obter o nome do primeiro serviço para o rótulo do agendamento
        if (appointmentServices[0].service && appointmentServices[0].service.name) {
          service_text = appointmentServices[0].service.name;
        }
        
        // Formatar todos os serviços para incluir no objeto de agendamento
        appointmentServices.forEach((s: { 
          service_id: string; 
          custom_time?: number; 
          custom_price?: number;
          service?: {
            id: string;
            name: string;
            price: number;
            estimated_time: number;
          }
        }) => {
          if (s.service) {
            services_data.push({
              service_id: s.service_id,
              service_name: s.service.name || 'Nome indisponível',
              price: s.service.price || 0,
              estimated_time: s.service.estimated_time || 0,
              custom_time: s.custom_time,
              original_price: s.custom_price // Usar custom_price como equivalente ao original_price
            });
          }
        });
      }
      
      // Adicionar o agendamento processado à lista
      processedAppointments.push({
        ...appointment,
        text_label: `${appointment.client?.name || 'Cliente não especificado'}\n${service_text}`,
        services_data,
        services_relations: appointmentServices,
        is_anonymous: !appointment.client_id
      });
    }
    
    return processedAppointments;
  } catch (error) {
    console.error('Error in getAppointments:', error);
    return [];
  }
}

// Função simplificada para buscar agendamentos por data sem usar operadores que podem falhar
export async function simpleGetAppointmentsByDate(dateStr: string): Promise<Appointment[]> {
  try {
    console.log(`[DEBUG] simpleGetAppointmentsByDate: Iniciando busca para data ${dateStr}`);
    
    // Garantir que a data esteja no formato YYYY-MM-DD
    let formattedDate = dateStr;
    if (dateStr.includes('T')) {
      formattedDate = dateStr.split('T')[0];
    }
    
    console.log(`[DEBUG] simpleGetAppointmentsByDate: Data formatada: ${formattedDate}`);
    
    // Buscar agendamentos para a data especificada com todos os relacionamentos necessários
    const { data, error } = await supabase
      .from(APPOINTMENTS_TABLE)
      .select(`
        id, 
        client_id, 
        professional_id, 
        date, 
        time, 
        status, 
        notes, 
        payment_method_id,
        created_at,
        updated_at,
        client:client_id(id, name, phone, email),
        professional:professional_id(id, name),
        payment_method:payment_method_id(id, name, fee),
        appointment_services(
          id,
          service_id,
          custom_price,
          custom_time,
          net_service_value,
          payment_fee,
          salon_profit,
          commission_rate,
          service:service_id(
            id, 
            name, 
            price, 
            estimated_time,
            commission_rate
          )
        )
      `)
      .eq('date', formattedDate);
    
    if (error) {
      console.error('[ERROR] simpleGetAppointmentsByDate: Erro na busca:', error);
      return [];
    }
    
    console.log(`[DEBUG] simpleGetAppointmentsByDate: Encontrados ${data?.length || 0} agendamentos`);
    
    if (!data || data.length === 0) {
      return [];
    }
    
    // Processar cada agendamento para adicionar campos virtuais necessários para a UI
    const processedAppointments = data.map(appointment => {
      // Calcular a duração total com base nos serviços
      const services = appointment.appointment_services || [];
      let totalDuration = 0;
      
      services.forEach((relation: any) => {
        // Verificar custom_time primeiro
        if (relation.custom_time && relation.custom_time > 0) {
          totalDuration += relation.custom_time;
        } 
        // Então verificar o tempo estimado do serviço
        else if (relation.service?.estimated_time && relation.service.estimated_time > 0) {
          totalDuration += relation.service.estimated_time;
        } 
        // Usar um valor padrão se nenhum tempo for encontrado
        else {
          totalDuration += 30; // Valor padrão de 30 minutos
        }
      });
      
      // Se não houver duração calculada, definir um valor padrão
      if (totalDuration === 0 && services.length > 0) {
        totalDuration = 30 * services.length;
      } else if (totalDuration === 0) {
        totalDuration = 30; // Valor padrão para agendamentos sem serviços
      }
      
      console.log(`[DEBUG] Duração total calculada: ${totalDuration} minutos`);
      
      // Garantir que services_relations esteja disponível para compatibilidade
      const services_relations = services.map((s: any) => ({
        service_id: s.service_id,
        custom_price: s.custom_price,
        custom_time: s.custom_time,
        net_service_value: s.net_service_value,
        payment_fee: s.payment_fee,
        salon_profit: s.salon_profit,
        commission_rate: s.commission_rate,
        service: s.service
      }));
      
      // Retornar objeto com campos virtuais adicionais
      return {
        ...appointment,
        services_data_json: [],
        services_relations: services_relations
      } as unknown as Appointment;
    });
    
    console.log(`[DEBUG] simpleGetAppointmentsByDate: Processamento concluído - ${processedAppointments.length} agendamentos`);
    
    return processedAppointments;
  } catch (err) {
    console.error('[ERROR] simpleGetAppointmentsByDate: Exceção:', err);
    return [];
  }
}

/**
 * Busca agendamentos de uma data específica
 */
export async function getAppointmentsByDate(
  date: string | Date,
  options: {
    professionalId?: string;
    clientId?: string;
    status?: string[];
    includeServices?: boolean;
    includePayments?: boolean;
  } = {}
): Promise<Appointment[]> {
  try {
    // Formatação da data para garantir consistência
    let dateStr = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd');
    
    // Log detalhado para debug
    console.log(`[DEBUG] Iniciando busca de agendamentos para data: ${dateStr}`);
    
    // Se for uma data inválida, retornar array vazio
    if (!dateStr || dateStr === 'Invalid Date') {
      console.error('[ERROR] Data inválida fornecida para getAppointmentsByDate:', date);
      return [];
    }
    
    // Garantir formato yyyy-MM-dd
    if (dateStr.includes('T')) {
      dateStr = dateStr.split('T')[0];
    }
    
    console.log(`[DEBUG] Data formatada: ${dateStr}`);
    
    // Montar a query considerando as opções
    let query = supabase
      .from(APPOINTMENTS_TABLE)
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
        client:client_id(id, name, phone, email),
        professional:professional_id(id, name),
        appointment_services(
          id,
          service_id,
          custom_price,
          custom_time,
          payment_method_id,
          payment_method:payment_method_id(id, name, fee),
          net_service_value,
          payment_fee,
          salon_profit,
          commission_rate,
          discount_payment_fee,
          service:service_id(
            id, 
            name, 
            price, 
            estimated_time,
            commission_rate
          )
        )
      `)
      .eq('date', dateStr)
      .order('time');  // Ordenar por hora para exibição mais consistente
      
    // Aplicar filtros adicionais se especificados
    if (options.professionalId) {
      query = query.eq('professional_id', options.professionalId);
    }
    
    if (options.clientId) {
      query = query.eq('client_id', options.clientId);
    }
    
    if (options.status && options.status.length > 0) {
      query = query.in('status', options.status);
    }
    
    console.log('[DEBUG] Executando query com os filtros aplicados');
    
    // Executar a query
    const { data, error } = await query;
    
    if (error) {
      console.error('[ERROR] Erro ao buscar agendamentos por data:', error);
      return [];
    }
    
    console.log(`[DEBUG] Encontrados ${data?.length || 0} agendamentos para a data ${dateStr}`);
    
    if (!data || data.length === 0) {
      console.log('[DEBUG] Nenhum agendamento encontrado - retornando array vazio');
      return [];
    }
    
    // Processar os agendamentos para adicionar propriedades virtuais
    const processedAppointments = data.map(appointment => {
      console.log(`[DEBUG] Processando agendamento ID: ${appointment.id}`);
      
      // Extrair e calcular duração com base nos serviços
      const services = appointment.appointment_services || [];
      let totalDuration = 0;
      
      services.forEach((relation: any) => {
        // Verificar custom_time primeiro
        if (relation.custom_time && relation.custom_time > 0) {
          totalDuration += relation.custom_time;
        } 
        // Então verificar o tempo estimado do serviço
        else if (relation.service?.estimated_time && relation.service.estimated_time > 0) {
          totalDuration += relation.service.estimated_time;
        } 
        // Usar um valor padrão se nenhum tempo for encontrado
        else {
          totalDuration += 30; // Valor padrão de 30 minutos
        }
      });
      
      // Se não houver duração calculada, definir um valor padrão
      if (totalDuration === 0 && services.length > 0) {
        totalDuration = 30 * services.length;
      } else if (totalDuration === 0) {
        totalDuration = 30; // Valor padrão para agendamentos sem serviços
      }
      
      console.log(`[DEBUG] Duração total calculada: ${totalDuration} minutos`);
      
      // Garantir que services_relations esteja disponível para compatibilidade
      const services_relations = services.map((s: any) => ({
        service_id: s.service_id,
        custom_price: s.custom_price,
        custom_time: s.custom_time,
        net_service_value: s.net_service_value,
        payment_fee: s.payment_fee,
        salon_profit: s.salon_profit,
        commission_rate: s.commission_rate,
        service: s.service
      }));
      
      // Campo virtual duration necessário para a UI
      return {
        ...appointment,
        services_data_json: [],
        services_relations: services_relations,
        // Garantir que a data esteja presente
        date: appointment.date || dateStr
      } as unknown as Appointment;
    });
    
    console.log(`[DEBUG] Processamento concluído. Retornando ${processedAppointments.length} agendamentos.`);
    
    return processedAppointments;
  } catch (error) {
    console.error('[ERROR] Exceção capturada em getAppointmentsByDate:', error);
    return [];
  }
}

/**
 * Obtém a data da última visita de um cliente específico ou para todos os clientes
 * @param clientId ID opcional do cliente para buscar apenas a última visita de um cliente específico
 * @returns Um objeto com os IDs dos clientes e suas respectivas últimas datas de visita, ou null se não houver visitas
 */
export async function getLastClientVisits(clientId?: string): Promise<Record<string, string | null>> {
  try {
    console.log(`[DEBUG] Buscando última visita ${clientId ? 'para cliente ' + clientId : 'para todos os clientes'}`);
    
    let query = supabase
      .from(APPOINTMENTS_TABLE)
      .select(`
        id,
        client_id,
        date,
        status
      `)
      .not('client_id', 'is', null)
      .in('status', ['concluído', 'confirmado', 'finalizado'])
      .order('date', { ascending: false });
    
    // Se um ID de cliente específico for fornecido, filtrar apenas por ele
    if (clientId) {
      query = query.eq('client_id', clientId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('[ERROR] Erro ao buscar últimas visitas dos clientes:', error);
      return {};
    }
    
    console.log(`[DEBUG] Encontradas ${data?.length || 0} visitas`);
    
    // Objeto para armazenar a última visita de cada cliente
    const lastVisits: Record<string, string | null> = {};
    
    // Processar os resultados para obter a última visita por cliente
    if (data && data.length > 0) {
      data.forEach(appointment => {
        if (appointment.client_id) {
          // Usar apenas a data do agendamento
          const visitDate = appointment.date;
          if (visitDate) {
            // Verificar se esta data é mais recente do que a última registrada para este cliente
            if (!lastVisits[appointment.client_id] || 
                new Date(visitDate) > new Date(lastVisits[appointment.client_id] || '')) {
              lastVisits[appointment.client_id] = visitDate;
            }
          }
        }
      });
    }
    
    return lastVisits;
  } catch (error) {
    console.error('[ERROR] Exceção capturada em getLastClientVisits:', error);
    return {};
  }
}

// Função para filtrar e sanitizar arrays de serviços ou produtos
function sanitizeDataArray(dataArray: any[]): any[] {
  if (!Array.isArray(dataArray)) return [];
  
  return dataArray.filter(item => {
    // Para serviços, verificar service_id
    if (item && item.service_id) {
      return typeof item.service_id === 'string' && item.service_id.trim() !== '';
    }
    
    // Para produtos, verificar product_id
    if (item && item.product_id) {
      return typeof item.product_id === 'string' && item.product_id.trim() !== '';
    }
    
    // Se não tem nenhum dos IDs, remover
    return false;
  });
}

// Função utilitária para garantir que um payload está limpo antes de enviar ao Supabase
export function sanitizePayloadForSupabase(payload: any): any {
  try {
    console.log('Sanitizando payload para envio ao Supabase');
    
    // Criar uma cópia do payload para evitar mutações indesejadas
    const sanitizedPayload = { ...payload };
    
    // Remover campos que não existem mais no banco
    if ('custom_prices' in sanitizedPayload) {
      console.warn('Campo obsoleto custom_prices detectado e removido do payload na sanitização');
      delete sanitizedPayload.custom_prices;
    }
    
    // Remover o campo duration que foi removido da tabela appointments
    if ('duration' in sanitizedPayload) {
      console.warn('Campo duration removido do payload na sanitização - esse campo não existe mais na tabela appointments');
      delete sanitizedPayload.duration;
    }
    
    // Remover services_data_json que foi removido da tabela appointments
    if ('services_data_json' in sanitizedPayload) {
      console.warn('Campo services_data_json removido do payload na sanitização - esse campo não existe mais na tabela appointments');
      delete sanitizedPayload.services_data_json;
    }
    
    // Remover _selectedServices que não existe na tabela appointments
    if ('_selectedServices' in sanitizedPayload) {
      console.warn('Campo _selectedServices removido do payload na sanitização - esse campo não existe na tabela appointments');
      delete sanitizedPayload._selectedServices;
    }
    
    // GARANTIA EXTRA: Remover TODOS os campos que começam com _ (campos temporários)
    Object.keys(sanitizedPayload).forEach(key => {
      if (key.startsWith('_')) {
        console.warn(`Campo temporário ${key} removido do payload na sanitização - não existe na tabela do banco de dados`);
        delete sanitizedPayload[key];
      }
    });
    
    // Lista de campos conhecidos que são UUID e precisam ser null em vez de string vazia
    const uuidFields = [
      'client_id', 
      'professional_id', 
      'service_id',
      'appointment_id'
    ];
    
    // Converter strings vazias para null em campos UUID
    for (const field of uuidFields) {
      if (field in sanitizedPayload && sanitizedPayload[field] === '') {
        console.log(`Convertendo string vazia para null no campo UUID: ${field}`);
        sanitizedPayload[field] = null;
      }
    }
    
    // Lista de campos conhecidos que são JSONB
    const jsonbFields = [
      'products_data_json',
      'custom_times',
      'notes',
      'sales_data_json'
    ];
    
    // Verificar campos especiais (objetos que precisam ser convertidos para string JSON)
    for (const field of jsonbFields) {
      if (sanitizedPayload[field] && typeof sanitizedPayload[field] === 'object' && !Array.isArray(sanitizedPayload[field])) {
        sanitizedPayload[field] = JSON.stringify(sanitizedPayload[field]);
      }
    }
    
    // Sanitizar arrays de services_data e products_data se existirem
    if (sanitizedPayload.services_data) {
      sanitizedPayload.services_data = sanitizeDataArray(sanitizedPayload.services_data);
      console.log(`Sanitizados ${payload.services_data?.length || 0} serviços para ${sanitizedPayload.services_data.length}`);
    }
    
    return sanitizedPayload;
  } catch (error) {
    console.error('Erro ao sanitizar payload:', error);
    // Retornar payload original em caso de erro
    return payload;
  }
}

/**
 * Função para filtrar apenas os campos válidos para uma tabela específica
 * Evita enviar campos que não existem no banco de dados
 */
function pickValidFields(data: Record<string, any>, validFields: string[]): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const field of validFields) {
    if (data[field] !== undefined && data[field] !== null) {
      result[field] = data[field];
    }
  }
  
  return result;
}

/**
 * Cria um novo agendamento no banco de dados
 * 
 * ATENÇÃO: Para garantir que os serviços sejam salvos corretamente na tabela 
 * appointment_services, é OBRIGATÓRIO fornecer _selectedServices ou _serviceIds.
 * 
 * Exemplo de uso:
 * ```typescript
 * // Criar agendamento com serviços usando _selectedServices (recomendado)
 * const novoAgendamento = await createAppointment({
 *   client_id: "uuid-do-cliente",
 *   professional_id: "uuid-do-profissional",
 *   date: "2023-09-20",
 *   time: "14:30",
 *   notes: "Observação opcional",
 *   status: "agendado",
 *   _selectedServices: [
 *     {
 *       id: "uuid-do-servico-1",
 *       custom_price: 150,
 *       custom_time: 60,
 *       payment_method_id: "uuid-do-metodo-pagamento" // Opcional
 *     },
 *     {
 *       id: "uuid-do-servico-2", 
 *       custom_price: 200
 *     }
 *   ]
 * });
 * ```
 */
export async function createAppointment(appointment: Partial<Appointment> & {
  _serviceIds?: string[];
  _customTimes?: Record<string, number>;
  _customPrices?: Record<string, number>;
  _selectedServices?: Array<{
    id?: string;
    service_id: string; // Agora service_id é obrigatório
    custom_price?: number;
    custom_time?: number;
    payment_method_id?: string;
    created_at?: string;
  }>;
}): Promise<Appointment> {
  try {
    console.log('[createAppointment] Iniciando criação de agendamento:', appointment);
    
    // Remover campos que não devem ir para a tabela appointments
    const { _selectedServices, payment_method_id, ...appointmentData } = appointment;
    
    console.log('[createAppointment] Dados do agendamento após remoção de campos especiais:', appointmentData);
    
    // Validar se temos serviços válidos
    if (_selectedServices && _selectedServices.length > 0) {
      const servicosValidos = _selectedServices.filter(s => !!s.service_id);
      if (servicosValidos.length === 0) {
        console.error('[ERRO CRÍTICO] Tentativa de criar agendamento sem serviços válidos.');
        throw new Error('Não é possível criar um agendamento sem serviços válidos. Todos os serviços devem ter service_id definido.');
      }
    }
    
    // Criar o agendamento
    const { data: newAppointment, error: appointmentError } = await supabase
      .from('appointments')
      .insert([appointmentData])
      .select(`
        id,
        client_id,
        professional_id,
        date,
        time,
        notes,
        status,
        created_at,
        updated_at
      `)
      .maybeSingle(); // Usar maybeSingle() para evitar erro PGRST116
    
    if (appointmentError) {
      console.error('[createAppointment] Erro ao criar agendamento:', appointmentError);
      throw appointmentError;
    }
    
    console.log('[createAppointment] Agendamento criado com sucesso:', newAppointment);
    
    // Se temos serviços selecionados, vamos inseri-los
    if (_selectedServices && _selectedServices.length > 0 && newAppointment) {
      console.log('[createAppointment] Preparando para inserir serviços:', _selectedServices);
      
      // Preparar os serviços para inserção
      const servicesToInsert = _selectedServices.map(service => ({
        appointment_id: newAppointment.id,
        service_id: service.service_id,
        custom_price: service.custom_price,
        custom_time: service.custom_time,
        created_at: service.created_at || new Date().toISOString()
      }));
      
      console.log('[createAppointment] Serviços preparados para inserção:', servicesToInsert);
      
      // Inserir os serviços
      const { error: servicesError } = await supabase
        .from('appointment_services')
        .insert(servicesToInsert);
        
      if (servicesError) {
        console.error('[createAppointment] Erro ao inserir serviços:', servicesError);
        // Não vamos lançar o erro aqui para não reverter a criação do agendamento
        // mas vamos notificar no console para debugging
      } else {
        console.log('[createAppointment] Serviços inseridos com sucesso');
      }
    }
    
    // Buscar o agendamento completo com os serviços para retornar
    if (!newAppointment) {
      throw new Error('Agendamento não foi criado corretamente');
    }
    
    const { data: completeAppointment, error: fetchError } = await supabase
      .from('appointments')
      .select(`
        id,
        client_id,
        professional_id,
        date,
        time,
        notes,
        status,
        created_at,
        updated_at,
        client:client_id(id, name, email, phone),
        professional:professional_id(id, name),
        appointment_services(
          service_id,
          custom_price,
          custom_time,
          service:service_id(id, name, price, estimated_time)
        )
      `)
      .eq('id', newAppointment.id)
      .maybeSingle(); // Usar maybeSingle() para evitar erro PGRST116
    
    if (fetchError) {
      console.error('Erro ao buscar agendamento completo:', fetchError);
      return newAppointment as Appointment;
    }
    
    if (!completeAppointment) {
      console.warn('Agendamento não encontrado após criação, retornando dados básicos');
      return newAppointment as Appointment;
    }
    
    console.log('[createAppointment] Agendamento completo recuperado:', completeAppointment);
    
    return completeAppointment as unknown as Appointment;
  } catch (error) {
    console.error('[createAppointment] Erro durante a criação do agendamento:', error);
    throw error;
  }
}

// Nova função auxiliar para buscar um agendamento com todas as suas relações
async function getAppointmentWithRelations(appointmentId: string): Promise<Appointment> {
  try {
    // Passo 1: Buscar o agendamento base
    const { data: appointmentData, error: appointmentError } = await supabase
      .from(APPOINTMENTS_TABLE)
      .select('*')
      .eq('id', appointmentId)
      .single();
    
    if (appointmentError) {
      throw new Error('Erro ao buscar agendamento: ' + appointmentError.message);
    }
    
    // Passo 2: Buscar serviços relacionados na tabela appointment_services
    const { data: servicesRelations, error: servicesError } = await supabase
      .from(APPOINTMENT_SERVICES_TABLE)
      .select('*, service:service_id(*)')
      .eq('appointment_id', appointmentId);
    
    if (servicesError) {
      console.error('Erro ao buscar serviços do agendamento:', servicesError);
    }
    
    // Extrair apenas os IDs dos serviços para compatibilidade com a interface antiga
    const serviceIds = servicesRelations ? servicesRelations.map(relation => relation.service_id) : [];
    
    // Passo 3: Buscar cliente e profissional
    let clientData = null;
    if (appointmentData.client_id) {
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id, name')
        .eq('id', appointmentData.client_id)
        .maybeSingle(); // Usar maybeSingle() para evitar erro PGRST116
      
      if (clientError) {
        console.error('Erro ao buscar cliente:', clientError);
      } else {
        clientData = client;
      }
    }
    
    let professionalData = null;
    if (appointmentData.professional_id) {
      const { data: professional, error: professionalError } = await supabase
        .from('professionals')
        .select('id, name')
        .eq('id', appointmentData.professional_id)
        .maybeSingle(); // Usar maybeSingle() para evitar erro PGRST116
      
      if (professionalError) {
        console.error('Erro ao buscar profissional:', professionalError);
      } else {
        professionalData = professional;
      }
    }
    
    // Montar o objeto de agendamento completo
    const result: Appointment = {
      // Definir os campos obrigatórios para garantir a compatibilidade
      id: appointmentData.id,
      professional_id: appointmentData.professional_id,
      date: appointmentData.date,
      
      // Incluir todos os dados do agendamento
      ...appointmentData,
      
      // Adicionar dados relacionados
      client: clientData,
      professional: professionalData,
      services_relations: servicesRelations || []
    } as Appointment;
    
    console.log('Agendamento completo recuperado:', result);
    
    return result;
  } catch (error) {
    console.error('Erro ao buscar agendamento com relações:', error);
    throw error;
  }
}

/**
 * Atualiza um agendamento existente
 */
export async function updateAppointment(
  id: string,
  appointmentData: Partial<Appointment> & {
    _serviceIds?: string[];
    _customPrices?: Record<string, number>;
    _customTimes?: Record<string, number>;
    /**
     * IMPORTANTE: Esta propriedade é usada APENAS no frontend para construir os registros da tabela appointment_services.
     * Ela NÃO deve ser enviada diretamente para o banco de dados.
     * Ela será removida do payload antes de enviar para a tabela appointments.
     */
    _selectedServices?: Array<{
      id: string;
      professional_id?: string;
      custom_price?: number;
      custom_time?: number;
      net_service_value?: number;
      payment_fee?: number;
      salon_profit?: number;
      discount_payment_fee?: boolean;
      commission_rate?: number;
      payment_method_id?: string;   // ID do método de pagamento utilizado para este serviço
      // Campos antigos mantidos para compatibilidade temporária
      original_price?: number;     // @deprecated - Use custom_price
      final_price?: number;        // @deprecated
      service_value?: number;      // @deprecated - Use custom_price
    }>;
  }
): Promise<Appointment | null> {
  try {
    console.log('Atualizando agendamento com ID:', id, 'Dados:', appointmentData);
    
    // Extrair _serviceIds e _selectedServices para atualizar os serviços na tabela appointment_services
    const { _serviceIds, _selectedServices, _customPrices, _customTimes } = appointmentData;
    
    // Log para depuração
    console.log('Dados de serviços recebidos para atualização:', {
      _serviceIds,
      _selectedServices,
      _customPrices,
      _customTimes
    });
    
    // Remover campos que não deveriam ser enviados diretamente
    const {
      created_at,
      updated_at,
      client,
      professional,
      payment,
      // Remover duration explicitamente
      duration,
      services_total_value,
      net_service_value,
      payment_fee,
      salon_profit,
      discount_payment_fee,
      ...cleanPayload
    } = appointmentData as any;

    // Mapear produtos e serviços do formato novo para o antigo, se necessário
    if (appointmentData.services_data_json && !cleanPayload.services_data) {
      cleanPayload.services_data = appointmentData.services_data_json;
    }
    
    // Remover explicitamente o campo custom_prices que não existe mais no banco
    if ('custom_prices' in cleanPayload) {
      console.warn('Campo obsoleto custom_prices detectado e será removido do payload');
      delete cleanPayload.custom_prices;
    }
    
    // Remover explicitamente o campo services que não existe mais no banco
    if ('services' in cleanPayload) {
      console.warn('Campo obsoleto services detectado e será removido do payload');
      delete cleanPayload.services;
    }
    
    // Remover explicitamente o campo services_complete_update que não existe no banco
    if ('services_complete_update' in cleanPayload) {
      console.warn('Campo obsoleto services_complete_update detectado e será removido do payload');
      delete cleanPayload.services_complete_update;
    }
    
    // Limpar o objeto, removendo campos undefined e null
    const cleanedPayload = Object.fromEntries(
      Object.entries(cleanPayload)
        .filter(([_, value]) => value !== undefined && value !== null)
    );
    
    // Sanitizar o payload
    const finalPayload = sanitizePayloadForSupabase(cleanedPayload);
    
    // Registrar payload final após sanitização
    console.log('Payload final para atualização:', finalPayload);
    
    // Verificar se existe algum campo com _ no payload final, que não deveria estar presente
    Object.keys(finalPayload).forEach(key => {
      if (key.startsWith('_')) {
        console.error(`ALERTA: Campo temporário ${key} ainda presente no payload após sanitização. Removendo manualmente.`);
        delete finalPayload[key];
      }
    });
    
    // Executar a atualização
    const { data, error } = await supabase
      .from(APPOINTMENTS_TABLE)
      .update(finalPayload)
      .eq('id', id)
      .select('*, client:client_id(*), professional:professional_id(*)')
      .maybeSingle(); // Usar maybeSingle() para evitar erro PGRST116
    
    if (error) {
      console.error('Erro ao atualizar agendamento:', error);
      throw new Error(`Falha ao atualizar agendamento: ${error.message}`);
    }
    
    if (!data) {
      throw new Error('Agendamento não encontrado ou nenhum dado retornado após atualização');
    }
    
    console.log('Agendamento atualizado com sucesso:', data);
    
    // Preparar para atualizar serviços
    try {
      // Verificar se estamos finalizando um atendimento 
      const isBeingFinalized = cleanPayload.status === 'finalizado';
      
      // Só remover serviços existentes se estamos realmente alterando a lista de serviços
      // e não estamos finalizando o atendimento
      if ((_serviceIds || _selectedServices) && !isBeingFinalized) {
        console.log(`Removendo serviços existentes do agendamento ${id}`);
        const { data: deletedServices, error: deleteError } = await supabase
          .from('appointment_services')
          .delete()
          .eq('appointment_id', id)
          .select();
          
        if (deleteError) {
          console.error('Erro ao remover serviços antigos:', deleteError);
        } else {
          console.log(`Removidos ${deletedServices?.length || 0} serviços antigos do agendamento ${id}`);
        }
      } else {
        console.log(`Mantendo serviços existentes do agendamento ${id} - não há necessidade de recriá-los`);
      }
      
      // Se _selectedServices estiver presente, usar esses dados para adicionar os novos serviços
      if (_selectedServices && _selectedServices.length > 0 && !isBeingFinalized) {
        console.log(`Adicionando ${_selectedServices.length} serviços específicos ao agendamento ${id}`);
        
        // Extrair os service_ids dos serviços selecionados usando o campo 'id' da interface
        const selectedServiceIds = _selectedServices
          .map(service => service.id)
          .filter(id => id && typeof id === 'string');
        
        // Adicionar serviços um por um para melhor tratamento de erros
        for (const serviceId of selectedServiceIds) {
          try {
            console.log(`[updateAppointment] Processando serviço ${serviceId}`);
            
            // Encontrar o serviço correspondente nos dados selecionados
            const selectedService = _selectedServices.find(s => s.id === serviceId);
            
            const newServiceData = {
              appointment_id: id,
              service_id: serviceId,
              custom_time: selectedService?.custom_time,
              custom_price: selectedService?.custom_price || 0,
              created_at: new Date().toISOString()
            };
            
            console.log(`Inserindo serviço ${serviceId} com dados:`, newServiceData);
            
            const { data: insertedService, error: insertError } = await insertServicesSafely([newServiceData]);
              
            if (insertError) {
              console.error(`Erro ao adicionar serviço ${serviceId} ao agendamento ${id}:`, insertError);
            } else {
              console.log(`Serviço ${serviceId} adicionado com sucesso na atualização:`, insertedService);
            }
          } catch (serviceError) {
            console.error(`Erro ao processar serviço ${serviceId}:`, serviceError);
          }
        }
      }
      // Se apenas _serviceIds estiver presente, atualizar usando esses IDs
      else if (_serviceIds && _serviceIds.length > 0) {
        console.log(`Adicionando ${_serviceIds.length} serviços baseados em IDs ao agendamento ${id}`);
        
        // Adicionar serviços um por um para melhor tratamento de erros
        for (const serviceId of _serviceIds) {
          try {
            console.log(`[updateAppointment] Processando serviço ${serviceId}`);
            
            const customTime = _customTimes?.[serviceId];
            const customPrice = _customPrices?.[serviceId];
            
            const newServiceData = {
              appointment_id: id,
              service_id: serviceId,
              custom_time: customTime,
              custom_price: customPrice || 0, // Usar 0 como fallback se não tiver preço personalizado
              created_at: new Date().toISOString()
            };
            
            console.log(`Inserindo serviço ${serviceId} com dados:`, newServiceData);
            
            const { data: insertedService, error: insertError } = await insertServicesSafely([newServiceData]);
              
            if (insertError) {
              console.error(`Erro ao adicionar serviço ${serviceId} ao agendamento ${id}:`, insertError);
            } else {
              console.log(`Serviço ${serviceId} adicionado com sucesso na atualização:`, insertedService);
            }
          } catch (serviceError) {
            console.error(`Erro ao processar serviço ${serviceId}:`, serviceError);
          }
        }
      } else {
        console.warn(`Nenhum serviço especificado para o agendamento ${id} na atualização`);
      }
    } catch (serviceError) {
      console.error('Erro ao atualizar serviços do agendamento:', serviceError);
    }
    
    // Buscar o agendamento atualizado com seus serviços para retornar
    try {
      console.log(`Buscando agendamento ${id} atualizado com seus serviços`);
      
      // Buscar serviços relacionados
      const { data: services, error: servicesError } = await supabase
        .from('appointment_services')
        .select('*, service:service_id(*)')
        .eq('appointment_id', id);
        
      if (servicesError) {
        console.error('Erro ao buscar serviços do agendamento após atualização:', servicesError);
      } else {
        console.log(`Encontrados ${services?.length || 0} serviços para o agendamento ${id}`);
      }
      
      // Adicionar serviços ao objeto de retorno sem incluir a propriedade duration
      const updatedAppointment = {
        ...data,
        services_relations: services || []
      };
      
      return updatedAppointment;
    } catch (fetchError) {
      console.error('Erro ao buscar dados atualizados do agendamento:', fetchError);
      return data; // Retornar dados sem serviços em caso de erro
    }
  } catch (error) {
    console.error('Erro ao atualizar agendamento:', error);
    throw error;
  }
}

export async function deleteAppointment(id: string) {
  const { error } = await supabase
    .from(APPOINTMENTS_TABLE)
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting appointment:', error);
    throw new Error('Failed to delete appointment');
  }
  
  return true;
}

// Função auxiliar para converter nomes de serviços para IDs
export async function convertServiceNamesToIds(serviceNames: string[]): Promise<string[]> {
  if (!serviceNames || serviceNames.length === 0) {
    console.warn('[convertServiceNamesToIds] Array de nomes vazio ou inválido');
    return [];
  }
  
  try {
    console.log('[convertServiceNamesToIds] Convertendo nomes de serviços para IDs:', serviceNames);
    
    // Buscar todos os serviços para fazer o mapeamento
    const { data, error } = await supabase
      .from('services')
      .select('id, name')
      .in('name', serviceNames);
      
    if (error) {
      console.error('[convertServiceNamesToIds] Erro ao buscar serviços pelo nome:', error);
      return [];
    }
    
    if (!data || data.length === 0) {
      console.error('[convertServiceNamesToIds] Nenhum serviço encontrado com os nomes fornecidos');
      return [];
    }
    
    // Mapear os nomes para IDs com validação rigorosa
    const serviceIds = serviceNames
      .map(name => {
      const service = data.find(s => s.name === name);
        if (!service) {
          console.warn(`[convertServiceNamesToIds] Serviço não encontrado pelo nome: ${name}`);
          return null;
      }
        if (!service.id || typeof service.id !== 'string') {
          console.error(`[convertServiceNamesToIds] ID inválido para o serviço ${name}:`, service.id);
      return null;
        }
        return service.id;
      })
      .filter((id): id is string => {
        const isValid = id !== null && typeof id === 'string' && id.trim() !== '';
        if (!isValid) {
          console.warn('[convertServiceNamesToIds] ID inválido removido:', id);
        }
        return isValid;
      });
    
    console.log('[convertServiceNamesToIds] IDs de serviços encontrados:', serviceIds);
    
    if (serviceIds.length === 0) {
      console.error('[convertServiceNamesToIds] Nenhum ID válido encontrado após conversão');
    } else if (serviceIds.length < serviceNames.length) {
      console.warn(`[convertServiceNamesToIds] Alguns serviços não foram encontrados: ${serviceNames.length} nomes, ${serviceIds.length} IDs válidos`);
    }
    
    return serviceIds;
  } catch (e) {
    console.error('[convertServiceNamesToIds] Erro ao converter nomes de serviços para IDs:', e);
    return [];
  }
}

// Função para mapear preços/tempos personalizados de nomes para IDs
export async function mapCustomValuesToIds(
  customValues: Record<string, number>, 
  serviceNames: string[]
): Promise<Record<string, number>> {
  if (!customValues || Object.keys(customValues).length === 0 || !serviceNames || serviceNames.length === 0) {
    console.log('Não há valores personalizados para mapear ou nomes de serviços para converter', { customValues, serviceNames });
    return {};
  }
  
  try {
    console.log('Mapeando valores personalizados:', { customValues, serviceNames });
    
    // Buscar serviços pelo nome para obter os IDs
    const { data, error } = await supabase
      .from('services')
      .select('id, name')
      .in('name', serviceNames);
      
    if (error || !data || data.length === 0) {
      console.error('Erro ao mapear valores personalizados:', error);
      return {};
    }
    
    console.log('Serviços encontrados:', data);
    
    // Criar um mapa de nome para ID
    const result: Record<string, number> = {};
    
    // Para cada chave no objeto de valores personalizados (que são nomes)
    Object.keys(customValues).forEach(serviceName => {
      // Encontrar o serviço correspondente
      const service = data.find(s => s.name === serviceName);
      if (service && service.id) {
        // Adicionar ao resultado usando o ID como chave
        result[service.id] = customValues[serviceName];
        console.log(`Mapeado: ${serviceName} (${service.id}) = ${customValues[serviceName]}`);
      } else {
        console.warn(`Serviço não encontrado para o nome: ${serviceName}`);
      }
    });
    
    console.log('Resultado final do mapeamento:', result);
    return result;
  } catch (e) {
    console.error('Erro ao mapear valores personalizados:', e);
    return {};
  }
}

// Novas funções auxiliares para trabalhar com os dados JSONB

/**
 * Adiciona um serviço a um agendamento existente
 */
export async function addServiceToAppointment(
  appointmentId: string,
  serviceData: AppointmentServiceData
): Promise<boolean> {
  try {
    if (!appointmentId || !serviceData.service_id) {
      console.error('ID do agendamento e service_id são obrigatórios');
      return false;
    }
    
    console.log(`Adicionando serviço ${serviceData.service_id} ao agendamento ${appointmentId}`);
    
    // Inserir o serviço com tempo personalizado ou estimado
    const { data: insertedService, error: insertError } = await supabase
      .from(APPOINTMENT_SERVICES_TABLE)
      .insert({
        appointment_id: appointmentId,
        service_id: serviceData.service_id,
        custom_price: serviceData.custom_price,
        custom_time: serviceData.custom_time,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('Erro ao adicionar serviço:', insertError);
      return false;
    }
    
    console.log(`Serviço ${serviceData.service_id} adicionado com sucesso ao agendamento ${appointmentId}:`, insertedService);
    return true;
  } catch (error) {
    console.error('Erro ao adicionar serviço ao agendamento:', error);
    return false;
  }
}

/**
 * Adiciona um produto a um agendamento existente
 */
export async function addProductToAppointment(
  appointmentId: string,
  productData: AppointmentProductData
): Promise<boolean> {
  try {
    console.log("Esta função foi removida. Produtos agora são gerenciados pela tabela product_sales.");
    // Código atualizado para inserir na nova tabela product_sales
    const { error } = await supabase
      .from('product_sales')
      .insert({
        appointment_id: appointmentId,
        // Remover product_id e usar apenas product_name
        product_name: productData.product?.name || "Produto sem nome",
        quantity: productData.quantity,
        unit_price: productData.price,
        gross_total: productData.price ? productData.price * productData.quantity : 0,
        sale_date: new Date().toISOString().split('T')[0]
      });
      
    if (error) {
      console.error('Erro ao adicionar venda de produto:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Erro ao adicionar produto ao agendamento:', error);
    return false;
  }
}

/**
 * Adiciona uma venda a um agendamento existente
 */
export async function addSaleToAppointment(
  appointmentId: string,
  saleData: AppointmentSaleData
): Promise<boolean> {
  try {
    // Obter vendas atuais
    const { data: appointment, error: fetchError } = await supabase
      .from(APPOINTMENTS_TABLE)
      .select('sales_data')
      .eq('id', appointmentId)
      .single();
      
    if (fetchError || !appointment) {
      console.error('Erro ao buscar agendamento:', fetchError);
      return false;
    }
    
    // Preparar array de vendas
    const currentSales = Array.isArray(appointment.sales_data) 
      ? appointment.sales_data 
      : [];
      
    // Adicionar nova venda
    const updatedSales = [...currentSales, saleData];
    
    // Atualizar no banco
    const { error: updateError } = await supabase
      .from(APPOINTMENTS_TABLE)
      .update({ sales_data: updatedSales })
      .eq('id', appointmentId);
      
    if (updateError) {
      console.error('Erro ao adicionar venda:', updateError);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Erro ao adicionar venda ao agendamento:', error);
    return false;
  }
}

/**
 * Sanitiza um objeto de agendamento para remover campos problemáticos
 */
export function sanitizeAppointment(appointment: Appointment): Appointment {
  const { 
    id, 
    client_id, 
    professional_id, 
    date, 
    time,
    status,
    services_data_json,
    notes,
    services,
    services_relations,
    services_data,
    custom_times,
    services_total_value,
    sales_data_json
  } = appointment;

  // Campos válidos para retornar (payment_method_id e net_value removidos)
  return {
    id,
    client_id,
    professional_id,
    date,
    time,
    status,
    services_data_json,
    notes,
    services,
    services_relations,
    services_data,
    custom_times,
    services_total_value,
    sales_data_json,
    created_at: appointment.created_at,
    updated_at: appointment.updated_at,
    client: appointment.client,
    professional: appointment.professional,
    payment: appointment.payment
  };
}

/**
 * Busca um serviço pelo ID no banco de dados
 * @param serviceId O ID do serviço a ser buscado
 * @returns Dados do serviço ou null se não encontrar
 */
export async function getServiceById(serviceId: string): Promise<any> {
  try {
    // Verificar se o ID é válido
    if (!serviceId || typeof serviceId !== 'string') {
      console.warn('[getServiceById] ID de serviço inválido:', serviceId);
      return null;
    }

    // Verificar se é um UUID válido usando regex simples
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(serviceId)) {
      console.warn('[getServiceById] ID de serviço não é um UUID válido:', serviceId);
      return null;
    }

    console.log(`[getServiceById] Buscando serviço com ID: ${serviceId}`);
    
    // MUDANÇA CRUCIAL: Usar select com .maybeSingle() em vez de .single() 
    // para evitar erro PGRST116 quando não encontrar o registro
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('id', serviceId)
      .maybeSingle(); // Usa maybeSingle() para não dar erro quando não encontrar
      
    if (error) {
      console.error(`[getServiceById] Erro ao buscar serviço com ID ${serviceId}:`, error);
      return null; // Retorna null em vez de lançar erro
    }
    
    if (!data) {
      console.warn(`[getServiceById] Serviço com ID ${serviceId} não encontrado no banco`);
      return null;
    }
    
    console.log(`[getServiceById] Serviço encontrado:`, data);
    return data;
  } catch (error) {
    console.error(`[getServiceById] Erro inesperado ao buscar serviço com ID ${serviceId}:`, error);
    return null; // Sempre retorna null em caso de erro, nunca lança exception
  }
}

/**
 * Função que finaliza um agendamento usando a RPC do Supabase
 * Atualiza status, payment_method_id e recalcula valores financeiros
 * 
 * ⚠️ IMPORTANTE: A função RPC foi ajustada para ser mais rigorosa:
 * - Se p_appointment_id não for válido, a função agora lança erro
 * - Se p_payment_method_id não for passado corretamente, os valores não serão calculados
 * - O status deve ser atualizado para 'finalizado' corretamente
 * 
 * @param appointmentId ID do agendamento a ser finalizado (deve ser UUID válido)
 * @param paymentMethodId ID do método de pagamento a ser usado (deve ser UUID válido)
 * @param discountPaymentFee Se true, a taxa de pagamento será descontada da comissão do profissional
 * @returns Dados do agendamento finalizado ou lança erro em caso de falha
 */
export async function finalizeAppointment(
  appointmentId: string,
  paymentMethodId: string,
  discountPaymentFee: boolean = false
): Promise<any> {
  try {
    console.log(`[FINALIZAÇÃO] Iniciando finalização do agendamento ${appointmentId}`);
    console.log(`[FINALIZAÇÃO] Método de pagamento: ${paymentMethodId}`);
    console.log(`[FINALIZAÇÃO] Descontar taxa: ${discountPaymentFee}`);

    // Validação rigorosa dos parâmetros obrigatórios
    if (!appointmentId || typeof appointmentId !== 'string' || appointmentId.trim() === '') {
      const errorMsg = 'ID do agendamento é obrigatório e deve ser uma string válida';
      console.error(`[FINALIZAÇÃO] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    if (!paymentMethodId || typeof paymentMethodId !== 'string' || paymentMethodId.trim() === '') {
      const errorMsg = 'ID do método de pagamento é obrigatório e deve ser uma string válida. Se não for passado corretamente, os valores não serão calculados.';
      console.error(`[FINALIZAÇÃO] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    // Validação adicional: verificar se são UUIDs válidos
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(appointmentId)) {
      const errorMsg = `ID do agendamento deve ser um UUID válido. Recebido: ${appointmentId}`;
      console.error(`[FINALIZAÇÃO] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    if (!uuidRegex.test(paymentMethodId)) {
      const errorMsg = `ID do método de pagamento deve ser um UUID válido. Recebido: ${paymentMethodId}`;
      console.error(`[FINALIZAÇÃO] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    console.log('[FINALIZAÇÃO] Validações passaram. Chamando RPC finalize_appointment...');

    // Chamar a função RPC que centraliza toda a lógica de finalização
    // FORMATO OBRIGATÓRIO conforme especificação:
    const { data, error } = await supabase.rpc('finalize_appointment', {
      payload: {
        p_appointment_id: appointmentId,
        p_payment_method_id: paymentMethodId,
        p_discount_payment_fee: discountPaymentFee
      }
    });

    if (error) {
      console.error('[FINALIZAÇÃO] Erro retornado pela RPC finalize_appointment:', error);
      console.error('[FINALIZAÇÃO] Detalhes completos do erro:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      
      // A função RPC agora lança erro se p_appointment_id não for válido
      // Propagar esse erro para o frontend
      throw new Error(`Erro ao finalizar agendamento: ${error.message || 'Erro desconhecido'}${error.details ? ` - ${error.details}` : ''}`);
    }

    console.log('[FINALIZAÇÃO] RPC executada com sucesso. Resultado:', data);

    // Buscar os dados atualizados do agendamento após a finalização
    console.log('[FINALIZAÇÃO] Buscando dados atualizados do agendamento...');
    const { data: updatedAppointment, error: fetchError } = await supabase
      .from('appointments')
      .select(`
        *,
        client:client_id(*),
        professional:professional_id(*),
        appointment_services(
          *,
          service:service_id(*),
          payment_method:payment_method_id(*)
        )
      `)
      .eq('id', appointmentId)
      .maybeSingle();

    if (fetchError) {
      console.error('[FINALIZAÇÃO] Erro ao buscar dados atualizados:', fetchError);
      throw new Error(`Erro ao buscar dados atualizados do agendamento: ${fetchError.message}`);
    }

    if (!updatedAppointment) {
      const errorMsg = 'Agendamento não encontrado após finalização. Isso pode indicar que o ID não é válido.';
      console.error(`[FINALIZAÇÃO] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    // Verificação crítica: o status deve ter sido atualizado para 'finalizado'
    if (updatedAppointment.status !== 'finalizado') {
      const errorMsg = `Status do agendamento não foi alterado para "finalizado". Status atual: ${updatedAppointment.status}`;
      console.error(`[FINALIZAÇÃO] ${errorMsg}`);
      console.error('[FINALIZAÇÃO] Isso indica que a função RPC não executou corretamente ou houve problema na validação dos parâmetros');
      throw new Error(errorMsg);
    }

    // Verificar se os serviços têm payment_method_id preenchido
    const servicesWithoutPaymentMethod = updatedAppointment.appointment_services?.filter(
      (service: any) => !service.payment_method_id
    );
    
    if (servicesWithoutPaymentMethod && servicesWithoutPaymentMethod.length > 0) {
      console.warn('[FINALIZAÇÃO] ALERTA: Alguns serviços não têm payment_method_id preenchido:', servicesWithoutPaymentMethod);
      console.warn('[FINALIZAÇÃO] Isso pode indicar que a trigger não foi executada corretamente ou que o payment_method_id não foi propagado');
    } else {
      console.log('[FINALIZAÇÃO] ✅ Todos os serviços têm payment_method_id preenchido corretamente');
    }

    console.log(`[FINALIZAÇÃO] ✅ Finalização concluída com sucesso. Status: ${updatedAppointment.status}`);

    // Disparar evento com dados completos atualizados
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('appointmentUpdated', {
        detail: {
          id: appointmentId,
          date: updatedAppointment.date,
          status: 'finalizado',
          forceRefresh: true,
          appointmentData: updatedAppointment
        }
      });
      window.dispatchEvent(event);
    }

    return updatedAppointment;
  } catch (error) {
    console.error('[FINALIZAÇÃO] Erro durante a finalização:', error);
    
    // Re-lançar o erro para que seja tratado pelo componente chamador
    // Isso é importante porque a função RPC agora lança erro para IDs inválidos
    throw error;
  }
}

/**
 * Cria um agendamento manualmente, seguindo o fluxo de dois passos:
 * 1. Cria o agendamento básico
 * 2. Insere os serviços na tabela appointment_services
 * 
 * Esta é a abordagem recomendada para garantir que os serviços sejam corretamente 
 * vinculados ao agendamento.
 * 
 * Exemplo de uso:
 * ```typescript
 * // Dados do agendamento
 * const appointmentData = {
 *   client_id: "cliente-uuid",
 *   professional_id: "profissional-uuid",
 *   date: "2023-09-15",
 *   time: "14:30",
 *   notes: "Observações do agendamento",
 *   status: "agendado"
 * };
 * 
 * // Serviços selecionados
 * const selectedServices = [
 *   {
 *     id: "servico1-uuid",
 *     custom_price: 150,
 *     custom_time: 60,
 *     payment_method_id: "metodo-pagamento-uuid"
 *   },
 *   {
 *     id: "servico2-uuid",
 *     custom_price: 80,
 *     custom_time: 30
 *   }
 * ];
 * 
 * // Criar o agendamento com os serviços
 * const newAppointment = await createAppointmentManual(appointmentData, selectedServices);
 * ```
 */
export async function createAppointmentManual(
  appointmentData: {
    client_id: string;
    professional_id: string;
    date: string;
    time: string;
    notes?: string;
    status?: string;
  },
  selectedServices: Array<{
    id: string;
    custom_price?: number;
    custom_time?: number;
    payment_method_id?: string;
  }>
): Promise<Appointment> {
  try {
    console.log('Criando agendamento manualmente com serviços separados');
    
    // Log solicitado para debug
    console.log("selectedServices antes do insert:", selectedServices);
    
    // Validação prévia para verificar se há serviços válidos
    console.log('[DEBUG] Serviços brutos recebidos:', selectedServices);
    
    // Verificar se existe pelo menos um serviço com ID válido
    if (selectedServices.length > 0) {
      const servicosValidos = selectedServices.filter(s => !!s.id && typeof s.id === 'string');
      console.log(`[VALIDAÇÃO] Serviços recebidos: ${selectedServices.length}, Válidos: ${servicosValidos.length}`);
      
      if (servicosValidos.length === 0) {
        console.error('[ERRO CRÍTICO] Tentativa de criar agendamento sem serviços válidos.');
        throw new Error('Não é possível criar um agendamento sem serviços válidos. Verifique se todos os serviços têm ID definido.');
      }
    } else {
      console.warn('[ALERTA] Tentativa de criar agendamento sem serviços.');
    }
    
    // 1. Criar o agendamento básico primeiro
    const { data: newAppointment, error: appointmentError } = await supabase
      .from('appointments')
      .insert([appointmentData])
      .select(`
        id,
        client_id,
        professional_id,
        date,
        time,
        notes,
        status,
        created_at,
        updated_at
      `)
      .maybeSingle(); // Usar maybeSingle() para evitar erro PGRST116
    
    if (appointmentError) {
      console.error('Erro ao criar agendamento:', appointmentError);
      throw new Error(`Erro ao criar agendamento: ${appointmentError.message}`);
    }
    
    if (!newAppointment) {
      throw new Error('Não foi possível criar o agendamento - nenhum dado retornado');
    }
    
    console.log('Agendamento criado com sucesso:', newAppointment);
    
    // 2. Preparar os serviços para inserir
    const servicesToInsert = selectedServices
      .filter(service => !!service.id && typeof service.id === 'string') // Filtrar apenas serviços com ID válido
      .map(service => ({
        appointment_id: newAppointment.id,
        service_id: service.id,
        custom_price: service.custom_price,
        custom_time: service.custom_time,
        created_at: new Date().toISOString()
      }));
    
    console.log(`Inserindo ${servicesToInsert.length} serviços para o agendamento ${newAppointment.id}`, servicesToInsert);
    console.log("Serviços filtrados com service_id válido:", servicesToInsert);
    
    // Log de serviços filtrados (se houver)
    if (servicesToInsert.length < selectedServices.length) {
      console.warn(`[ALERTA] ${selectedServices.length - servicesToInsert.length} serviços foram ignorados por terem ID nulo ou undefined`);
    }
    
    // Verificar se existe pelo menos um serviço válido para inserir
    if (servicesToInsert.length === 0) {
      console.error('[ERRO] Nenhum serviço com ID válido fornecido. Abortando inserção de serviços.');
    } else {
      // 3. Inserir os serviços na tabela appointment_services usando nossa função segura
      const { error: servicesError } = await insertServicesSafely(servicesToInsert);
    
      if (servicesError) {
        console.error('Erro ao inserir serviços:', servicesError);
        // Não interromper a execução, pois o agendamento já foi criado
      } else {
        console.log(`Serviços inseridos com sucesso`);
      }
    }
    
    // 4. Buscar o agendamento completo com os serviços relacionados
    const { data: completeAppointment, error: fetchError } = await supabase
      .from('appointments')
      .select(`
        id,
        client_id,
        professional_id,
        date,
        time,
        notes,
        status,
        created_at,
        updated_at,
        client:client_id(id, name, email, phone),
        professional:professional_id(id, name),
        appointment_services(
          service_id,
          custom_price,
          custom_time,
          service:service_id(id, name, price, estimated_time)
        )
      `)
      .eq('id', newAppointment.id)
      .maybeSingle(); // Usar maybeSingle() para evitar erro PGRST116
    
    if (fetchError) {
      console.error('Erro ao buscar agendamento completo:', fetchError);
      return newAppointment as Appointment;
    }
    
    if (!completeAppointment) {
      console.warn('Agendamento não encontrado após criação, retornando dados básicos');
      return newAppointment as Appointment;
    }
    
    // Calcular duração total para compatibilidade
    const totalDuration = selectedServices.reduce((total, service) => 
      total + (service.custom_time || 0), 0);
    
    // Preparar o objeto final do agendamento
    const finalAppointment = {
      ...completeAppointment
    } as unknown as Appointment;

    // Disparar eventos para atualização da UI
    if (typeof window !== 'undefined') {
      // Primeiro disparar o evento de atualização da agenda
      const updateEvent = new CustomEvent('appointmentCreated', {
        detail: {
          appointment: finalAppointment,
          date: finalAppointment.date,
          forceRefresh: true,
          appointmentData: {
            ...finalAppointment,
            // Calcular a duração total a partir dos serviços para compatibilidade
            duration: finalAppointment.appointment_services?.reduce(
              (total, service) => total + (service.custom_time || (service.service?.estimated_time || 30)), 0
            ) || 30
          }
        }
      });
      window.dispatchEvent(updateEvent);

      // Depois disparar o evento para fechar o modal
      setTimeout(() => {
        const closeEvent = new CustomEvent('closeNewAppointmentModal', {
          detail: { 
            success: true,
            message: 'Agendamento criado com sucesso!'
          }
        });
        window.dispatchEvent(closeEvent);
      }, 100); // Pequeno delay para garantir que a atualização da agenda aconteça primeiro
    }
    
    return finalAppointment;
  } catch (error) {
    console.error('Erro ao criar agendamento manual:', error);
    throw error;
  }
}

/**
 * Função de segurança para garantir que nenhum objeto com service_id nulo seja enviado ao banco de dados
 * Esta função intercepta todas as chamadas de inserção na tabela appointment_services
 */
async function insertServicesSafely(services: any[], tableName: string = 'appointment_services'): Promise<any> {
  try {
    console.log('[insertServicesSafely] Iniciando inserção de serviços:', services);
    
    if (!services || services.length === 0) {
      console.warn('Nenhum serviço para inserir');
      return { data: null, error: new Error('Nenhum serviço para inserir') };
    }

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

    // Validar cada serviço antes da inserção
    const validServices = services.filter(service => {
      // Garantir que temos os campos obrigatórios
      const hasRequiredFields = service.service_id && 
                               typeof service.service_id === 'string' && 
                               service.service_id.trim() !== '' &&
                               service.appointment_id;
      
      if (!hasRequiredFields) {
        console.error('Serviço sem campos obrigatórios:', service);
        return false;
      }
      
      // Verificar se é um ID mock conhecido ou se é um UUID válido
      const isMockId = knownMockIds.includes(service.service_id);
      const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(service.service_id);
      
      if (isMockId) {
        console.log(`[insertServicesSafely] ID mock conhecido aceito: ${service.service_id}`);
        return true;
      }
      
      if (!isValidUUID) {
        console.error('Serviço com ID inválido:', service);
        return false;
      }
      
      return true;
    }).map(service => ({
      // Incluir apenas os campos permitidos
      appointment_id: service.appointment_id,
      service_id: service.service_id,
      custom_price: service.custom_price,
      custom_time: service.custom_time,
      created_at: service.created_at || new Date().toISOString()
    }));

    if (validServices.length === 0) {
      const error = new Error('Nenhum serviço válido para inserir');
      console.error('[insertServicesSafely] Erro:', error);
      return { data: null, error };
    }

    console.log('[insertServicesSafely] Serviços válidos para inserção:', validServices);

    // Inserir todos os serviços de uma vez
    const { data, error } = await supabase
      .from(tableName)
      .insert(validServices)
      .select();

    if (error) {
      console.error('[insertServicesSafely] Erro ao inserir serviços:', error);
      return { data: null, error };
    }

    console.log('[insertServicesSafely] Serviços inseridos com sucesso:', data);
    return { data, error: null };
  } catch (error) {
    console.error('[insertServicesSafely] Erro durante a inserção:', error);
    return { data: null, error };
  }
}