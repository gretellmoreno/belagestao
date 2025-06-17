/**
 * Utilitários para trabalhar com UUIDs no projeto
 */

// Lista de valores inválidos conhecidos que devem ser rejeitados
const INVALID_VALUES = ['default-service', 'default'];

/**
 * Verifica se uma string é um UUID válido no formato padrão
 * @param id String a ser validada
 * @returns true se for um UUID válido, false caso contrário
 */
export const isValidUUID = (id: string | null | undefined): boolean => {
  if (!id) return false;
  if (typeof id !== 'string') return false;
  
  // Verificar primeiro se é um valor explicitamente inválido
  if (INVALID_VALUES.includes(id)) {
    console.warn(`ID rejeitado: "${id}" está na lista de valores inválidos conhecidos`);
    return false;
  }
  
  // Expressão regular para validar o formato UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

/**
 * Retorna um UUID inexistente mas válido para consultas que precisam falhar com segurança
 * @returns UUID válido mas inexistente
 */
export const getNullUUID = (): string => {
  return '00000000-0000-0000-0000-000000000000';
};

/**
 * Sanitiza um array de objetos, removendo aqueles cujas propriedades de ID não são UUIDs válidos
 * @param array Array de objetos a ser sanitizado
 * @param idField Nome da propriedade que contém o UUID (padrão: 'id')
 * @returns Array filtrado apenas com objetos que têm UUIDs válidos
 */
export const sanitizeArrayByUUID = <T extends Record<string, any>>(
  array: T[],
  idField: string = 'id'
): T[] => {
  if (!Array.isArray(array)) return [];
  
  return array.filter(item => {
    if (!item || typeof item !== 'object') return false;
    return isValidUUID(item[idField]);
  });
}; 