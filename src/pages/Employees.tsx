import React, { useState, useEffect, useRef } from 'react';
import { Search, UserPlus, X, Mail, Phone, DollarSign, AlertTriangle, Check, ChevronDown, Trash2 } from 'lucide-react';
import { 
  Professional, 
  getProfessionals, 
  createProfessional, 
  updateProfessional, 
  deleteProfessional 
} from '../lib/professionalService';
import { getServices, type Service } from '../lib/serviceService';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'react-hot-toast';

const colorOptions = [
  { name: 'Sem cor', value: '', textColor: 'text-gray-700' },
  { name: 'Roxo', value: '#8B5CF6', textColor: 'text-white' },
  { name: 'Verde', value: '#10B981', textColor: 'text-white' },
  { name: 'Laranja', value: '#F97316', textColor: 'text-white' },
  { name: 'Rosa', value: '#EC4899', textColor: 'text-white' },
  { name: 'Azul', value: '#3B82F6', textColor: 'text-white' },
  { name: 'Vermelho', value: '#EF4444', textColor: 'text-white' },
  { name: 'Amarelo', value: '#F59E0B', textColor: 'text-white' },
  { name: 'Ciano', value: '#06B6D4', textColor: 'text-white' },
  { name: 'Verde Limão', value: '#84CC16', textColor: 'text-white' },
  { name: 'Magenta', value: '#D946EF', textColor: 'text-white' },
  { name: 'Azul Marinho', value: '#2563EB', textColor: 'text-white' },
  { name: 'Coral', value: '#F43F5E', textColor: 'text-white' },
  { name: 'Esmeralda', value: '#059669', textColor: 'text-white' }
];

