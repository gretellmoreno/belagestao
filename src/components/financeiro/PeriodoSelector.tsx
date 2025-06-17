import React, { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, CalendarRange, X } from 'lucide-react';
import DatePicker from 'react-datepicker';
import { DateRangeType } from '../../hooks/useFinanceiroData';
import "react-datepicker/dist/react-datepicker.css";

// Estilos personalizados para o calendário
const calendarStyles = `
  .period-calendar {
    font-size: 1rem !important;
    width: 320px !important;
    max-width: 100% !important;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1) !important;
    border: 1px solid #e5e7eb !important;
    margin-top: 8px !important;
    z-index: 1000 !important;
  }
  
  .period-calendar .react-datepicker__month-container {
    width: 320px !important;
    max-width: 100% !important;
  }
  
  .period-calendar .react-datepicker__day {
    width: 2.2rem !important;
    height: 2.2rem !important;
    line-height: 2.2rem !important;
    margin: 0.2rem !important;
    font-size: 0.95rem !important;
  }
  
  .period-calendar .react-datepicker__day-name {
    width: 2.2rem !important;
    margin: 0.2rem !important;
    font-size: 0.85rem !important;
  }
  
  .period-calendar .react-datepicker__header {
    padding-top: 1rem !important;
    padding-bottom: 1rem !important;
  }
  
  .period-calendar .react-datepicker__current-month {
    font-size: 1.1rem !important;
    margin-bottom: 0.7rem !important;
  }
  
  .period-calendar .react-datepicker__navigation {
    top: 1.2rem !important;
  }
  
  .date-selector-input {
    cursor: pointer !important;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236366F1'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'%3E%3C/path%3E%3C/svg%3E") !important;
    background-repeat: no-repeat !important;
    background-position: right 10px center !important;
    background-size: 20px 20px !important;
    padding-right: 35px !important;
    transition: all 0.2s !important;
  }
  
  .date-selector-input:hover {
    border-color: #a5b4fc !important;
    background-color: #f9fafb !important;
  }
  
  .date-selector-input:focus {
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2) !important;
    border-color: #6366f1 !important;
    outline: none !important;
  }
  
  .calendar-container {
    position: absolute;
    z-index: 1000;
    left: 0;
    right: 0;
    margin-top: 8px;
  }
  
  @media (max-width: 640px) {
    .react-datepicker-wrapper {
      position: static !important;
    }
    
    .react-datepicker-popper {
      position: fixed !important;
      top: 50% !important;
      left: 50% !important;
      transform: translate(-50%, -50%) !important;
      z-index: 9999 !important;
      width: 320px !important;
      max-width: 90vw !important;
    }
    
    .period-calendar {
      width: 100% !important;
      border-radius: 8px !important;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3) !important;
    }
    
    .period-calendar .react-datepicker__month-container {
      width: 100% !important;
    }
    
    .react-datepicker__day, 
    .react-datepicker__day-name {
      touch-action: manipulation !important;
    }
    
    .calendar-container {
      position: fixed !important;
      top: 50% !important;
      left: 50% !important;
      transform: translate(-50%, -50%) !important;
      width: 320px !important;
      max-width: 90vw !important;
    }
  }
`;

interface PeriodoSelectorProps {
  dateRange: DateRangeType;
  setDateRange: React.Dispatch<React.SetStateAction<DateRangeType>>;
  showPeriodModal: boolean;
  setShowPeriodModal: (show: boolean) => void;
  applyQuickPeriod: (days: number) => void;
}

