import { useEffect, useRef } from 'react';
import { CalendarPlus, Clock, X } from 'lucide-react';

interface TimeSlotPopupMenuProps {
  time: string;
  x: number;
  y: number;
  professionalId: string;
  onAddAppointment: () => void;
  onClose: () => void;
}

export default function TimeSlotPopupMenu({
  time,
  x,
  y,
  professionalId,
  onAddAppointment,
  onClose
}: TimeSlotPopupMenuProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const isMobile = window.innerWidth < 768;

  useEffect(() => {
    if (!popupRef.current) return;

    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    const rect = popupRef.current.getBoundingClientRect();

    if (rect.bottom > windowHeight) {
      popupRef.current.style.top = `${y - rect.height}px`;
    }

    if (rect.right > windowWidth) {
      popupRef.current.style.left = `${x - (rect.right - windowWidth) - 10}px`;
    }

    if (rect.top < 0) {
      popupRef.current.style.top = '10px';
    }

    if (rect.left < 0) {
      popupRef.current.style.left = '10px';
    }
  }, [x, y]);

  return (
    <div
      ref={popupRef}
      className={`fixed bg-white rounded-xl shadow-2xl border border-gray-200 z-[9999] time-slot-popup ${
        isMobile ? 'w-80' : 'w-96'
      }`}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        maxWidth: 'calc(100vw - 20px)',
        minHeight: isMobile ? '120px' : '140px'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className={`${isMobile ? 'p-4' : 'p-5'} border-b border-gray-100 flex items-center justify-between bg-indigo-50 rounded-t-xl`}>
        <div className="flex items-center">
          <div className="bg-indigo-100 p-2 rounded-lg mr-3">
            <Clock className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-indigo-600`} />
          </div>
          <div>
            <span className={`${isMobile ? 'text-sm' : 'text-base'} font-semibold text-gray-800 block`}>
              Horário: {time}
            </span>
            <span className="text-xs text-gray-500">Clique para agendar</span>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="p-2 rounded-full hover:bg-white text-gray-400 hover:text-gray-600 transition-colors shadow-sm"
          aria-label="Fechar"
        >
          <X className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
        </button>
      </div>

      <div className={`${isMobile ? 'p-4' : 'p-5'}`}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddAppointment();
          }}
          className={`w-full text-left ${isMobile ? 'p-4' : 'p-5'} hover:bg-indigo-50 ${isMobile ? 'text-sm' : 'text-base'} rounded-lg flex items-center text-gray-700 transition-all duration-200 border-2 border-transparent hover:border-indigo-200 hover:shadow-md group`}
        >
          <div className="bg-indigo-100 group-hover:bg-indigo-200 p-3 rounded-lg mr-4 transition-colors">
            <CalendarPlus className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-indigo-600`} />
          </div>
          <div>
            <span className="font-medium text-gray-800 block">Adicionar Agendamento</span>
            <span className="text-xs text-gray-500 mt-1">Criar novo agendamento para este horário</span>
          </div>
        </button>
      </div>
    </div>
  );
}
