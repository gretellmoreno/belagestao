import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { NumericFormat } from 'react-number-format';
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'react-hot-toast';

type Props = {
  onClose: () => void;
};

export const NovoValeModal = ({ onClose }: Props) => {
  const [professionals, setProfessionals] = useState<{ id: string; name: string }[]>([]);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    professional_id: '',
    amount: ''
  });
  const [formattedValue, setFormattedValue] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [useSimpleVersion, setUseSimpleVersion] = useState(false);

  console.log("NovoValeModal renderizado");

  // Carregar a lista de profissionais ao abrir o modal
  useEffect(() => {
    console.log("NovoValeModal useEffect executado");
    try {
      fetchProfessionals();
    } catch (error) {
      console.error("Erro ao carregar profissionais:", error);
      setUseSimpleVersion(true);
    }
  }, []);

  // Se ocorrer algum erro, mostrar a versão simples
  if (useSimpleVersion) {
    return (
      <div 
        style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.5)', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          zIndex: 99999
        }}
      >
        <div 
          style={{ 
            backgroundColor: 'white', 
            padding: 20, 
            borderRadius: 8, 
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
            width: '80%',
            maxWidth: 400
          }}
        >
          <h2 style={{ marginBottom: 16 }}>Novo Vale (Versão Simples)</h2>
          <p style={{ marginBottom: 16 }}>Houve um problema ao carregar o modal completo. Esta é uma versão simplificada.</p>
          <button 
            onClick={onClose} 
            style={{ 
              padding: '8px 16px', 
              backgroundColor: '#4f46e5', 
              color: 'white', 
              border: 'none', 
              borderRadius: 4, 
              cursor: 'pointer' 
            }}
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  // Buscar profissionais do Supabase
  const fetchProfessionals = async () => {
    try {
      const { data, error } = await supabase
        .from('professionals')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setProfessionals(data || []);
    } catch (error) {
      console.error('Erro ao buscar profissionais:', error);
      toast.error('Não foi possível carregar a lista de profissionais.');
    }
  };

  // Função para validar e salvar o vale
  const handleSaveVale = async () => {
    setIsLoading(true);
    setFormErrors({});
    
    // Validar os campos
    const errors: Record<string, string> = {};
    
    if (!formData.date) {
      errors.date = 'A data é obrigatória';
    }
    
    if (!formData.professional_id) {
      errors.professional_id = 'Selecione um profissional';
    }
    
    // Validação do valor
    let numericAmount = 0;
    if (!formData.amount) {
      errors.amount = 'Informe um valor válido';
    } else {
      try {
        numericAmount = Number(formData.amount);
        
        if (isNaN(numericAmount)) {
          const cleanValue = formData.amount
            .replace(/[R$\s]/g, '') // Remover R$ e espaços
            .replace(/\./g, '')     // Remover pontos (separadores de milhar)
            .replace(',', '.');     // Substituir vírgula por ponto
            
          numericAmount = Number(cleanValue);
        }
        
        if (isNaN(numericAmount) || numericAmount <= 0) {
          errors.amount = 'Valor inválido';
        }
      } catch (e) {
        console.error('Erro ao converter valor:', e);
        errors.amount = 'Formato de valor inválido';
      }
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setIsLoading(false);
      return;
    }
    
    try {
      // Inserir novo vale na tabela professional_advances
      const { error } = await supabase
        .from('professional_advances')
        .insert([{
          professional_id: formData.professional_id,
          value: numericAmount,
          created_at: new Date(formData.date).toISOString()
        }]);
        
      if (error) {
        console.error("Erro detalhado ao salvar vale:", error);
        throw error;
      }
      
      toast.success('Vale registrado com sucesso!');
      onClose(); // Fechar o modal após o sucesso
    } catch (error) {
      console.error('Erro ao salvar vale:', error);
      toast.error('Erro ao registrar o vale. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-[9999]" style={{ zIndex: 9999 }}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 relative border-2 border-indigo-500">
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-500"
        >
          <X className="h-5 w-5" />
        </button>
        
        <h3 className="text-lg font-medium text-gray-900 mb-5">
          Registrar Novo Vale
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
              value={formData.date}
              onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
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
              value={formData.professional_id}
              onChange={(e) => setFormData(prev => ({ ...prev, professional_id: e.target.value }))}
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
                const newValue = values.floatValue !== undefined ? String(values.floatValue) : values.value;
                setFormData(prev => ({ ...prev, amount: newValue }));
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
              disabled={isLoading}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Salvando...
                </span>
              ) : (
                'Registrar Vale'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}; 