import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Professional } from '../../../lib/professionalService';

interface TimeSlotHeaderProps {
  professionals: Professional[];
  paginatedProfessionals: Professional[];
  currentPage: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
}

export default function TimeSlotHeader({
  paginatedProfessionals,
  currentPage,
  totalPages,
  onPrevPage,
  onNextPage
}: TimeSlotHeaderProps) {
  return (
    <div className="bg-white">
      {/* Navegação entre páginas - mais compacta em mobile */}
      <div className="flex justify-between items-center px-2 sm:px-4 py-1 sm:py-2 border-b border-gray-200 bg-gray-50">
        <button
          onClick={onPrevPage}
          disabled={currentPage === 0}
          className={`p-1 rounded-full ${
            currentPage === 0
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
        
        <span className="text-xs sm:text-sm text-gray-500">
          {currentPage + 1} de {totalPages}
        </span>
        
        <button
          onClick={onNextPage}
          disabled={currentPage === totalPages - 1}
          className={`p-1 rounded-full ${
            currentPage === totalPages - 1
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
        </button>
      </div>

      <div className="flex bg-gray-50 border-b border-gray-200 w-full relative">
        {/* Coluna de horário fixa */}
        <div className="flex-shrink-0 w-[50px] sm:w-[60px] md:w-[70px] lg:w-[80px] flex items-center justify-center font-medium text-gray-500 text-xs h-8 sm:h-10 md:h-12 border-l bg-white excel-time-column sticky-time-column">
          <span className="truncate px-1">Horário</span>
        </div>
        
        {/* Colunas dos profissionais */}
        {paginatedProfessionals.map(({ id, name, color }, index) => (
          <div
            key={id}
            className="h-8 sm:h-10 md:h-12 border-l border-gray-200 flex items-center justify-center bg-gray-50"
            style={{
              width: `calc((100% - 50px) / ${paginatedProfessionals.length})`,
              flexShrink: 0,
              flexGrow: 0
            }}
          >
            <div
              className="px-1 sm:px-2 text-center font-medium text-xs text-gray-700 w-full h-full flex items-center justify-center overflow-hidden"
              style={{
                borderLeft: `3px solid ${color || '#818CF8'}`,
                backgroundColor: `${color}15` || '#EEF2FF'
              }}
            >
              <span className="truncate">{name}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
