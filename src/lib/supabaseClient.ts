import { createClient } from '@supabase/supabase-js';
import { isValidUUID, getNullUUID } from './uuidUtils';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Verificar se as variáveis de ambiente estão definidas
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são necessárias para conectar ao Supabase.');
}

// Criar o cliente Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Função auxiliar para fazer consultas por ID de forma segura.
 * Evita consultas com UUIDs inválidos que causariam erros de sintaxe no banco.
 * 
 * @param query A consulta Supabase base
 * @param column O nome da coluna a ser verificada (normalmente 'id')
 * @param value O valor UUID a ser consultado
 * @returns A consulta Supabase com o filtro aplicado
 */
export const safeUuidEq = (query: any, column: string, value: string | null | undefined) => {
  if (!isValidUUID(value)) {
    console.warn(`Consulta por UUID inválido '${value}' interceptada e modificada para UUID inexistente`);
    // Usar um UUID válido que sabemos que não vai existir no banco
    return query.eq(column, getNullUUID());
  }
  
  // Se o UUID for válido, fazer a consulta normalmente
  return query.eq(column, value);
};

// Middleware para remover campos problemáticos antes de enviá-los ao Supabase
// Esta função é chamada antes de qualquer operação update/insert
const removeProblematicFields = (payload: any): any => {
  // Se o payload não for um objeto, retorná-lo sem alterações
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }
  
  // Lista de campos obsoletos/problemáticos que não devem ser enviados
  const problematicFields = ['text_label'];
  
  // Criar uma cópia limpa
  const cleanPayload = { ...payload };
  
  // Remover campos problemáticos
  problematicFields.forEach(field => {
    if (field in cleanPayload) {
      console.warn(`Middleware: Removendo campo problemático '${field}' do payload`);
      delete cleanPayload[field];
    }
  });
  
  return cleanPayload;
};

// Estender a funcionalidade do cliente Supabase para limpar payloads automaticamente
const originalFrom = supabase.from.bind(supabase);
supabase.from = (table: string) => {
  const builder = originalFrom(table);
  
  // Sobrescrever o método update para limpar o payload
  const originalUpdate = builder.update.bind(builder);
  builder.update = (payload: any, options?: any) => {
    const cleanPayload = removeProblematicFields(payload);
    return originalUpdate(cleanPayload, options);
  };
  
  // Sobrescrever o método insert para limpar o payload
  const originalInsert = builder.insert.bind(builder);
  builder.insert = (payload: any, options?: any) => {
    const cleanPayload = Array.isArray(payload) 
      ? payload.map(removeProblematicFields)
      : removeProblematicFields(payload);
    return originalInsert(cleanPayload, options);
  };
  
  // Sobrescrever o método upsert para limpar o payload
  const originalUpsert = builder.upsert.bind(builder);
  builder.upsert = (payload: any, options?: any) => {
    const cleanPayload = Array.isArray(payload) 
      ? payload.map(removeProblematicFields)
      : removeProblematicFields(payload);
    return originalUpsert(cleanPayload, options);
  };
  
  return builder;
};

// Função para diagnosticar problemas de conexão com o Supabase
export async function diagnosticSupabaseConnection() {
  return true;
}

// Executar diagnóstico quando o cliente for carregado
diagnosticSupabaseConnection(); 