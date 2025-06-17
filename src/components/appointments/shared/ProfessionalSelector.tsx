import { Professional } from '../../../lib/professionalService';

interface ProfessionalSelectorProps {
  professionals: Professional[];
  selectedProfessionalId: string | null;
  onSelectProfessional: (professionalId: string) => void;
  className?: string;
  disabled?: boolean;
}

export default function ProfessionalSelector({
  professionals,
  selectedProfessionalId,
  onSelectProfessional,
  className = '',
  disabled = false
}: ProfessionalSelectorProps) {
  // Ordenar profissionais por nome
  const sortedProfessionals = [...professionals].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  // Estilização condicional extraída para função auxiliar (opcional)
  function getButtonClass(selected: boolean, hasId: boolean) {
    if (!hasId || disabled) return 'opacity-50 cursor-not-allowed';
    return selected
      ? 'bg-indigo-100 border-indigo-500 border-2 text-indigo-700'
      : 'bg-white border border-gray-200 hover:bg-gray-50';
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {sortedProfessionals.map((professional) => (
          <button
            key={professional.id}
            onClick={() => professional.id && onSelectProfessional(professional.id)}
            disabled={disabled || !professional.id}
            className={`
              px-4 py-3 rounded-md text-center transition-all flex flex-col items-center justify-center
              ${getButtonClass(selectedProfessionalId === professional.id, !!professional.id)}
            `}
            style={{
              borderLeftWidth: selectedProfessionalId === professional.id ? '4px' : '1px',
              borderLeftColor: professional.color || '#4F46E5'
            }}
          >
            <span className="font-medium text-sm block truncate">{professional.name}</span>
            {professional.role && (
              <span className="text-xs text-gray-500 block truncate">
                {professional.role}
              </span>
            )}
          </button>
        ))}
      </div>

      {professionals.length === 0 && (
        <div className="text-center py-3 bg-gray-50 rounded-md">
          <p className="text-gray-500">Nenhum profissional disponível</p>
        </div>
      )}
    </div>
  );
}