export default function Employees() {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [professionalToDelete, setProfessionalToDelete] = useState<Professional | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProfessional, setEditingProfessional] = useState<Professional | null>(null);
  
  const [newProfessional, setNewProfessional] = useState({
    name: '',
    role: '',
    phone: '',
    email: '',
    color: '',
    active: true,
    deduct_payment_fee: false
  });

  const [errors, setErrors] = useState({
    name: false,
    role: false,
    phone: false
  });

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    value = value.replace(/\D/g, '');
    
    if (value.length <= 11) {
      let maskedValue = value;
      if (value.length > 2) {
        maskedValue = `(${value.slice(0, 2)}) ${value.slice(2)}`;
      }
      if (value.length > 7) {
        maskedValue = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
      }
      setNewProfessional(prev => ({ ...prev, phone: maskedValue }));
    }
  };

  const handleEditClick = (professional: Professional) => {
    setEditingProfessional(professional);
    setNewProfessional({
      name: professional.name,
      role: professional.role,
      phone: professional.phone,
      email: professional.email,
      color: professional.color,
      active: professional.active,
      deduct_payment_fee: professional.deduct_payment_fee || false
    });
    setShowModal(true);
  };

  const handleDeleteClick = (professional: Professional) => {
    setProfessionalToDelete(professional);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (professionalToDelete) {
      try {
        setLoading(true);
        await deleteProfessional(professionalToDelete.id!);
        await loadProfessionals();
        setShowDeleteModal(false);
        setProfessionalToDelete(null);
        
        // Disparar evento para atualizar outros componentes
        window.dispatchEvent(new CustomEvent('professional_updated', {
          detail: {
            id: professionalToDelete.id,
            action: 'delete'
          }
        }));
        
        // Exibir mensagem de sucesso
        toast.success('Profissional excluído com sucesso!');
      } catch (err) {
        console.error('Error deleting professional:', err);
        setError('Erro ao excluir o profissional. Por favor, tente novamente.');
        toast.error('Erro ao excluir o profissional');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setErrors({
      name: false,
      role: false,
      phone: false
    });

    let hasErrors = false;
    if (!newProfessional.name.trim()) {
      setErrors(prev => ({ ...prev, name: true }));
      hasErrors = true;
    }
    if (!newProfessional.role.trim()) {
      setErrors(prev => ({ ...prev, role: true }));
      hasErrors = true;
    }
    if (!newProfessional.phone.trim()) {
      setErrors(prev => ({ ...prev, phone: true }));
      hasErrors = true;
    }

    if (hasErrors) return;

    try {
      setLoading(true);
      
      // Variável para armazenar o ID do profissional salvo
      let savedProfessionalId = '';
      
      if (editingProfessional) {
        const updatedProfessional = await updateProfessional(editingProfessional.id!, {
          name: newProfessional.name,
          role: newProfessional.role,
          phone: newProfessional.phone,
          email: newProfessional.email,
          color: newProfessional.color,
          active: newProfessional.active,
          deduct_payment_fee: newProfessional.deduct_payment_fee
        });
        savedProfessionalId = updatedProfessional.id || editingProfessional.id!;
      } else {
        const newProfessionalData = await createProfessional({
          name: newProfessional.name,
          role: newProfessional.role,
          phone: newProfessional.phone,
          email: newProfessional.email,
          color: newProfessional.color,
          active: newProfessional.active,
          deduct_payment_fee: newProfessional.deduct_payment_fee
        });
        savedProfessionalId = newProfessionalData.id || '';
      }
      
      await loadProfessionals();
      
      // Resetar o formulário
      setNewProfessional({
        name: '',
        role: '',
        phone: '',
        email: '',
        color: '',
        active: true,
        deduct_payment_fee: false
      });
      setShowModal(false);
      setEditingProfessional(null);
      
      // Disparar um evento personalizado para notificar outros componentes sobre a mudança
      window.dispatchEvent(new CustomEvent('professional_updated', {
        detail: {
          id: savedProfessionalId,
          action: editingProfessional ? 'update' : 'create'
        }
      }));
      
      // Exibir mensagem de sucesso
      toast.success(
        editingProfessional 
          ? 'Profissional atualizado com sucesso!' 
          : 'Profissional adicionado com sucesso!'
      );
    } catch (err) {
      console.error('Error saving professional:', err);
      setError('Erro ao salvar o profissional. Por favor, tente novamente.');
      toast.error('Erro ao salvar o profissional');
    } finally {
      setLoading(false);
    }
  };

  const loadProfessionals = async () => {
    try {
      setLoading(true);
      const data = await getProfessionals();
      setProfessionals(data);
      setError(null);
    } catch (err) {
      console.error('Error loading professionals:', err);
      setError('Erro ao carregar os profissionais. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [professionalsData, servicesData] = await Promise.all([
          getProfessionals(),
          getServices()
        ]);
        setProfessionals(professionalsData);
        setServices(servicesData.filter(service => service.active));
        setError(null);
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Erro ao carregar os dados. Por favor, tente novamente.');
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Configurar a subscription para mudanças na tabela professionals
    const subscription = supabase
      .channel('professionals-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'professionals'
      }, () => {
        // Quando qualquer alteração for feita na tabela de profissionais, recarregar os dados
        loadProfessionals();
      })
      .subscribe();

    // Limpar subscription quando o componente for desmontado
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const filteredProfessionals = professionals
    .filter(professional =>
      professional.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      professional.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      professional.phone.includes(searchTerm) ||
      professional.email.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  return (
    <div className="space-y-4">
      <div className="bg-white p-3 sm:p-5 rounded-lg shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Profissionais</h1>
            <p className="mt-0.5 text-xs text-gray-500">Gerencie sua equipe de profissionais</p>
          </div>
          <button 
            onClick={() => {
              setEditingProfessional(null);
              setNewProfessional({
                name: '',
                role: '',
                phone: '',
                email: '',
                color: '',
                active: true,
                deduct_payment_fee: false
              });
              setShowModal(true);
            }}
            className="bg-gradient-to-r from-indigo-600 to-indigo-500 text-white px-4 py-2 rounded-lg 
              hover:from-indigo-700 hover:to-indigo-600 transition-colors duration-200 
              flex items-center justify-center text-sm shadow-sm active:transform active:scale-95"
          >
            <UserPlus className="h-4 w-4 mr-1.5" />
            Novo Profissional
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md flex items-start text-xs">
          <AlertTriangle className="h-4 w-4 mr-1.5 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-3 border-solid border-indigo-600 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-2 text-sm text-gray-600">Carregando profissionais...</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-3 sm:p-4 border-b border-gray-100">
            <div className="w-full">
              <label htmlFor="search" className="block text-xs font-medium text-gray-700 mb-1.5">
                Buscar Profissionais
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  id="search"
                  type="text"
                  className="block w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg
                    leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-1
                    focus:ring-indigo-500 focus:border-transparent text-sm"
                  placeholder="Buscar por nome, função, telefone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3 sm:p-4">
            {filteredProfessionals.map((professional) => (
              <div key={professional.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      {professional.color && (
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: professional.color }}
                        />
                      )}
                      <div>
                        <h3 className="text-sm font-medium text-gray-900 line-clamp-1">{professional.name}</h3>
                        <p className="text-xs text-gray-500">{professional.role}</p>
                      </div>
                    </div>
                    <div className={`h-2 w-2 rounded-full ${professional.active ? 'bg-green-500' : 'bg-red-500'}`} />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center text-xs text-gray-500">
                      <Phone className="h-3 w-3 mr-1.5 flex-shrink-0" />
                      <span className="truncate">{professional.phone}</span>
                    </div>
                    {professional.email && (
                      <div className="flex items-center text-xs text-gray-500">
                        <Mail className="h-3 w-3 mr-1.5 flex-shrink-0" />
                        <span className="truncate">{professional.email}</span>
                      </div>
                    )}
                    {professional.deduct_payment_fee && (
                      <div className="flex items-center text-xs text-amber-600">
                        <DollarSign className="h-3 w-3 mr-1.5 flex-shrink-0" />
                        <span className="text-[10px]">Taxa de pagamento descontada da comissão</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      onClick={() => handleEditClick(professional)}
                      className="px-2.5 py-1 text-xs text-indigo-600 hover:text-indigo-900 bg-indigo-50 rounded-md transition-colors duration-200"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeleteClick(professional)}
                      className="px-2.5 py-1 text-xs text-red-600 hover:text-red-900 bg-red-50 rounded-md transition-colors duration-200"
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-2 max-h-[95vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b z-10">
              <div className="flex items-center justify-between p-3">
                <div>
                  <h3 className="text-base font-medium text-gray-900">
                    {editingProfessional ? 'Editar Profissional' : 'Novo Profissional'}
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-500">Preencha os dados do profissional</p>
                </div>
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingProfessional(null);
                  }}
                  className="text-gray-400 hover:text-gray-500 transition-colors p-2 hover:bg-gray-100 rounded-full"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-3">
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label htmlFor="name" className="block text-xs font-medium text-gray-700 mb-1">
                      Nome<span className="text-red-500 ml-1">*</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={newProfessional.name}
                      onChange={(e) => setNewProfessional(prev => ({ ...prev, name: e.target.value }))}
                      className={`block w-full rounded-lg shadow-sm text-sm py-1.5 px-2 ${
                        errors.name
                          ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                          : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
                      }`}
                      placeholder="Digite o nome completo"
                    />
                    {errors.name && (
                      <p className="mt-1 text-xs text-red-600">Nome é obrigatório</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="role" className="block text-xs font-medium text-gray-700 mb-1">
                      Função<span className="text-red-500 ml-1">*</span>
                    </label>
                    <input
                      type="text"
                      id="role"
                      value={newProfessional.role}
                      onChange={(e) => setNewProfessional(prev => ({ ...prev, role: e.target.value }))}
                      className={`block w-full rounded-lg shadow-sm text-sm py-1.5 px-2 ${
                        errors.role
                          ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                          : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
                      }`}
                      placeholder="Ex: Cabeleireiro, Barbeiro..."
                    />
                    {errors.role && (
                      <p className="mt-1 text-xs text-red-600">Função é obrigatória</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-xs font-medium text-gray-700 mb-1">
                      Telefone<span className="text-red-500 ml-1">*</span>
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      value={newProfessional.phone}
                      onChange={handlePhoneChange}
                      maxLength={15}
                      className={`block w-full rounded-lg shadow-sm text-sm py-1.5 px-2 ${
                        errors.phone
                          ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                          : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
                      }`}
                      placeholder="(00) 00000-0000"
                    />
                    {errors.phone && (
                      <p className="mt-1 text-xs text-red-600">Telefone é obrigatório</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-xs font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={newProfessional.email}
                      onChange={(e) => setNewProfessional(prev => ({ ...prev, email: e.target.value }))}
                      className="block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm py-1.5 px-2"
                      placeholder="email@exemplo.com"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <div className="flex items-center space-x-4">
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          checked={newProfessional.active}
                          onChange={() => setNewProfessional(prev => ({ ...prev, active: true }))}
                          className="h-3 w-3 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                        />
                        <span className="ml-1.5 text-xs">Ativo</span>
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          checked={!newProfessional.active}
                          onChange={() => setNewProfessional(prev => ({ ...prev, active: false }))}
                          className="h-3 w-3 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                        />
                        <span className="ml-1.5 text-xs">Inativo</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="deduct_payment_fee"
                        checked={newProfessional.deduct_payment_fee}
                        onChange={(e) => setNewProfessional(prev => ({ ...prev, deduct_payment_fee: e.target.checked }))}
                        className="h-3.5 w-3.5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <label htmlFor="deduct_payment_fee" className="text-xs font-medium text-gray-700">
                        Descontar taxa de pagamento
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Cor do profissional
                    </label>
                    <div className="grid grid-cols-8 gap-1.5">
                      {colorOptions.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          onClick={() => setNewProfessional(prev => ({ ...prev, color: color.value }))}
                          className={`
                            w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110
                            ${color.value ? '' : 'border border-gray-300'}
                            ${newProfessional.color === color.value ? 'ring-1 ring-offset-1 ring-indigo-500' : ''}
                          `}
                          style={{ backgroundColor: color.value || 'transparent' }}
                          title={color.name}
                        >
                          {newProfessional.color === color.value && (
                            <Check className={`h-3 w-3 ${color.textColor}`} />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingProfessional(null);
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 
                    rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-500 border 
                    border-transparent rounded-lg hover:from-indigo-700 hover:to-indigo-600 transition-colors duration-200
                    shadow-sm hover:shadow active:transform active:scale-95"
                >
                  {editingProfessional ? 'Salvar Alterações' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && professionalToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-xs mx-auto p-4">
            <div className="flex items-center justify-center mb-3">
              <div className="bg-red-100 rounded-full p-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
            </div>
            <h3 className="text-sm font-medium text-gray-900 text-center mb-1.5">
              Confirmar Exclusão
            </h3>
            <p className="text-xs text-gray-500 text-center mb-4">
              Tem certeza que deseja excluir o profissional <strong>{professionalToDelete.name}</strong>? 
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setProfessionalToDelete(null);
                }}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border 
                  border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 border 
                  border-transparent rounded-lg hover:bg-red-700"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}