export const PeriodoSelector: React.FC<PeriodoSelectorProps> = ({
  dateRange,
  setDateRange,
  showPeriodModal,
  setShowPeriodModal,
  applyQuickPeriod
}) => {
  // Estados para controlar a abertura dos calendários
  const [activeCalendar, setActiveCalendar] = useState<'start' | 'end' | null>(null);
  
  // Refs para detectar cliques fora dos calendários
  const startCalendarRef = useRef<HTMLDivElement>(null);
  const endCalendarRef = useRef<HTMLDivElement>(null);
  const startInputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);

  // Efeito para detectar cliques fora do calendário
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Verificar se o calendário está ativo
      if (!activeCalendar) return;
      
      const target = event.target as Node;
      
      // Verificar se o clique foi fora do calendário ativo e do input correspondente
      if (activeCalendar === 'start') {
        if (
          startCalendarRef.current && 
          !startCalendarRef.current.contains(target) &&
          startInputRef.current && 
          !startInputRef.current.contains(target)
        ) {
          setActiveCalendar(null);
        }
      } else if (activeCalendar === 'end') {
        if (
          endCalendarRef.current && 
          !endCalendarRef.current.contains(target) &&
          endInputRef.current && 
          !endInputRef.current.contains(target)
        ) {
          setActiveCalendar(null);
        }
      }
    };
    
    // Adicionar event listener
    document.addEventListener('mousedown', handleClickOutside);
    
    // Limpar event listener
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeCalendar]);

  // Formatar o texto do período selecionado
  const getDateRangeText = (): string => {
    if (!dateRange.startDate || !dateRange.endDate) return 'Selecione um período';
    
    const start = format(dateRange.startDate, 'dd/MM/yyyy', { locale: ptBR });
    const end = format(dateRange.endDate, 'dd/MM/yyyy', { locale: ptBR });
    
    if (start === end) return `${start}`;
    return `${start} - ${end}`;
  };
  
  // Manipulador para seleção de data
  const handleDateChange = (date: Date, type: 'start' | 'end') => {
    if (type === 'start') {
      setDateRange(prev => ({ ...prev, startDate: date }));
    } else {
      setDateRange(prev => ({ ...prev, endDate: date }));
    }
    setActiveCalendar(null);
  };

  return (
    <>
      {/* Aplicar estilos CSS para o calendário */}
      <style>{calendarStyles}</style>
      
      {/* Botão para abrir o seletor de período */}
      <div className="mb-6">
        <button
          onClick={() => setShowPeriodModal(true)}
          className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <CalendarRange className="h-5 w-5 mr-2 text-gray-500" />
          <span className="font-medium">Período:</span>
          <span className="ml-2 text-gray-900">{getDateRangeText()}</span>
        </button>
      </div>

      {/* Modal de seleção de período */}
      {showPeriodModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 relative">
            <button 
              onClick={() => {
                setShowPeriodModal(false);
                setActiveCalendar(null);
              }}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
            
            <h3 className="text-lg font-medium text-gray-900 mb-5 flex items-center">
              <Calendar className="h-5 w-5 mr-2 text-indigo-500" />
              Selecionar Período
            </h3>
            
            {/* Seleção rápida de período */}
            <div className="mb-5">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Períodos rápidos</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <button
                  onClick={() => {
                    applyQuickPeriod(0);
                    setActiveCalendar(null);
                  }}
                  className="py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium rounded-md transition-colors duration-200"
                >
                  Hoje
                </button>
                <button
                  onClick={() => {
                    applyQuickPeriod(7);
                    setActiveCalendar(null);
                  }}
                  className="py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium rounded-md transition-colors duration-200"
                >
                  Últimos 7 dias
                </button>
                <button
                  onClick={() => {
                    applyQuickPeriod(30);
                    setActiveCalendar(null);
                  }}
                  className="py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium rounded-md transition-colors duration-200"
                >
                  Últimos 30 dias
                </button>
                <button
                  onClick={() => {
                    applyQuickPeriod(90);
                    setActiveCalendar(null);
                  }}
                  className="py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium rounded-md transition-colors duration-200"
                >
                  Últimos 90 dias
                </button>
              </div>
            </div>
            
            {/* Seleção personalizada */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Período personalizado</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data inicial
                  </label>
                  <div className="relative">
                    <input
                      ref={startInputRef}
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm cursor-pointer date-selector-input"
                      value={dateRange.startDate ? format(dateRange.startDate, 'dd/MM/yyyy') : ''}
                      readOnly
                      placeholder="Selecione uma data"
                      onClick={() => setActiveCalendar('start')}
                    />
                    
                    {activeCalendar === 'start' && (
                      <div ref={startCalendarRef} className="calendar-container">
                        <DatePicker
                          selected={dateRange.startDate}
                          onChange={(date: Date) => handleDateChange(date, 'start')}
                          locale={ptBR}
                          inline
                          calendarClassName="period-calendar"
                          showMonthDropdown
                          showYearDropdown
                          dropdownMode="select"
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data final
                  </label>
                  <div className="relative">
                    <input
                      ref={endInputRef}
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm cursor-pointer date-selector-input"
                      value={dateRange.endDate ? format(dateRange.endDate, 'dd/MM/yyyy') : ''}
                      readOnly
                      placeholder="Selecione uma data"
                      onClick={() => setActiveCalendar('end')}
                    />
                    
                    {activeCalendar === 'end' && (
                      <div ref={endCalendarRef} className="calendar-container">
                        <DatePicker
                          selected={dateRange.endDate}
                          onChange={(date: Date) => handleDateChange(date, 'end')}
                          locale={ptBR}
                          inline
                          calendarClassName="period-calendar"
                          showMonthDropdown
                          showYearDropdown
                          dropdownMode="select"
                          minDate={dateRange.startDate}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Botões de ação */}
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowPeriodModal(false);
                  setActiveCalendar(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setShowPeriodModal(false);
                  setActiveCalendar(null);
                }}
                disabled={!dateRange.startDate || !dateRange.endDate}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PeriodoSelector; 