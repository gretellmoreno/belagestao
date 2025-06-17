import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import TimeSlots from './TimeSlots';

interface CalendarProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onEditAppointment: (date: Date) => void;
}

export default function Calendar({ selectedDate, onDateChange, onEditAppointment }: CalendarProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Estilo global para sobrepor absolutamente tudo
  useEffect(() => {
    if (isOpen) {
      // Impede rolagem do body quando o calendário está aberto
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <div className="flex-1 bg-white rounded-lg shadow overflow-hidden w-full">
      <div className="p-4 border-b bg-white sticky top-0 z-20 w-full">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center space-x-2 min-w-0">
            <button 
              className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200 shrink-0"
              onClick={() => {
                const newDate = new Date(selectedDate);
                newDate.setDate(newDate.getDate() - 1);
                onDateChange(newDate);
              }}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="text-base md:text-lg font-semibold truncate">
              {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </h2>
            <button 
              className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200 shrink-0"
              onClick={() => {
                const newDate = new Date(selectedDate);
                newDate.setDate(newDate.getDate() + 1);
                onDateChange(newDate);
              }}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <div className="relative shrink-0">
            <button
              type="button"
              className="px-3 py-1.5 md:px-4 md:py-2 text-sm font-medium border rounded-md hover:bg-gray-50 transition-colors duration-200 flex items-center space-x-2 whitespace-nowrap"
              onClick={() => setIsOpen(!isOpen)}
            >
              <CalendarIcon className="h-4 w-4" />
              <span className="hidden md:inline">Selecionar Data</span>
            </button>
            
            {isOpen && createPortal(
              <div 
                style={{ 
                  position: 'fixed', 
                  inset: 0, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  zIndex: 2147483647
                }}
                onClick={() => setIsOpen(false)}
              >
                <div 
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '0.5rem',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    padding: '1rem',
                    position: 'relative',
                    maxWidth: '90vw',
                    maxHeight: '90vh',
                    overflow: 'auto',
                    margin: '1rem'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <DayPicker
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      if (date) {
                        onDateChange(date);
                        setIsOpen(false);
                      }
                    }}
                    locale={ptBR}
                    showOutsideDays
                    fixedWeeks
                    fromMonth={new Date()}
                    className="w-full max-w-full"
                  />
                </div>
              </div>,
              document.body
            )}
          </div>
        </div>
      </div>
      <TimeSlots selectedDate={selectedDate} onEditAppointment={onEditAppointment} />
    </div>
  );
}