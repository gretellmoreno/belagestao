import { supabase } from '../lib/supabaseClient';

interface AgendaDiagnosticResult {
  timestamp: string;
  requestedDate: string;
  totalAppointments: number;
  appointments: Array<{
    id: string;
    date: string;
    time: string;
    status: string;
    created_at: string;
    client_name?: string;
  }>;
  timezone: string;
  systemTime: string;
}

/**
 * 🔍 DIAGNÓSTICO DA AGENDA
 * 
 * Esta função faz uma busca direta no banco de dados para verificar
 * se os agendamentos realmente estão desaparecendo ou se é um problema
 * de cache/exibição no frontend.
 */
export async function diagnosticarAgenda(date: string): Promise<AgendaDiagnosticResult> {
  console.log('🔍 [DIAGNÓSTICO] Iniciando diagnóstico da agenda para:', date);

  try {
    // Buscar diretamente no banco de dados, ignorando cache
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id,
        date,
        time,
        status,
        created_at,
        updated_at,
        client:clients!inner(name)
      `)
      .eq('date', date)
      .order('time');

    if (error) {
      console.error('🚨 [DIAGNÓSTICO] Erro na consulta:', error);
      throw error;
    }

    const resultado: AgendaDiagnosticResult = {
      timestamp: new Date().toISOString(),
      requestedDate: date,
      totalAppointments: data?.length || 0,
      appointments: (data || []).map(apt => ({
        id: apt.id,
        date: apt.date,
        time: apt.time,
        status: apt.status,
        created_at: apt.created_at,
        client_name: (apt.client as any)?.name || 'Não especificado'
      })),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      systemTime: new Date().toISOString()
    };

    console.log('✅ [DIAGNÓSTICO] Resultado completo:', resultado);
    
    // Verificar se há agendamentos que deveriam estar visíveis
    if (resultado.totalAppointments === 0) {
      console.warn('🚨 [DIAGNÓSTICO] PROBLEMA DETECTADO: Nenhum agendamento encontrado para a data', date);
      console.warn('🚨 [DIAGNÓSTICO] Isso pode indicar:');
      console.warn('   1. Problema de timezone entre frontend e banco');
      console.warn('   2. Triggers automáticos no banco alterando/removendo registros');
      console.warn('   3. Problema na configuração do Supabase');
    } else {
      console.log('✅ [DIAGNÓSTICO] Agendamentos encontrados normalmente');
    }

    return resultado;
  } catch (error) {
    console.error('🚨 [DIAGNÓSTICO] Erro no diagnóstico:', error);
    throw error;
  }
}

/**
 * 🕐 MONITOR CONTÍNUO
 * 
 * Esta função monitora continuamente a agenda durante o dia
 * para detectar quando os agendamentos desaparecem.
 */
export function iniciarMonitorContínuo(date: string, intervalMinutos: number = 15) {
  console.log('🕐 [MONITOR] Iniciando monitoramento contínuo para:', date);
  console.log('🕐 [MONITOR] Intervalo de verificação:', intervalMinutos, 'minutos');

  let ultimoResultado: AgendaDiagnosticResult | null = null;

  const verificar = async () => {
    try {
      const resultado = await diagnosticarAgenda(date);
      
      // Comparar com resultado anterior
      if (ultimoResultado) {
        if (resultado.totalAppointments < ultimoResultado.totalAppointments) {
          console.error('🚨 [MONITOR] AGENDAMENTOS DESAPARECERAM!');
          console.error('🚨 [MONITOR] Antes:', ultimoResultado.totalAppointments, 'agendamentos');
          console.error('🚨 [MONITOR] Agora:', resultado.totalAppointments, 'agendamentos');
          console.error('🚨 [MONITOR] Diferença:', ultimoResultado.totalAppointments - resultado.totalAppointments);
          console.error('🚨 [MONITOR] Horário do problema:', new Date().toISOString());
          
          // Disparar evento personalizado para alertar a aplicação
          window.dispatchEvent(new CustomEvent('agendamentosDesapareceram', {
            detail: {
              dataProblema: date,
              agendamentosAntes: ultimoResultado.totalAppointments,
              agendamentosAgora: resultado.totalAppointments,
              horario: new Date().toISOString()
            }
          }));
        }
      }
      
      ultimoResultado = resultado;
    } catch (error) {
      console.error('🚨 [MONITOR] Erro durante monitoramento:', error);
    }
  };

  // Primeira verificação imediata
  verificar();

  // Configurar verificação periódica
  const intervalId = setInterval(verificar, intervalMinutos * 60 * 1000);

  // Retornar função para parar o monitoramento
  return () => {
    console.log('🛑 [MONITOR] Parando monitoramento para:', date);
    clearInterval(intervalId);
  };
}

/**
 * 🔧 FORÇAR RECARREGAMENTO
 * 
 * Esta função força um recarregamento completo dos agendamentos,
 * ignorando cache e fazendo nova consulta no banco.
 */
export async function forcarRecarregamentoAgenda(date: string) {
  console.log('🔧 [RECARGA] Forçando recarregamento da agenda para:', date);
  
  try {
    // Disparar evento para limpar cache
    window.dispatchEvent(new CustomEvent('limparCacheAgenda'));
    
    // Disparar evento para recarregar agendamentos
    window.dispatchEvent(new CustomEvent('recarregarAgenda', {
      detail: { date, forceRefresh: true }
    }));
    
    console.log('✅ [RECARGA] Eventos de recarregamento disparados');
  } catch (error) {
    console.error('🚨 [RECARGA] Erro ao forçar recarregamento:', error);
  }
}

// Exportar para o console do navegador para facilitar o uso
if (typeof window !== 'undefined') {
  (window as any).diagnosticarAgenda = diagnosticarAgenda;
  (window as any).iniciarMonitorContínuo = iniciarMonitorContínuo;
  (window as any).forcarRecarregamentoAgenda = forcarRecarregamentoAgenda;
  
  console.log('🔧 [DIAGNÓSTICO] Utilitários disponíveis no console:');
  console.log('   • diagnosticarAgenda("2024-01-15") - Verificar agendamentos específicos');
  console.log('   • iniciarMonitorContínuo("2024-01-15", 10) - Monitorar continuamente');
  console.log('   • forcarRecarregamentoAgenda("2024-01-15") - Forçar recarga');
} 