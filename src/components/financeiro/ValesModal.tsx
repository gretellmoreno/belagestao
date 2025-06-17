import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { NumericFormat } from 'react-number-format';
import { Professional } from '../../hooks/useFinanceiroData';

interface ValesModalProps {
  isOpen: boolean;
  onClose: () => void;
  isEditing: boolean;
  newVale: {
    date: string;
    amount: string;
    professional_id: string;
  };
  setNewVale: React.Dispatch<React.SetStateAction<{
    date: string;
    amount: string;
    professional_id: string;
  }>>;
  professionals: Professional[];
  formErrors: Record<string, string>;
  handleSaveVale: () => Promise<void>;
  isUpdating: boolean;
}

export const ValesModal: React.FC<ValesModalProps> = ({
  isOpen,
  onClose,
  isEditing,
  newVale,
  setNewVale,
  professionals,
  formErrors,
  handleSaveVale,
  isUpdating
}) => {
  // Estado local para controlar o valor formatado
  const [formattedValue, setFormattedValue] = useState('');

  // Atualizar o valor formatado quando o valor do vale mudar
  useEffect(() => {
    if (newVale.amount) {
      // Converter para número e então para string formatada
      const numValue = Number(newVale.amount);
      if (!isNaN(numValue)) {
        setFormattedValue(numValue.toString());
      }
    } else {
      setFormattedValue('');
    }
  }, [newVale.amount]);
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative">
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-500"
        >
          <X className="h-5 w-5" />
        </button>
        
        <h3 className="text-lg font-medium text-gray-900 mb-5">
          {isEditing ? 'Editar Vale' : 'Registrar Novo Vale'}
        </h3>
        
        <div className="space-y-4">
          {/* Campo de Data */}
          <div>
            <label htmlFor="vale-date" className="block text-sm font-medium text-gray-700 mb-1">
              Data
            </label>
            <input
              type="date"
              id="vale-date"
              value={newVale.date}
              onChange={(e) => setNewVale(prev => ({ ...prev, date: e.target.value }))}
              className={`w-full px-3 py-2 border ${formErrors.date ? 'border-red-300' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
            />
            {formErrors.date && (
              <p className="mt-1 text-xs text-red-600">{formErrors.date}</p>
            )}
          </div>
          
          {/* Campo de Profissional */}
          <div>
            <label htmlFor="vale-professional" className="block text-sm font-medium text-gray-700 mb-1">
              Profissional
            </label>
            <select
              id="vale-professional"
              value={newVale.professional_id}
              onChange={(e) => setNewVale(prev => ({ ...prev, professional_id: e.target.value }))}
              className={`w-full px-3 py-2 border ${formErrors.professional_id ? 'border-red-300' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
            >
              <option value="">Selecione um profissional</option>
              {professionals.map((prof) => (
                <option key={prof.id} value={prof.id}>
                  {prof.name}
                </option>
              ))}
            </select>
            {formErrors.professional_id && (
              <p className="mt-1 text-xs text-red-600">{formErrors.professional_id}</p>
            )}
          </div>
          
          {/* Campo de Valor */}
          <div>
            <label htmlFor="vale-amount" className="block text-sm font-medium text-gray-700 mb-1">
              Valor
            </label>
            <NumericFormat
              id="vale-amount"
              value={formattedValue}
              onValueChange={(values) => {
                console.log('Valores do NumericFormat:', {
                  formattedValue: values.formattedValue,
                  value: values.value,
                  floatValue: values.floatValue
                });
                
                // Usar o floatValue (valor já convertido para número) se disponível
                const newValue = values.floatValue !== undefined ? String(values.floatValue) : values.value;
                
                // Atualizar o valor no estado
                setNewVale(prev => ({ ...prev, amount: newValue }));
                // Atualizar também o valor formatado local
                setFormattedValue(values.value);
              }}
              thousandSeparator="."
              decimalSeparator=","
              prefix="R$ "
              decimalScale={2}
              allowNegative={false}
              placeholder="R$ 0,00"
              className={`w-full px-3 py-2 border ${formErrors.amount ? 'border-red-300' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm`}
            />
            {/* Adicionar um debug para visualizar o valor atual */}
            <p className="mt-1 text-xs text-gray-500">
              Valor atual: {newVale.amount ? `${newVale.amount} (será salvo como ${Number(newVale.amount)})` : 'Nenhum valor inserido'}
            </p>
            {formErrors.amount && (
              <p className="mt-1 text-xs text-red-600">{formErrors.amount}</p>
            )}
          </div>
          
          {/* Botões de Ação */}
          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveVale}
              disabled={isUpdating}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdating ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Salvando...
                </span>
              ) : (
                isEditing ? 'Atualizar Vale' : 'Registrar Vale'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ValesModal; 