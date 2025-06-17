import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { Search, X } from 'lucide-react';
import { useProducts } from '../../hooks/useProducts';

interface ProductSaleFormProps {
  onClose: () => void;
}

interface Client {
  id: string;
  name: string;
  phone?: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  cost_price?: number;
}

interface PaymentMethod {
  id: string;
  name: string;
  fee: number;
}

interface SelectedProduct {
  id: string;
  quantity: number;
  customPrice?: number;
}

export default function ProductSaleForm({ onClose }: ProductSaleFormProps) {
  // Estados para o formulário
  const [clientSearch, setClientSearch] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientSearch, setShowClientSearch] = useState(false);
  // Estado para novo cliente
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [newClientData, setNewClientData] = useState({
    name: '',
    phone: '',
    email: ''
  });
  const [creatingClient, setCreatingClient] = useState(false);

  // Usar o hook useProducts
  const { products, searchProducts } = useProducts();
  
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [showProductsModal, setShowProductsModal] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  
  // Usar a função searchProducts do hook para filtrar produtos
  const filteredProducts = useMemo(() => {
    return searchProducts(productSearch);
  }, [productSearch, searchProducts]);

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  
  // Estados de carregamento e conexão
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [canSubmit, setCanSubmit] = useState(true);

  // Verificar conexão com o Supabase
  useEffect(() => {
    async function checkConnection() {
      try {
        const { error } = await supabase.from('products').select('id').limit(1);
        setCanSubmit(!error);
      } catch (error) {
        console.error('Erro ao verificar conexão com o banco de dados:', error);
        setCanSubmit(false);
      }
    }
    
    checkConnection();
  }, []);
  
  // BUSCA DIRETA - Verificar métodos de pagamento disponíveis
  useEffect(() => {
    async function fetchPaymentMethods() {
      try {
        const { data, error } = await supabase
          .from('payment_methods')
          .select('*');
          
        if (error) {
          throw error;
        }
        
        if (!data || data.length === 0) {
          console.error('ALERTA: Nenhum método de pagamento encontrado no banco de dados!');
          alert('ERRO: Nenhum método de pagamento cadastrado no sistema. Por favor, cadastre métodos de pagamento antes de realizar vendas.');
          return;
        }
        
        // Verificar se os métodos têm IDs válidos
        const validMethods = data.filter(method => {
          if (!method.id) {
            console.error('Método de pagamento sem ID:', method);
            return false;
          }
          return true;
        });
        
        if (validMethods.length === 0) {
          console.error('ALERTA: Nenhum método de pagamento com ID válido!');
          alert('ERRO: Nenhum método de pagamento possui ID válido. Por favor, verifique a configuração do banco de dados.');
          return;
        }
        
        console.log('Métodos de pagamento válidos encontrados:', validMethods);
        
        // Se temos apenas um método válido, selecionar automaticamente
        if (validMethods.length === 1) {
          console.log('Selecionando automaticamente o único método disponível:', validMethods[0]);
          setSelectedPaymentMethod(validMethods[0]);
        }
        
        setPaymentMethods(validMethods);
      } catch (err) {
        console.error('Erro ao buscar métodos de pagamento:', err);
        toast.error('Erro ao carregar métodos de pagamento. Por favor, recarregue a página.');
      }
    }
    
    fetchPaymentMethods();
  }, []);

  // Carregar métodos de pagamento
  useEffect(() => {
    async function loadPaymentMethods() {
      // Carregar métodos de pagamento
      const { data: methodsData, error: methodsError } = await supabase
        .from('payment_methods')
        .select('*');

      if (methodsError) {
        console.error('Erro ao carregar métodos de pagamento:', methodsError);
        toast.error('Erro ao carregar métodos de pagamento');
        return;
      }
      
      // Verificar se os métodos de pagamento têm IDs válidos
      const validMethods = methodsData?.filter(method => {
        if (!method.id) {
          console.error('Método de pagamento sem ID:', method);
          return false;
        }
        return true;
      });
      
      console.log('Métodos de pagamento válidos carregados:', validMethods);
      setPaymentMethods(validMethods || []);
    }

    loadPaymentMethods();
  }, []);

  // Buscar clientes
  useEffect(() => {
    if (clientSearch.length < 2) return;

    async function searchClients() {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .ilike('name', `%${clientSearch}%`)
        .limit(5);

      if (error) {
        toast.error('Erro ao buscar clientes');
        return;
      }

      setClients(data || []);
    }

    searchClients();
  }, [clientSearch]);

  // Função para formatar preço
  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Função para atualizar o preço personalizado
  const updateProductPrice = (productId: string, newPrice: number) => {
    setSelectedProducts(prev =>
      prev.map(p =>
        p.id === productId
          ? { ...p, customPrice: newPrice }
          : p
      )
    );
  };

  // Atualizar o cálculo do total para não incluir a taxa
  const calculateTotal = () => {
    let subtotal = 0;
    selectedProducts.forEach(selectedProduct => {
      const product = products.find(p => p.id === selectedProduct.id);
      if (product) {
        const price = selectedProduct.customPrice ?? product.price;
        subtotal += price * selectedProduct.quantity;
      }
    });

    const fee = selectedPaymentMethod ? (subtotal * selectedPaymentMethod.fee) / 100 : 0;
    return {
      subtotal,
      fee,
      total: subtotal // Removendo a taxa do total
    };
  };

  // Função para verificar se há estoque suficiente para todos os produtos selecionados
  const checkStockAvailability = (): { hasEnoughStock: boolean; insufficientProducts: string[] } => {
    const insufficientProducts: string[] = [];
    
    selectedProducts.forEach(selectedProduct => {
      const product = products.find(p => p.id === selectedProduct.id);
      if (product && product.stock < selectedProduct.quantity) {
        insufficientProducts.push(`${product.name} (disponível: ${product.stock}, selecionado: ${selectedProduct.quantity})`);
      }
    });
    
    return {
      hasEnoughStock: insufficientProducts.length === 0,
      insufficientProducts
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Verificações básicas
    if (!selectedClient || selectedProducts.length === 0) {
      toast.error('Por favor, selecione cliente e produtos');
      return;
    }
    
    // Verificação de conectividade
    if (!canSubmit) {
      toast.error('Sem conexão com o servidor. Tente novamente mais tarde.');
      return;
    }

    // Verificar disponibilidade de estoque antes de prosseguir
    const { hasEnoughStock, insufficientProducts } = checkStockAvailability();
    if (!hasEnoughStock) {
      toast.error(
        <div>
          <p>Estoque insuficiente para os seguintes produtos:</p>
          <ul style={{ listStyleType: 'disc', paddingLeft: '20px', marginTop: '8px' }}>
            {insufficientProducts.map((product, index) => (
              <li key={index}>{product}</li>
            ))}
          </ul>
        </div>
      );
      return;
    }

    // Prevenir envios múltiplos
    if (isSubmitting) return;
    
    // Ativar estado de carregamento
    setIsSubmitting(true);

    try {
      // Não precisamos mais do subtotal e fee da função calculateTotal
      // Comentando esta linha que estava causando o erro de lint
      // const { subtotal, fee } = calculateTotal();

      // ABORDAGEM DEFINITIVA: Buscar método de pagamento válido do banco ANTES de tentar inserir
      console.log('Buscando método de pagamento válido diretamente do banco...');
      
      let paymentMethodId = null;
      
      // 1. Verificar se temos um método selecionado no state com ID válido
      if (selectedPaymentMethod && selectedPaymentMethod.id) {
        console.log('Método selecionado no state:', selectedPaymentMethod.id);
        
        // Verificar se o ID realmente existe no banco de dados
        const { data: methodCheck } = await supabase
          .from('payment_methods')
          .select('id')
          .eq('id', selectedPaymentMethod.id)
          .single();
          
        if (methodCheck && methodCheck.id) {
          paymentMethodId = methodCheck.id;
          console.log('ID encontrado e validado no banco:', paymentMethodId);
        }
      }
      
      // 2. Se não temos ID válido, buscar o primeiro método disponível
      if (!paymentMethodId) {
        console.log('Nenhum método válido selecionado, buscando fallback...');
        const { data: fallbackMethod } = await supabase
          .from('payment_methods')
          .select('id, name')
          .limit(1)
          .single();
          
        if (fallbackMethod && fallbackMethod.id) {
          paymentMethodId = fallbackMethod.id;
          console.log(`Usando método de fallback: ${fallbackMethod.name} (${paymentMethodId})`);
          toast.success(`Método de pagamento não selecionado. Usando ${fallbackMethod.name} como padrão.`);
        }
      }
      
      // 3. Verificação final - se ainda não temos ID, não podemos prosseguir
      if (!paymentMethodId) {
        throw new Error('Não foi possível obter um método de pagamento válido. Verifique se existem métodos cadastrados no sistema.');
      }
      
      // Verificar se o clientId é válido
      const clientId = selectedClient.id === 'anonymous' ? null : selectedClient.id;
      
      // Criar um array de vendas de produtos para a nova estrutura da tabela
      const productSalesData = [];
      
      // Para cada produto selecionado, criar um registro individual
      for (const selectedProduct of selectedProducts) {
        const product = products.find(p => p.id === selectedProduct.id);
        if (!product) continue;
        
        // Calcular valores
        const price = selectedProduct.customPrice ?? product.price;
        const quantity = selectedProduct.quantity;
        const gross_total = price * quantity;
        
        // Calcular taxa de pagamento baseada na taxa do método de pagamento
        const paymentFee = selectedPaymentMethod ? (selectedPaymentMethod.fee / 100) : 0;
        const feeAmount = gross_total * paymentFee;
        
        // Calcular lucro líquido: (preço - custo) * quantidade - taxa
        const costPrice = product.cost_price || 0;
        const net_profit = (price - costPrice) * quantity - feeAmount;
        
        // Criar registro para este produto
        productSalesData.push({
          sale_date: new Date().toISOString(),
          product_name: product.name,
          payment_method_id: paymentMethodId,
          quantity: quantity,
          unit_price: price,
          gross_total: gross_total,
          net_profit: net_profit,
          client_id: clientId,
          appointment_id: null,
          created_at: new Date().toISOString()
        });
      }
      
      // Log para validação final
      console.log('DADOS FINAIS DA VENDA:', JSON.stringify(productSalesData, null, 2));
      
      // Inserir registros de vendas na tabela product_sales
      const { data: insertedSales, error: salesError } = await supabase
        .from('product_sales')
        .insert(productSalesData)
        .select();

      if (salesError) {
        console.error('Erro ao registrar vendas de produtos:', salesError);
        setIsSubmitting(false);
        toast.error('Erro ao registrar a venda. Por favor, tente novamente.');
        return;
      }
      
      console.log('Venda de produtos registrada com sucesso:', insertedSales);
      
      // Disparar um evento para atualizar o relatório financeiro
      window.dispatchEvent(new CustomEvent('productSaleCreated', {
        detail: {
          status: 'completed',
          sales: insertedSales,
          date: new Date().toISOString().split('T')[0]
        }
      }));
      
      toast.success('Venda registrada com sucesso!');
      
      // Limpar formulário e fechar modal
      setSelectedProducts([]);
      setSelectedPaymentMethod(null);
      onClose();
    } catch (error) {
      console.error('Erro ao processar venda:', error);
      if (error instanceof Error) {
        toast.error('Erro ao registrar venda: ' + error.message);
      } else {
        toast.error('Erro desconhecido ao registrar venda');
      }
    } finally {
      // Desativar estado de carregamento mesmo em caso de erro
      setIsSubmitting(false);
    }
  };

  const toggleProductSelection = (product: Product) => {
    setSelectedProducts(prev => {
      const existing = prev.find(p => p.id === product.id);
      if (existing) {
        return prev.filter(p => p.id !== product.id);
      }
      return [...prev, { id: product.id, quantity: 1, customPrice: product.price }];
    });
  };

  const updateProductQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    
    // Verificar se a nova quantidade excede o estoque
    const product = products.find(p => p.id === productId);
    if (product && newQuantity > product.stock) {
      toast.error(`Atenção: A quantidade selecionada (${newQuantity}) excede o estoque disponível (${product.stock}) para o produto "${product.name}".`);
    }
    
    setSelectedProducts(prev =>
      prev.map(p =>
        p.id === productId
          ? { ...p, quantity: newQuantity }
          : p
      )
    );
  };

  // Função para criar um novo cliente
  const createNewClient = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newClientData.name.trim()) {
      toast.error('Nome é obrigatório para cadastrar um cliente');
      return;
    }

    // Validação básica do telefone - pelo menos 10 dígitos
    const phoneDigits = newClientData.phone.replace(/\D/g, '');
    if (!phoneDigits || phoneDigits.length < 10) {
      toast.error('Telefone é obrigatório e deve ser completo');
      return;
    }

    try {
      setCreatingClient(true);
      
      const now = new Date().toISOString();
      const clientData = {
        ...newClientData,
        created_at: now,
        updated_at: now
      };
      
      const { data: insertedClient, error } = await supabase
        .from('clients')
        .insert([clientData])
        .select()
        .single();
      
      if (error) throw error;
      
      if (insertedClient) {
        // Atualizar a lista de clientes
        const updatedClients = [...clients, insertedClient];
        setClients(updatedClients);
        
        // Selecionar o cliente recém-criado
        setSelectedClient(insertedClient);
        
        // Limpar o formulário e fechar o modal
        setNewClientData({ name: '', phone: '', email: '' });
        setShowNewClientForm(false);
        setShowClientSearch(false);
        
        toast.success('Cliente cadastrado com sucesso!');
      }
    } catch (err) {
      console.error('Erro ao cadastrar cliente:', err);
      toast.error('Erro ao cadastrar cliente. Verifique os dados e tente novamente.');
    } finally {
      setCreatingClient(false);
    }
  };

  // Função para lidar com mudanças nos campos do novo cliente
  const handleNewClientChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewClientData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Seleção de Cliente */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Cliente <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <div className="flex gap-2 mb-1">
            <div className="relative flex-1">
              <input
                type="text"
                value={selectedClient ? selectedClient.name : clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  setShowClientSearch(true);
                  setSelectedClient(null);
                }}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Buscar cliente..."
              />
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedClient({
                  id: 'anonymous',
                  name: 'Anônimo'
                });
                setShowClientSearch(false);
                setClientSearch('');
              }}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-300"
            >
              Anônimo
            </button>
          </div>
          
          {showClientSearch && !selectedClient && (
            <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-48 overflow-y-auto">
              {clients.length > 0 ? (
                clients.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => {
                      setSelectedClient(client);
                      setShowClientSearch(false);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm"
                  >
                    <p className="font-medium text-gray-900">{client.name}</p>
                    {client.phone && (
                      <p className="text-xs text-gray-500">{client.phone}</p>
                    )}
                  </button>
                ))
              ) : clientSearch.length >= 2 ? (
                <div className="p-3">
                  <p className="text-sm text-gray-600 mb-2">Cliente não encontrado</p>
                  <button
                    type="button"
                    onClick={() => {
                      setNewClientData(prev => ({ ...prev, name: clientSearch }));
                      setShowNewClientForm(true);
                    }}
                    className="w-full py-1.5 px-2 text-xs font-medium text-white bg-emerald-600 rounded hover:bg-emerald-700"
                  >
                    Cadastrar Novo Cliente
                  </button>
                </div>
              ) : (
                <div className="p-3 text-sm text-gray-600">
                  Digite pelo menos 2 caracteres para buscar
                </div>
              )}
            </div>
          )}
          
          {/* Formulário de Novo Cliente */}
          {showNewClientForm && (
            <div className="absolute z-20 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 p-3">
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-900">Cadastro de Novo Cliente</h3>
                <div>
                  <label htmlFor="name" className="block text-xs font-medium text-gray-700">
                    Nome <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={newClientData.name}
                    onChange={handleNewClientChange}
                    className="mt-1 w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-xs font-medium text-gray-700">
                    Telefone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={newClientData.phone}
                    onChange={handleNewClientChange}
                    placeholder="(00) 00000-0000"
                    className="mt-1 w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-xs font-medium text-gray-700">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={newClientData.email}
                    onChange={handleNewClientChange}
                    className="mt-1 w-full px-2 py-1 text-sm border border-gray-300 rounded-md"
                  />
                </div>
                <div className="flex space-x-2 mt-3">
                  <button
                    type="button"
                    onClick={() => setShowNewClientForm(false)}
                    className="flex-1 py-1 px-2 text-xs border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={createNewClient}
                    disabled={creatingClient || !newClientData.name.trim() || newClientData.phone.replace(/\D/g, '').length < 10}
                    className="flex-1 py-1 px-2 text-xs bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:bg-emerald-400"
                  >
                    {creatingClient ? 'Cadastrando...' : 'Cadastrar Cliente'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Seleção de Produtos */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Produtos <span className="text-red-500">*</span>
        </label>
        
        {/* Lista de produtos selecionados */}
        {selectedProducts.length > 0 ? (
          <div className="space-y-1.5">
            {selectedProducts.map((selectedProduct) => {
              const product = products.find(p => p.id === selectedProduct.id);
              if (!product) return null;

              const hasInsufficientStock = product && product.stock < selectedProduct.quantity;

              return (
                <div key={product.id} className={`flex items-center justify-between ${hasInsufficientStock ? 'bg-red-50 border border-red-300' : 'bg-gray-50'} p-2 rounded-lg text-sm`}>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-gray-900">{product.name}</p>
                    </div>
                    {hasInsufficientStock && (
                      <p className="text-xs text-red-500 mt-1">
                        Estoque insuficiente! Disponível: {product.stock}, Selecionado: {selectedProduct.quantity}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateProductQuantity(product.id, selectedProduct.quantity - 1)}
                      className="p-0.5 text-gray-500 hover:text-gray-700"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-sm">{selectedProduct.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateProductQuantity(product.id, selectedProduct.quantity + 1)}
                      className="p-0.5 text-gray-500 hover:text-gray-700"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleProductSelection(product)}
                      className="p-0.5 text-red-500 hover:text-red-700"
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowProductsModal(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:text-gray-900 hover:border-gray-400 transition-colors text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Selecionar produtos</span>
          </button>
        )}

        {selectedProducts.length > 0 && (
          <button
            type="button"
            onClick={() => setShowProductsModal(true)}
            className="mt-1.5 text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Adicionar mais produtos
          </button>
        )}
      </div>

      {/* Método de Pagamento */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Método de Pagamento <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {paymentMethods.map((method) => (
            <button
              key={method.id}
              type="button"
              onClick={() => {
                // Usar a abordagem mais simples e direta
                if (!method.id) {
                  console.error('Método de pagamento sem ID!', method);
                  toast.error('Este método de pagamento não possui ID válido. Por favor, escolha outro.');
                  return;
                }
                
                // Alertar sobre a seleção para debug
                toast.success(`Método selecionado: ${method.name} (ID: ${method.id.substring(0, 8)}...)`);
                
                console.log('Método de pagamento selecionado:', {
                  id: method.id,
                  name: method.name,
                  fee: method.fee
                });
                
                // Atualizar o estado com o método completo
                setSelectedPaymentMethod(method);
              }}
              className={`
                px-3 py-1.5 rounded-lg border text-left transition-colors text-sm
                ${selectedPaymentMethod?.id === method.id
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-gray-300 hover:border-indigo-300'
                }
              `}
            >
              <p className="font-medium">{method.name}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Resumo e Total */}
      {selectedProducts.length > 0 && (
        <div className="border-t pt-3 mt-4">
          <div className="space-y-1">
            <div className="flex justify-between text-sm font-medium text-gray-900">
              <span>Total:</span>
              <span>{formatPrice(calculateTotal().subtotal)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Botões de ação */}
      <div className="flex justify-end gap-2 pt-4">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className={`px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-gray-800 transition-colors ${
            isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !canSubmit || !selectedPaymentMethod || selectedProducts.length === 0 || !selectedClient || !checkStockAvailability().hasEnoughStock}
          className={`px-3 py-1.5 text-xs font-medium text-white ${checkStockAvailability().hasEnoughStock ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-500 hover:bg-red-600'} rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 ${
            isSubmitting || !canSubmit || !selectedPaymentMethod || selectedProducts.length === 0 || !selectedClient || !checkStockAvailability().hasEnoughStock ? 'opacity-70 cursor-not-allowed' : ''
          }`}
          onClick={(e) => {
            if (!checkStockAvailability().hasEnoughStock) {
              e.preventDefault();
              const { insufficientProducts } = checkStockAvailability();
              toast.error(
                <div>
                  <p>Estoque insuficiente para os seguintes produtos:</p>
                  <ul style={{ listStyleType: 'disc', paddingLeft: '20px', marginTop: '8px' }}>
                    {insufficientProducts.map((product, index) => (
                      <li key={index}>{product}</li>
                    ))}
                  </ul>
                </div>
              );
            }
          }}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-1">
              <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processando...
            </span>
          ) : !canSubmit ? (
            'Sem conexão'
          ) : !selectedPaymentMethod ? (
            'Selecione o método de pagamento'
          ) : !selectedProducts.length ? (
            'Selecione os produtos'
          ) : !selectedClient ? (
            'Selecione o cliente'
          ) : checkStockAvailability().hasEnoughStock ? (
            'Confirmar Venda'
          ) : (
            'Estoque insuficiente'
          )}
        </button>
      </div>

      {/* Modal de Seleção de Produtos */}
      {showProductsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-3 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-medium text-gray-900">Selecionar Produtos</h3>
                <button
                  onClick={() => setShowProductsModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3">
                <div className="relative">
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Buscar produtos..."
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg"
                  />
                  <Search className="absolute right-2 top-1.5 h-4 w-4 text-gray-400" />
                </div>
              </div>
            </div>
            
            <div className="max-h-[40vh] overflow-y-auto p-3">
              <div className="grid grid-cols-1 gap-1.5">
                {filteredProducts.map((product) => {
                  const isSelected = selectedProducts.some(p => p.id === product.id);
                  const selectedProduct = selectedProducts.find(p => p.id === product.id);

                  return (
                    <div
                      key={product.id}
                      className={`
                        p-2 rounded-lg border transition-colors cursor-pointer text-sm
                        ${isSelected
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-gray-200 hover:border-emerald-300 hover:bg-emerald-50'
                        }
                      `}
                      onClick={() => toggleProductSelection(product)}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-medium text-gray-900">{product.name}</h4>
                          <div className="flex items-center gap-2">
                            {isSelected ? (
                              <div className="relative">
                                <input
                                  type="text"
                                  value={formatPrice(selectedProduct?.customPrice ?? product.price)}
                                  onClick={(e) => e.stopPropagation()}
                                  onFocus={(e) => {
                                    e.stopPropagation();
                                    e.target.value = ((selectedProduct?.customPrice ?? product.price) * 100).toString();
                                    e.target.select();
                                  }}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    const value = e.target.value.replace(/[^\d]/g, '');
                                    const price = value ? Number(value) / 100 : 0;
                                    updateProductPrice(product.id, price);
                                  }}
                                  className="w-24 px-2 py-1 text-right border rounded text-xs focus:ring-2 focus:ring-emerald-500"
                                />
                                {selectedProduct?.customPrice !== product.price && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateProductPrice(product.id, product.price);
                                    }}
                                    className="absolute -top-1 -right-1 p-0.5 bg-gray-100 rounded-full hover:bg-emerald-50 hover:text-emerald-600"
                                    title="Restaurar preço original"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <p className="text-emerald-600 text-xs">
                                {formatPrice(product.price)}
                              </p>
                            )}
                          </div>
                        </div>
                        {isSelected && selectedProduct && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateProductQuantity(product.id, selectedProduct.quantity - 1);
                              }}
                              className="p-0.5 text-gray-500 hover:text-gray-700"
                            >
                              -
                            </button>
                            <span className="w-6 text-center text-xs">{selectedProduct.quantity}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateProductQuantity(product.id, selectedProduct.quantity + 1);
                              }}
                              className="p-0.5 text-gray-500 hover:text-gray-700"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                      {isSelected && selectedProduct?.customPrice !== product.price && (
                        <div className="mt-1 text-xs text-gray-500 text-right">
                          Preço original: {formatPrice(product.price)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-3 border-t border-gray-200">
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowProductsModal(false)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:text-gray-800"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={() => setShowProductsModal(false)}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
                >
                  Confirmar Seleção
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
} 