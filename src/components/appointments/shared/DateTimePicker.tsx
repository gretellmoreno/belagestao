import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock } from 'lucide-react';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

// Registrar localização para português do Brasil
registerLocale('pt-BR', ptBR);

interface DateTimePickerProps {
  selectedDate: Date;
  selectedTime: string | null;
  availableTimeSlots: string[];
  onDateChange: (date: Date) => void;
  onTimeChange: (time: string) => void;
  disabled?: boolean;
  className?: string;
  showTimeSlots?: boolean;
}

export default function DateTimePicker({
  selectedDate,
  selectedTime,
  availableTimeSlots,
  onDateChange,
  onTimeChange,
  disabled = false,
  className = '',
  showTimeSlots = true
}: DateTimePickerProps) {
  // Agrupar slots por hora para UI mais organizada
  const groupedTimeSlots = useMemo(() => {
    const grouped: { [hour: string]: string[] } = {};
    
    availableTimeSlots.forEach(time => {
      const hour = time.substring(0, 2);
      if (!grouped[hour]) {
        grouped[hour] = [];
      }
      grouped[hour].push(time);
    });
    
    return grouped;
  }, [availableTimeSlots]);

  const handleDateChange = (date: Date) => {
    onDateChange(date);
    if (selectedTime) {
      // Resetar o horário se mudar a data
      onTimeChange('');
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="space-y-2">
        <div className="text-sm font-medium text-gray-700">Data</div>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <DatePicker
            selected={selectedDate}
            onChange={handleDateChange}
            dateFormat="dd/MM/yyyy"
            locale="pt-BR"
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={disabled}
            calendarClassName="border rounded-md shadow-md"
          />
        </div>
      </div>

      {showTimeSlots && (
        <div className="space-y-2">
          <div className="flex items-center">
            <Clock className="text-gray-400 h-4 w-4 mr-2" />
            <span className="text-sm font-medium text-gray-700">Horário</span>
          </div>

          {availableTimeSlots.length > 0 ? (
            <div className="space-y-2">
              {Object.entries(groupedTimeSlots).map(([hour, slots]) => (
                <div key={hour} className="space-y-1">
                  <div className="text-xs font-medium text-gray-500">
                    {`${hour}:00 - ${parseInt(hour) + 1}:00`}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {slots.map(time => (
                      <button
                        key={time}
                        onClick={() => onTimeChange(time)}
                        disabled={disabled}
                        className={`
                          px-2 py-1 text-sm rounded
                          ${selectedTime === time
                            ? 'bg-indigo-500 text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          }
                          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 bg-gray-50 rounded-md text-sm text-gray-500">
              Nenhum horário disponível para esta data.
              <br />
              Por favor, selecione outra data.
            </div>
          )}

          {selectedDate && selectedTime && (
            <div className="bg-indigo-50 p-3 rounded-md mt-3">
              <div className="text-sm font-medium text-indigo-700">Horário selecionado</div>
              <div className="text-sm">
                {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} às {selectedTime}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 