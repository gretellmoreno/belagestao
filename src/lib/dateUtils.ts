import { format, parseISO, isValid, isToday as dateFnsIsToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Utilitários para processamento de datas e horários para garantir
 * consistência entre a visualização na agenda e no modal de detalhes
 */

// Constantes de configuração
export const DEFAULT_DATE_FORMAT = 'dd/MM/yyyy';
export const DEFAULT_TIME_FORMAT = 'HH:mm';
export const DEFAULT_DATETIME_FORMAT = 'dd/MM/yyyy HH:mm';

// Lista de formatos válidos para verificação
const VALID_FORMATS = [
  'yyyy-MM-dd',
  'dd/MM/yyyy',
  'HH:mm',
  'dd/MM/yyyy HH:mm',
  "dd 'de' MMMM",
  'yyyy',
  "EEEE, d 'de' MMMM",
  "d MMM"
];

/**
 * Normaliza o formato de hora removendo segundos e garantindo o formato HH:MM
 */
export function normalizeTime(time: string | undefined): string {
  if (!time) return '';
  
  // Remove os segundos se existirem
  if (time.includes(':')) {
    const parts = time.split(':');
    if (parts.length >= 2) {
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    }
  }
  return time;
}

/**
 * Converte hora no formato HH:MM para minutos
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + (minutes || 0);
}

/**
 * Verifica se um formato de data é válido
 */
function isValidDateFormat(dateFormat: string): boolean {
  // Aceita formatos padrões conhecidos
  if (VALID_FORMATS.includes(dateFormat)) {
    return true;
  }
  
  // Verifica se contém caracteres de formato válidos
  const validChars = /^[yMdHhmsEP'\s-/.,:]+$/;
  return validChars.test(dateFormat);
}

/**
 * Formata uma data ISO para exibição com o formato especificado
 */
export function formatDate(date: string | Date, dateFormat: string = DEFAULT_DATE_FORMAT): string {
  try {
    // Verificação de segurança para evitar formatos inválidos
    if (!isValidDateFormat(dateFormat)) {
      console.warn(`Formato "${dateFormat}" pode ser inválido. Usando formato padrão.`);
      dateFormat = DEFAULT_DATE_FORMAT;
    }
    
    const parsedDate = typeof date === 'string' ? parseISO(date) : date;
    return format(parsedDate, dateFormat, { locale: ptBR });
  } catch (error) {
    console.error('Erro ao formatar data:', error);
    return String(date);
  }
}

/**
 * Formata um horário para exibição local, garantindo consistência entre
 * a visualização na agenda e nos detalhes
 */
export function formatAppointmentDateTime(date: string, time: string): string {
  try {
    const formattedDate = formatDate(date);
    const normalizedTime = normalizeTime(time);
    
    // Log para diagnóstico
    console.log('formatAppointmentDateTime:', { 
      original: { date, time }, 
      formatted: { formattedDate, normalizedTime }
    });
    
    return `${formattedDate} às ${normalizedTime}`;
  } catch (error) {
    console.error('Erro ao formatar data/hora:', error);
    return `${date} às ${time}`;
  }
}

/**
 * Formata a duração em minutos para exibição legível
 */
export function formatDuration(minutes: number | string): string {
  // Garantir que temos um número
  const mins = typeof minutes === 'string' ? parseInt(minutes) || 30 : minutes || 30;
  
  if (mins < 60) {
    return `${mins} min`;
  } else {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    
    if (remainingMins === 0) {
      return hours === 1 ? '1 hora' : `${hours} horas`;
    } else {
      return hours === 1 
        ? `1 hora e ${remainingMins} min` 
        : `${hours} horas e ${remainingMins} min`;
    }
  }
}

/**
 * 🔧 CORREÇÃO CRÍTICA PARA FUSO HORÁRIO
 * 
 * Esta função converte uma data para string no formato YYYY-MM-DD
 * usando o fuso horário LOCAL do usuário, não UTC.
 * 
 * Problema resolvido: Às 21h no horário de Brasília (UTC-3), 
 * o método toISOString() retorna o dia seguinte em UTC,
 * causando filtros incorretos na agenda.
 */
export function formatDateToLocal(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (!isValid(dateObj)) {
    console.warn('⚠️ [formatDateToLocal] Data inválida recebida:', date);
    return new Date().toLocaleDateString('sv-SE'); // Fallback para hoje em formato ISO
  }

  // Usar toLocaleDateString com formato ISO para manter formato YYYY-MM-DD
  // mas respeitando o fuso horário local
  return dateObj.toLocaleDateString('sv-SE'); // sv-SE retorna formato YYYY-MM-DD
}

/**
 * 🔧 NOVA FUNÇÃO: Obter data atual no fuso local
 * 
 * Substitui new Date().toISOString().split('T')[0] 
 * que causava problemas de fuso horário.
 */
export function getCurrentDateLocal(): string {
  return formatDateToLocal(new Date());
}

/**
 * 🔧 NOVA FUNÇÃO: Verificar se uma data é hoje (fuso local)
 * 
 * Compara datas usando o fuso horário local do usuário.
 */
export function isTodayLocal(date: Date | string): boolean {
  const today = getCurrentDateLocal();
  const targetDate = formatDateToLocal(date);
  return today === targetDate;
}

/**
 * 🔧 NOVA FUNÇÃO: Criar timestamp para banco de dados
 * 
 * Para campos created_at, updated_at etc.
 */
export function createTimestamp(): string {
  return new Date().toISOString();
} 