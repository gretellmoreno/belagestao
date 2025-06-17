import React, { useState, useEffect } from 'react';
import { X, Percent } from 'lucide-react';
import { PaymentMethodFormState } from '../../types/paymentTypes';

interface PaymentMethodModalProps {
  isOpen: boolean;
  onClose: () => void;
  isEditing: boolean;
  newPaymentMethod: PaymentMethodFormState;
  setNewPaymentMethod: (method: PaymentMethodFormState) => void;
  formErrors: Record<string, string>;
  handleSavePaymentMethod: () => void;
  isUpdating: boolean;
}

const PaymentMethodModal: React.FC<PaymentMethodModalProps> = ({
  isOpen,
  onClose,
  isEditing,
  newPaymentMethod,
  setNewPaymentMethod,
  formErrors,
  handleSavePaymentMethod,
  isUpdating
}) => {
  const [taxaFormatada, setTaxaFormatada] = useState('0,00');
  
  // Ao receber um novo valor de taxa, formata para exibição
  useEffect(() => {
    if (newPaymentMethod && newPaymentMethod.fee) {
      // Converte para número e formata para exibição
      const valor = parseFloat(newPaymentMethod.fee.toString().replace(',', '.'));
      if (!isNaN(valor)) {
        const formatted = valor.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
        setTaxaFormatada(formatted);
      }
    } else {
      setTaxaFormatada('0,00');
    }
  }, [newPaymentMethod]);
  
  // Manipulador para o campo de taxa
  const handleTaxaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valorDigitado = e.target.value.replace(/\D/g, ''); // Remove tudo exceto números
    
    // Converte para decimal com duas casas
    const valorNumerico = parseFloat(valorDigitado) / 100;
    
    // Formata para exibição no formato brasileiro
    const valorFormatado = valorNumerico.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    
    // Atualiza o estado visual
    setTaxaFormatada(valorFormatado);
    
    // Atualiza o valor no estado do método de pagamento (em formato ponto decimal)
    setNewPaymentMethod({
      ...newPaymentMethod,
      fee: valorNumerico.toString()
    });
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 sm:mx-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">
            {isEditing ? 'Editar Método de Pagamento' : 'Adicionar Método de Pagamento'}
          </h3>
          <button
            onClick={onClose}
            className="rounded-full h-8 w-8 flex items-center justify-center text-gray-400 hover:text-gray-500 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Fechar</span>
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="space-y-4">
            <div>
              <label htmlFor="payment-method-name" className="block text-sm font-medium text-gray-700 mb-1">
                Nome do Método
              </label>
              <input
                type="text"
                id="payment-method-name"
                className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm ${formErrors.name ? 'border-red-300' : ''}`}
                placeholder="Ex: Cartão de crédito"
                value={newPaymentMethod.name}
                onChange={(e) => setNewPaymentMethod({ ...newPaymentMethod, name: e.target.value })}
              />
              {formErrors.name && (
                <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
              )}
            </div>
            
            <div className="mt-4">
              <label htmlFor="fee" className="block text-sm font-medium text-gray-700">
                Taxa (%)
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Percent className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  name="fee"
                  id="fee"
                  placeholder="0,00"
                  className={`block w-full pl-10 pr-12 py-2 sm:text-sm border ${
                    formErrors.fee ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
                  } rounded-md`}
                  value={taxaFormatada}
                  onChange={handleTaxaChange}
                />
              </div>
              {formErrors.fee && (
                <p className="mt-2 text-sm text-red-600">{formErrors.fee}</p>
              )}
              <p className="mt-2 text-xs text-gray-500">
                Digite a taxa cobrada para este método de pagamento. Por exemplo, para 3,5%, digite 3,5
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 bg-gray-50 flex justify-end space-x-2 rounded-b-lg">
          <button
            onClick={onClose}
            className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Cancelar
          </button>
          <button
            onClick={handleSavePaymentMethod}
            disabled={isUpdating}
            className={`inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm ${
              isUpdating 
                ? 'bg-indigo-400 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'
            }`}
          >
            {isUpdating ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Salvando...
              </>
            ) : isEditing ? 'Salvar Alterações' : 'Adicionar Método'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentMethodModal; 