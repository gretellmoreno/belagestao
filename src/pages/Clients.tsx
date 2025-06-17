import React, { useState, useEffect } from 'react';
import { Search, UserPlus, X, Mail, Phone, User, CreditCard, AlertTriangle, Calendar } from 'lucide-react';
import { 
  Client,
  getClients,
  createClient,
  updateClient,
  deleteClient
} from '../lib/clientService';

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const [newClient, setNewClient] = useState({
    name: '',
    phone: '',
    email: '',
    cpf: '',
    birth_date: ''
  });

  const [errors, setErrors] = useState({
    name: false,
    phone: false
  });

  // Função para carregar os clientes
  const loadClients = async () => {
    try {
      setLoading(true);
      // Carregar os clientes
      const data = await getClients();
      setClients(data);
      setError(null);
    } catch (err) {
      console.error('Error loading clients:', err);
      setError('Erro ao carregar os clientes. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Carregar os clientes ao montar o componente
  useEffect(() => {
    loadClients();
  }, []);

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
      setNewClient(prev => ({ ...prev, phone: maskedValue }));
    }
  };

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    value = value.replace(/\D/g, '');
    
    if (value.length <= 11) {
      let maskedValue = value;
      if (value.length > 3) {
        maskedValue = `${value.slice(0, 3)}.${value.slice(3)}`;
      }
      if (value.length > 6) {
        maskedValue = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6)}`;
      }
      if (value.length > 9) {
        maskedValue = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9)}`;
      }
      setNewClient(prev => ({ ...prev, cpf: maskedValue }));
    }
  };

  const handleEditClick = (client: Client) => {
    setEditingClient(client);
    setNewClient({
      name: client.name,
      phone: client.phone,
      email: client.email || '',
      cpf: client.cpf || '',
      birth_date: client.birth_date || ''
    });
    setShowModal(true);
  };

  const handleDeleteClick = (client: Client) => {
    setClientToDelete(client);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (clientToDelete) {
      try {
        setLoading(true);
        await deleteClient(clientToDelete.id!);
        await loadClients();
        setShowDeleteModal(false);
        setClientToDelete(null);
      } catch (err) {
        console.error('Error deleting client:', err);
        setError('Erro ao excluir o cliente. Por favor, tente novamente.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setErrors({
      name: false,
      phone: false
    });

    let hasErrors = false;
    if (!newClient.name.trim()) {
      setErrors(prev => ({ ...prev, name: true }));
      hasErrors = true;
    }
    if (!newClient.phone.trim()) {
      setErrors(prev => ({ ...prev, phone: true }));
      hasErrors = true;
    }

    if (hasErrors) return;

    try {
      setLoading(true);
      if (editingClient) {
        await updateClient(editingClient.id!, {
          name: newClient.name,
          phone: newClient.phone,
          email: newClient.email,
          cpf: newClient.cpf,
          birth_date: newClient.birth_date
        });
      } else {
        await createClient({
          name: newClient.name,
          phone: newClient.phone,
          email: newClient.email,
          cpf: newClient.cpf,
          birth_date: newClient.birth_date
        });
      }
      
      await loadClients();
      
      setNewClient({
        name: '',
        phone: '',
        email: '',
        cpf: '',
        birth_date: ''
      });
      setShowModal(false);
      setEditingClient(null);
    } catch (err) {
      console.error('Error saving client:', err);
      setError('Erro ao salvar o cliente. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients
    .filter(client =>
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.phone.includes(searchTerm) ||
      (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (client.cpf && client.cpf.includes(searchTerm))
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Clientes</h1>
            <p className="mt-1 text-sm text-gray-500">Gerencie seus clientes e histórico de visitas</p>
          </div>
          <button 
            onClick={() => {
              setEditingClient(null);
              setNewClient({ name: '', phone: '', email: '', cpf: '', birth_date: '' });
              setShowModal(true);
            }}
            className="bg-gradient-to-r from-indigo-600 to-indigo-500 text-white px-4 py-2.5 rounded-lg hover:from-indigo-700 hover:to-indigo-600 
              transition-all duration-200 flex items-center justify-center
              shadow-sm hover:shadow-md active:transform active:scale-95 w-full sm:w-auto"
          >
            <UserPlus className="h-5 w-5 mr-2" />
            Novo Cliente
          </button>
        </div>
      </div>

      {/* Search and Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-gray-100">
          <div className="w-full">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
              Buscar Clientes
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                id="search"
                type="text"
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg
                  leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2
                  focus:ring-indigo-500 focus:border-transparent transition-shadow duration-200"
                placeholder="Busque por nome, telefone, email ou CPF..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Lista de Clientes - Mobile */}
        <div className="md:hidden divide-y divide-gray-200">
          {filteredClients.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              Nenhum cliente encontrado.
            </div>
          ) : (
            filteredClients.map((client) => (
              <div key={client.id} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center">
                      <User className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div className="ml-3">
                      <div className="text-base font-medium text-gray-900">{client.name}</div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2 ml-2">
                  <div className="flex items-center text-sm text-gray-500">
                    <Phone className="h-4 w-4 mr-2 text-indigo-400" />
                    {client.phone}
                  </div>
                  
                  {client.email && (
                    <div className="flex items-center text-sm text-gray-500">
                      <Mail className="h-4 w-4 mr-2 text-indigo-400" />
                      {client.email}
                    </div>
                  )}
                </div>
                
                <div className="mt-4 flex justify-end space-x-2">
                  <button 
                    onClick={() => handleEditClick(client)}
                    className="flex-1 text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg hover:bg-indigo-100 transition-colors duration-200 text-sm flex items-center justify-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Editar
                  </button>
                  <button 
                    onClick={() => handleDeleteClick(client)}
                    className="flex-1 text-red-600 bg-red-50 px-3 py-2 rounded-lg hover:bg-red-100 transition-colors duration-200 text-sm flex items-center justify-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Excluir
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Tabela de Clientes - Desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Telefone
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                  Email
                </th>
                <th className="relative px-6 py-4">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredClients.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50 transition-colors duration-150">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center">
                          <User className="h-5 w-5 text-indigo-600" />
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{client.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-500">
                      <Phone className="h-4 w-4 mr-2 text-gray-400" />
                      {client.phone}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                    <div className="flex items-center text-sm text-gray-500">
                      <Mail className="h-4 w-4 mr-2 text-gray-400" />
                      {client.email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button 
                      onClick={() => handleEditClick(client)}
                      className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-1 rounded-md mr-2 transition-colors duration-200"
                    >
                      Editar
                    </button>
                    <button 
                      onClick={() => handleDeleteClick(client)}
                      className="text-red-600 hover:text-red-900 bg-red-50 px-3 py-1 rounded-md transition-colors duration-200"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Novo/Editar Cliente */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-3 sm:p-4 border-b">
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
                </h3>
                <p className="mt-0.5 text-xs text-gray-500">Preencha os dados do cliente</p>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingClient(null);
                }}
                className="text-gray-400 hover:text-gray-500 transition-colors p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-3 sm:p-4 overflow-y-auto">
              {/* Mensagem de campos obrigatórios */}
              <div className="mb-4 flex items-center text-xs text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-200">
                <span className="text-red-500 font-bold mr-1.5">*</span>
                <span>Campos Obrigatórios</span>
              </div>

              <div className="space-y-4">
                {/* Nome */}
                <div>
                  <label htmlFor="name" className="block text-xs font-medium text-gray-700 mb-1 flex items-center">
                    Nome
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="name"
                      value={newClient.name}
                      onChange={(e) => setNewClient(prev => ({ ...prev, name: e.target.value }))}
                      className={`pl-9 block w-full rounded-lg shadow-sm text-sm py-2 ${
                        errors.name
                          ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                          : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
                      }`}
                      placeholder="Digite o nome completo"
                    />
                  </div>
                  {errors.name && (
                    <p className="mt-1 text-xs text-red-600">Nome é obrigatório</p>
                  )}
                </div>

                {/* Telefone */}
                <div>
                  <label htmlFor="phone" className="block text-xs font-medium text-gray-700 mb-1 flex items-center">
                    Telefone
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="tel"
                      id="phone"
                      value={newClient.phone}
                      onChange={handlePhoneChange}
                      maxLength={15}
                      className={`pl-9 block w-full rounded-lg shadow-sm text-sm py-2 ${
                        errors.phone
                          ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                          : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
                      }`}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  {errors.phone && (
                    <p className="mt-1 text-xs text-red-600">Telefone é obrigatório</p>
                  )}
                </div>

                {/* Campos opcionais com rótulo explícito */}
                <div className="pt-3 border-t border-gray-200">
                  <details className="group">
                    <summary className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 cursor-pointer flex items-center">
                      <span>Campos Opcionais</span>
                      <svg 
                        className="ml-1.5 h-4 w-4 text-gray-400 group-open:rotate-180 transition-transform" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </summary>

                    <div className="space-y-4 mt-2">
                      {/* CPF */}
                      <div>
                        <label htmlFor="cpf" className="block text-xs font-medium text-gray-700 mb-1">
                          CPF
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <CreditCard className="h-4 w-4 text-gray-400" />
                          </div>
                          <input
                            type="text"
                            id="cpf"
                            value={newClient.cpf}
                            onChange={handleCPFChange}
                            maxLength={14}
                            className="pl-9 block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm py-2"
                            placeholder="000.000.000-00"
                          />
                        </div>
                      </div>

                      {/* Email */}
                      <div>
                        <label htmlFor="email" className="block text-xs font-medium text-gray-700 mb-1">
                          Email
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Mail className="h-4 w-4 text-gray-400" />
                          </div>
                          <input
                            type="email"
                            id="email"
                            value={newClient.email}
                            onChange={(e) => setNewClient(prev => ({ ...prev, email: e.target.value }))}
                            className="pl-9 block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm py-2"
                            placeholder="email@exemplo.com"
                          />
                        </div>
                      </div>

                      {/* Data de Nascimento */}
                      <div>
                        <label htmlFor="birth_date" className="block text-xs font-medium text-gray-700 mb-1">
                          Data de Nascimento
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Calendar className="h-4 w-4 text-gray-400" />
                          </div>
                          <input
                            type="date"
                            id="birth_date"
                            value={newClient.birth_date}
                            onChange={(e) => setNewClient(prev => ({ ...prev, birth_date: e.target.value }))}
                            className="pl-9 block w-full rounded-lg border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm py-2 pr-3 appearance-none" 
                            style={{ 
                              backgroundImage: 'none',    // Remove o ícone nativo do calendário
                              colorScheme: 'light'        // Usa o esquema de cores claro
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </details>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingClient(null);
                  }}
                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 
                    rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-indigo-500 border 
                    border-transparent rounded-lg hover:from-indigo-700 hover:to-indigo-600 transition-colors duration-200
                    shadow-sm hover:shadow active:transform active:scale-95"
                >
                  {editingClient ? 'Salvar Alterações' : 'Salvar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {showDeleteModal && clientToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full mx-auto p-5">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-red-100 rounded-full p-3">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            </div>
            <h3 className="text-lg font-medium text-gray-900 text-center mb-2">
              Confirmar Exclusão
            </h3>
            <p className="text-sm text-gray-500 text-center mb-6">
              Tem certeza que deseja excluir o cliente <strong>{clientToDelete.name}</strong>? 
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setClientToDelete(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border 
                  border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 
                  focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-red-600 to-red-500 border 
                  border-transparent rounded-lg hover:from-red-700 hover:to-red-600 focus:outline-none focus:ring-2 
                  focus:ring-offset-2 focus:ring-red-500"
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