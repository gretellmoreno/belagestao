import React, { useEffect, useState } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import PaymentMethodModal from './PaymentMethodModal';
import { PaymentMethodFormState } from '../../types/paymentTypes';

interface PaymentMethod {
  id: string;
  name: string;
  fee: number;
}

interface PaymentFeesProps {
  paymentMethods: Array<PaymentMethod>;
  setShowNewPaymentMethodModal?: (show: boolean) => void;
}

const PaymentFees: React.FC<PaymentFeesProps> = ({ paymentMethods }) => {
  const [localMethods, setLocalMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [currentMethod, setCurrentMethod] = useState<PaymentMethodFormState>({
    name: '',
    fee: ''
  });
  const [isUpdating, setIsUpdating] = useState(false);

  // Verificar dados recebidos via props
  console.log('PaymentFees - Renderizando com métodos:', paymentMethods);
  console.log('PaymentFees - Total de métodos recebidos:', paymentMethods?.length || 0);
  
  // Função para editar método de pagamento
  const handleEditPaymentMethod = (method: PaymentMethod) => {
    console.log('PaymentFees - Editando método:', method);
    setEditingMethod(method);
    setCurrentMethod({
      name: method.name,
      fee: method.fee.toString()
    });
    setShowModal(true);
  };

  // Função para excluir método de pagamento
  const handleDeletePaymentMethod = async (id: string) => {
    console.log('PaymentFees - Excluindo método ID:', id);
    if (!window.confirm('Tem certeza que deseja excluir este método de pagamento?')) {
      return;
    }
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('payment_methods')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      alert('Método de pagamento excluído com sucesso!');
      fetchPaymentMethods();
    } catch (error) {
      console.error('Erro ao excluir método de pagamento:', error);
      alert('Erro ao excluir método de pagamento. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Buscar métodos de pagamento
  const fetchPaymentMethods = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('id, name, fee')
        .order('name');
        
      if (error) throw error;
      
      console.log('PaymentFees - Métodos atualizados:', data);
      setLocalMethods(data || []);
    } catch (err) {
      console.error('Erro ao buscar métodos de pagamento:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Salvar método de pagamento
  const handleSavePaymentMethod = async () => {
    setIsUpdating(true);
    setFormErrors({});
    
    // Validar os campos
    const errors: Record<string, string> = {};
    
    if (!currentMethod.name.trim()) {
      errors.name = 'O nome é obrigatório';
    }
    
    if (!currentMethod.fee) {
      errors.fee = 'A taxa é obrigatória';
    } else {
      // Garantir que o valor seja convertido corretamente (de vírgula para ponto)
      const feeValue = parseFloat(currentMethod.fee.toString().replace(',', '.'));
      if (isNaN(feeValue) || feeValue < 0 || feeValue > 100) {
        errors.fee = 'Informe uma taxa válida (0-100%)';
      }
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setIsUpdating(false);
      return;
    }
    
    try {
      // Converter valor para número, garantindo que use ponto decimal
      const feeValue = parseFloat(currentMethod.fee.toString().replace(',', '.'));
      
      if (editingMethod) {
        // Atualizar método de pagamento existente
        const { error } = await supabase
          .from('payment_methods')
          .update({
            name: currentMethod.name.trim(),
            fee: feeValue,
          })
          .eq('id', editingMethod.id);
          
        if (error) throw error;
        alert('Método de pagamento atualizado com sucesso!');
      } else {
        // Criar novo método de pagamento
        const { error } = await supabase
          .from('payment_methods')
          .insert([{
            name: currentMethod.name.trim(),
            fee: feeValue,
          }]);
          
        if (error) throw error;
        alert('Método de pagamento registrado com sucesso!');
      }
      
      // Limpar formulário e fechar modal
      resetForm();
      setShowModal(false);
      
      // Atualizar lista de métodos de pagamento
      await fetchPaymentMethods();
    } catch (error) {
      console.error('Erro ao salvar método de pagamento:', error);
      alert(`Erro ao ${editingMethod ? 'atualizar' : 'registrar'} o método de pagamento. Tente novamente.`);
    } finally {
      setIsUpdating(false);
    }
  };
  
  // Fallback para buscar diretamente do Supabase caso não receba métodos via props
  useEffect(() => {
    const fetchPaymentMethodsDirectly = async () => {
      // Só busca diretamente se não tiver recebido métodos válidos via props
      if (Array.isArray(paymentMethods) && paymentMethods.length > 0) {
        setLocalMethods(paymentMethods);
        return;
      }
      
      console.log('PaymentFees - Buscando métodos diretamente do Supabase como fallback');
      await fetchPaymentMethods();
    };
    
    fetchPaymentMethodsDirectly();
  }, [paymentMethods]);
  
  // Reset do formulário
  const resetForm = () => {
    setCurrentMethod({
      name: '',
      fee: ''
    });
    setEditingMethod(null);
    setFormErrors({});
  };
  
  // Garante que sempre teremos um array, mesmo que a prop seja undefined
  const methods = localMethods.length > 0 ? localMethods : (paymentMethods || []);
  
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Taxas de Pagamento</h2>
          <div className="animate-pulse bg-gray-200 h-10 w-40 rounded"></div>
        </div>
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-2"></div>
          <div className="h-8 bg-gray-200 rounded mb-2"></div>
          <div className="h-8 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Taxas de Pagamento</h2>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="flex items-center px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4 mr-1" /> 
          Novo Método de Pagamento
        </button>
      </div>
      
      {methods.length === 0 ? (
        <div className="text-center py-4 text-gray-500">
          Nenhum método de pagamento cadastrado.
        </div>
      ) : (
        <div className="overflow-hidden border border-gray-200 sm:rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Método
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Taxa (%)
                </th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {methods.map((method) => (
                <tr key={method.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {method.name}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-right">
                    {method.fee !== undefined ? method.fee.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}%
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-right space-x-2">
                    <button
                      onClick={() => handleEditPaymentMethod(method)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      <Edit className="h-4 w-4 inline" />
                    </button>
                    <button
                      onClick={() => handleDeletePaymentMethod(method.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-4 w-4 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <PaymentMethodModal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            resetForm();
          }}
          isEditing={!!editingMethod}
          newPaymentMethod={currentMethod}
          setNewPaymentMethod={setCurrentMethod}
          formErrors={formErrors}
          handleSavePaymentMethod={handleSavePaymentMethod}
          isUpdating={isUpdating}
        />
      )}
    </div>
  );
};

export default PaymentFees; 