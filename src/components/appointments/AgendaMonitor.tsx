import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { diagnosticarAgenda, iniciarMonitorContínuo, forcarRecarregamentoAgenda } from '../../utils/agendaDiagnostic';
import { useAppointments } from '../../contexts/AppointmentContext';

interface AgendaMonitorProps {
  currentDate: string;
  isActive?: boolean;
}

interface ProblemaDetectado {
  horario: string;
  agendamentosAntes: number;
  agendamentosAgora: number;
  data: string;
}

export const AgendaMonitor: React.FC<AgendaMonitorProps> = ({ 
  currentDate, 
  isActive = true 
}) => {
  const { loadAppointmentsByDate, clearCache } = useAppointments();
  const [problemas, setProblemas] = useState<ProblemaDetectado[]>([]);
  const [monitorando, setMonitorando] = useState(false);
  const [ultimosDados, setUltimosDados] = useState<{
    total: number;
    timestamp: string;
  } | null>(null);

  // Função para tratar eventos de agendamentos desaparecidos
  const handleAgendamentosDesapareceram = (event: CustomEvent) => {
    const { dataProblema, agendamentosAntes, agendamentosAgora, horario } = event.detail;
    
    console.error('🚨 [AGENDA MONITOR] PROBLEMA DETECTADO!', event.detail);
    
    // Adicionar à lista de problemas
    setProblemas(prev => [...prev, {
      horario: format(new Date(horario), 'HH:mm:ss', { locale: ptBR }),
      agendamentosAntes,
      agendamentosAgora,
      data: dataProblema
    }]);

    // Tentar forçar recarregamento automaticamente
    setTimeout(() => {
      console.log('🔧 [AGENDA MONITOR] Tentando correção automática...');
      clearCache();
      loadAppointmentsByDate(dataProblema, true);
    }, 1000);
  };

  // Função para tratar eventos de limpeza de cache
  const handleLimparCache = () => {
    clearCache();
  };

  // Função para tratar eventos de recarregamento
  const handleRecarregarAgenda = (event: CustomEvent) => {
    const { date, forceRefresh } = event.detail;
    loadAppointmentsByDate(date, forceRefresh);
  };

  // Configurar listeners de eventos
  useEffect(() => {
    if (!isActive) return;

    const eventListeners = [
      { event: 'agendamentosDesapareceram', handler: handleAgendamentosDesapareceram },
      { event: 'limparCacheAgenda', handler: handleLimparCache },
      { event: 'recarregarAgenda', handler: handleRecarregarAgenda }
    ];

    eventListeners.forEach(({ event, handler }) => {
      window.addEventListener(event as any, handler);
    });

    return () => {
      eventListeners.forEach(({ event, handler }) => {
        window.removeEventListener(event as any, handler);
      });
    };
  }, [isActive, clearCache, loadAppointmentsByDate]);

  // Iniciar monitoramento automático
  useEffect(() => {
    if (!isActive || !currentDate) return;

    console.log('🕐 [AGENDA MONITOR] Iniciando monitoramento para:', currentDate);
    setMonitorando(true);
    
    // Iniciar monitor contínuo com verificação a cada 10 minutos
    const pararMonitor = iniciarMonitorContínuo(currentDate, 10);

    return () => {
      console.log('🛑 [AGENDA MONITOR] Parando monitoramento para:', currentDate);
      setMonitorando(false);
      pararMonitor();
    };
  }, [currentDate, isActive]);

  // Função para diagnóstico manual
  const executarDiagnostico = async () => {
    try {
      const resultado = await diagnosticarAgenda(currentDate);
      setUltimosDados({
        total: resultado.totalAppointments,
        timestamp: format(new Date(resultado.timestamp), 'HH:mm:ss', { locale: ptBR })
      });
      
      console.log('🔍 [AGENDA MONITOR] Diagnóstico executado:', resultado);
      alert(`Diagnóstico executado:\n\nAgendamentos encontrados: ${resultado.totalAppointments}\nHorário: ${format(new Date(resultado.timestamp), 'HH:mm:ss', { locale: ptBR })}\n\nVeja o console para detalhes completos.`);
    } catch (error) {
      console.error('🚨 [AGENDA MONITOR] Erro no diagnóstico:', error);
      alert('Erro ao executar diagnóstico. Veja o console para detalhes.');
    }
  };

  // Função para forçar recarregamento
  const forcarRecarga = async () => {
    try {
      console.log('🔧 [AGENDA MONITOR] Forçando recarga da agenda...');
      await forcarRecarregamentoAgenda(currentDate);
      
      // Atualizar dados locais também
      setTimeout(async () => {
        const resultado = await diagnosticarAgenda(currentDate);
        setUltimosDados({
          total: resultado.totalAppointments,
          timestamp: format(new Date(resultado.timestamp), 'HH:mm:ss', { locale: ptBR })
        });
      }, 2000);
      
      alert('Recarga forçada executada com sucesso!');
    } catch (error) {
      console.error('🚨 [AGENDA MONITOR] Erro ao forçar recarga:', error);
      alert('Erro ao forçar recarga. Veja o console para detalhes.');
    }
  };

  if (!isActive) return null;

  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <div className={`w-3 h-3 rounded-full ${monitorando ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-yellow-800">
            🔍 Monitor de Agenda - {format(new Date(currentDate), 'dd/MM/yyyy', { locale: ptBR })}
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <p>
              Status: {monitorando ? '🟢 Monitorando automaticamente' : '🔴 Monitoramento inativo'}
            </p>
            
            {ultimosDados && (
              <p className="mt-1">
                Última verificação: {ultimosDados.timestamp} - {ultimosDados.total} agendamentos
              </p>
            )}

            {problemas.length > 0 && (
              <div className="mt-3 p-2 bg-red-100 border border-red-300 rounded">
                <h4 className="font-medium text-red-800">⚠️ Problemas detectados hoje:</h4>
                {problemas.map((problema, index) => (
                  <div key={index} className="text-sm text-red-700 mt-1">
                    {problema.horario}: {problema.agendamentosAntes} → {problema.agendamentosAgora} agendamentos
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="mt-3 flex space-x-2">
            <button
              onClick={executarDiagnostico}
              className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-1 rounded transition-colors"
            >
              🔍 Diagnóstico Manual
            </button>
            
            <button
              onClick={forcarRecarga}
              className="bg-green-500 hover:bg-green-600 text-white text-xs px-3 py-1 rounded transition-colors"
            >
              🔄 Forçar Recarga
            </button>
            
            <button
              onClick={() => setProblemas([])}
              className="bg-gray-500 hover:bg-gray-600 text-white text-xs px-3 py-1 rounded transition-colors"
            >
              🗑️ Limpar Histórico
            </button>
          </div>
          
          <div className="mt-2 text-xs text-yellow-600">
            💡 Este monitor detecta automaticamente quando agendamentos desaparecem e tenta corrigi-los.
          </div>
        </div>
      </div>
    </div>
  );
}; 