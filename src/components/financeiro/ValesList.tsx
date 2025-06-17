import React from 'react';
import { format, parseISO } from 'date-fns';
import { Receipt, Plus } from 'lucide-react';
import { EmployeeAdvance } from '../../hooks/useFinanceiroData';
import { formatCurrency } from '../../lib/financeiroUtils';

interface ValesListProps {
  vales: EmployeeAdvance[];
  // Novos formatos (ValesPage)
  handleEditVale?: (id: string) => void;
  handleDeleteVale?: (id: string) => void;
  setShowNewValeModal?: (() => void) | ((show: boolean) => void);
  // Formatos antigos (Financeiro/index.tsx)
  onEditVale?: (vale: EmployeeAdvance) => void;
  onDeleteVale?: (id: string) => void;
  isLoading?: boolean;
}

export const ValesList: React.FC<ValesListProps> = ({
  vales,
  handleEditVale,
  handleDeleteVale,
  setShowNewValeModal,
  onEditVale,
  onDeleteVale,
  isLoading
}) => {
  // Funções auxiliares para tratar ambos os formatos de props
  const handleEdit = (vale: EmployeeAdvance) => {
    if (handleEditVale) {
      handleEditVale(vale.id);
    } else if (onEditVale) {
      onEditVale(vale);
    }
  };

  const handleDelete = (id: string) => {
    if (handleDeleteVale) {
      handleDeleteVale(id);
    } else if (onDeleteVale) {
      onDeleteVale(id);
    }
  };

  const handleShowModal = () => {
    if (setShowNewValeModal) {
      console.log("Chamando setShowNewValeModal");
      // Verificar se a função recebe um argumento ou não
      try {
        if (setShowNewValeModal.length === 0) {
          (setShowNewValeModal as () => void)();
        } else {
          (setShowNewValeModal as (show: boolean) => void)(true);
        }
        console.log("setShowNewValeModal chamado com sucesso");
      } catch (error) {
        console.error("Erro ao chamar setShowNewValeModal:", error);
        // Tentar chamar sem argumentos como fallback
        try {
          (setShowNewValeModal as any)();
        } catch (e) {
          console.error("Falha no fallback:", e);
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <Receipt className="h-5 w-5 mr-2 text-indigo-500" />
            Vales Registrados
          </h3>
          <button
            onClick={handleShowModal}
            className="inline-flex items-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
          >
            <Plus className="h-4 w-4 mr-2" />
            Registrar Vale
          </button>
        </div>
        
        {/* Lista de vales - versão desktop */}
        <div className="hidden md:block overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                  Data
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Profissional
                </th>
                <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                  Valor
                </th>
                <th scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900">
                  Status
                </th>
                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {vales.map((vale) => (
                <tr key={vale.id} className={vale.discounted ? 'bg-gray-50' : ''}>
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-500 sm:pl-6">
                    {new Date(vale.date).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                    {vale.professional?.name || '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 text-right">
                    {Number(vale.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-center">
                    {vale.discounted ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Descontado
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Pendente
                      </span>
                    )}
                  </td>
                  <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    <button
                      onClick={() => handleEdit(vale)}
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                      disabled={isLoading || vale.discounted}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(vale.id)}
                      className="text-red-600 hover:text-red-900"
                      disabled={isLoading}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
              {vales.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-4 text-gray-500">
                    Nenhum vale registrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Lista de vales - versão mobile (cards) */}
        <div className="md:hidden">
          {vales.length === 0 ? (
            <div className="text-center py-8 px-4 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex flex-col items-center">
                <Receipt className="h-10 w-10 text-gray-400 mb-2" />
                <p className="text-sm font-medium">Nenhum vale registrado</p>
                <p className="text-xs text-gray-400 mt-1">Clique em "Registrar Vale" para adicionar um novo vale</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {vales.map((vale) => (
                <div key={vale.id} className={`rounded-lg border shadow-sm overflow-hidden ${vale.discounted ? 'bg-gray-50 border-gray-300' : 'bg-white border-gray-200'}`}>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center">
                        <Receipt className="h-5 w-5 text-indigo-600 mr-2" />
                        <span className="text-sm font-medium text-gray-900">
                          {new Date(vale.date).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {vale.discounted ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Descontado
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            Pendente
                          </span>
                        )}
                        <span className="text-sm font-semibold text-gray-900">
                          {Number(vale.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">
                        {vale.professional?.name || '—'}
                      </span>
                      <div className="flex space-x-1">
                        <button
                          onClick={() => handleEdit(vale)}
                          className="px-2 py-1 text-xs text-indigo-700 bg-indigo-50 rounded-md"
                          disabled={isLoading || vale.discounted}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(vale.id)}
                          className="px-2 py-1 text-xs text-red-700 bg-red-50 rounded-md"
                          disabled={isLoading}
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ValesList; 