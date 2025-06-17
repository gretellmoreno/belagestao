import React, { useState, useEffect } from 'react';
import { Plus, Search, DollarSign, Edit2, Trash2, X, AlertTriangle, Loader2, Scissors, Package2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getServices, createService, updateService, deleteService, Service } from '../lib/serviceService';
import { getProducts, createProduct, updateProduct, deleteProduct, Product } from '../lib/productService';

type ItemType = 'service' | 'product';

interface ServiceWithType extends Service {
  itemType: 'service';
}

interface ProductWithType extends Product {
  itemType: 'product';
}

type Item = ServiceWithType | ProductWithType;

export default function Services() {
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [saving, setSaving] = useState(false);
  const [itemType, setItemType] = useState<ItemType>('service');
  const [activeTab, setActiveTab] = useState<ItemType>('service');

  const [newService, setNewService] = useState<Omit<Service, 'id' | 'created_at' | 'updated_at'> & { displayPrice?: string }>({
    name: '',
    price: null as unknown as number,
    displayPrice: '',
    description: '',
    commission_rate: null as unknown as number,
    estimated_time: null as unknown as number,
    active: true,
    type: 'service'
  });

  const [newProduct, setNewProduct] = useState<Omit<Product, 'id' | 'created_at' | 'updated_at'> & { displayPrice?: string, displayCostPrice?: string }>({
    name: '',
    price: null as unknown as number,
    cost_price: null as unknown as number,
    profit_margin: null as unknown as number,
    stock: null as unknown as number,
    description: '',
    active: true
  });

  const [errors, setErrors] = useState({
    name: false,
    price: false,
    description: false,
    commission_rate: false,
    estimated_time: false,
    cost_price: false,
    profit_margin: false,
    stock: false
  });

  useEffect(() => {
    fetchItems();
  }, []);

  // Resetar formulário quando mudar o tipo de item e não estiver editando
  useEffect(() => {
    if (!editingItem) {
      resetForm();
    }
  }, [itemType, editingItem]);

  async function fetchItems() {
    try {
      setLoading(true);
      const [servicesData, productsData] = await Promise.all([
        getServices(),
        getProducts()
      ]);
      setServices(servicesData);
      setProducts(productsData);
    } catch (error) {
      console.error('Error fetching items:', error);
      setError('Não foi possível carregar os itens. Tente novamente mais tarde.');
      toast.error('Erro ao carregar itens.');
    } finally {
      setLoading(false);
    }
  }

  const filteredItems: Item[] = [
    ...(activeTab === 'service' 
      ? services.map(service => ({ ...service, itemType: 'service' as const }))
      : []),
    ...(activeTab === 'product'
      ? products.map(product => ({ ...product, itemType: 'product' as const }))
      : [])
  ].filter(item => {
    const matchesSearch = (item.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                         (item.description?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const handleEditClick = (item: Item) => {
    setEditingItem(item);
    setItemType(item.itemType);
    if (item.itemType === 'service') {
      setNewService({
        name: item.name,
        price: item.price,
        displayPrice: formatPrice(item.price),
        description: item.description || '',
        commission_rate: item.commission_rate,
        estimated_time: item.estimated_time,
        active: item.active,
        type: 'service'
      });
    } else {
      setNewProduct({
        name: item.name,
        price: item.price,
        cost_price: item.cost_price,
        profit_margin: item.profit_margin,
        stock: item.stock,
        description: item.description || '',
        active: item.active
      });
    }
    setShowModal(true);
  };

  const handleDeleteClick = (item: Item) => {
    setItemToDelete(item);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      setSaving(true);
      if (itemToDelete.itemType === 'service') {
        await deleteService(itemToDelete.id);
        setServices(prev => prev.filter(i => i.id !== itemToDelete.id));
      } else {
        await deleteProduct(itemToDelete.id);
        setProducts(prev => prev.filter(i => i.id !== itemToDelete.id));
      }
      toast.success(`${itemToDelete.itemType === 'service' ? 'Serviço' : 'Produto'} excluído com sucesso!`);
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error(`Erro ao excluir ${itemToDelete.itemType === 'service' ? 'serviço' : 'produto'}. Tente novamente.`);
    } finally {
      setSaving(false);
      setShowDeleteModal(false);
      setItemToDelete(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setErrors({
      name: false,
      price: false,
      description: false,
      commission_rate: false,
      estimated_time: false,
      cost_price: false,
      profit_margin: false,
      stock: false
    });

    let hasErrors = false;
    
    if (itemType === 'service') {
      if (!newService.name.trim()) {
        setErrors(prev => ({ ...prev, name: true }));
        hasErrors = true;
      }
    } else {
      if (!newProduct.name.trim()) {
        setErrors(prev => ({ ...prev, name: true }));
        hasErrors = true;
      }
    }

    if (hasErrors) return;

    try {
      setSaving(true);
      
      if (itemType === 'service') {
        if (editingItem) {
          const updatedService = await updateService(editingItem.id, newService);
          setServices(prev => prev.map(item => 
            item.id === editingItem.id ? updatedService : item
          ));
        } else {
          const newServiceData = await createService(newService);
          setServices(prev => [...prev, newServiceData]);
        }
      } else {
        if (editingItem) {
          const updatedProduct = await updateProduct(editingItem.id, newProduct);
          setProducts(prev => prev.map(item => 
            item.id === editingItem.id ? updatedProduct : item
          ));
        } else {
          const newProductData = await createProduct(newProduct);
          setProducts(prev => [...prev, newProductData]);
        }
      }

      toast.success(`${itemType === 'service' ? 'Serviço' : 'Produto'} ${editingItem ? 'atualizado' : 'criado'} com sucesso!`);
      setShowModal(false);
      setEditingItem(null);
      resetForm();
    } catch (error) {
      console.error('Error saving item:', error);
      toast.error(`Erro ao salvar ${itemType === 'service' ? 'serviço' : 'produto'}. Tente novamente.`);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    if (itemType === 'service') {
      setNewService({
        name: '',
        price: null as unknown as number,
        displayPrice: '',
        description: '',
        commission_rate: null as unknown as number,
        estimated_time: null as unknown as number,
        active: true,
        type: 'service'
      });
    } else {
      setNewProduct({
        name: '',
        price: null as unknown as number,
        cost_price: null as unknown as number,
        profit_margin: null as unknown as number,
        stock: null as unknown as number,
        description: '',
        active: true,
        displayPrice: '',
        displayCostPrice: ''
      });
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const handlePriceInput = (value: string, setter: (value: any) => void, field: string) => {
    // Remove cualquier carácter que no sea número
    const numbers = value.replace(/\D/g, '');
    
    // Formatea el número con la coma decimal y punto para miles
    let formattedValue = '';
    if (numbers.length > 0) {
      const integerPart = numbers.slice(0, -2) || '0';
      const decimalPart = numbers.slice(-2).padStart(2, '0');
      
      // Agrega el punto para miles si el número es mayor a 999
      const formattedInteger = integerPart.replace(/^0+/, '').split('').reverse().join('')
        .match(/.{1,3}/g)?.join('.')
        .split('')
        .reverse()
        .join('') || '0';
      
      formattedValue = formattedInteger + ',' + decimalPart;
    }
    
    // Convierte a centavos (divide por 100)
    const price = numbers ? Number(numbers) / 100 : 0;
    
    // Actualiza el estado con el valor convertido
    setter((prev: any) => {
      if (field === 'price') {
        // Si se está modificando el precio de venda, calcula la margem de lucro
        const costPrice = prev.cost_price || 0;
        let profitMargin = 0;
        if (costPrice > 0 && price > 0) {
          profitMargin = ((price - costPrice) / costPrice) * 100;
        }
        return { 
          ...prev, 
          price, 
          displayPrice: formattedValue,
          profit_margin: Math.round(profitMargin) // Redondea a número entero
        };
      } else if (field === 'cost_price') {
        // Si es custo, apenas atualiza o custo sem alterar o preço de venda
        // Recalcula a margem baseada no preço de venda atual
        const sellingPrice = prev.price || 0;
        let profitMargin = 0;
        if (price > 0 && sellingPrice > 0) {
          profitMargin = ((sellingPrice - price) / price) * 100;
        }
        return { 
          ...prev, 
          cost_price: price,
          displayCostPrice: formattedValue,
          profit_margin: Math.round(profitMargin)
        };
      }
      return prev;
    });
  };

  const renderItem = (item: Item) => (
    <div 
      key={item.id} 
      className={`bg-white border ${
        item.itemType === 'service' 
          ? 'hover:border-indigo-300 hover:shadow-indigo-100/50' 
          : 'hover:border-green-300 hover:shadow-green-100/50'
      } rounded-xl shadow-sm hover:shadow-md transition-all duration-300 p-3 ${
        !item.active && 'opacity-70'
      }`}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center">
            {item.itemType === 'product' ? (
              <div className="p-1 bg-gradient-to-r from-emerald-100 to-green-100 text-green-600 rounded-full mr-1.5 flex-shrink-0 shadow-sm">
                <Package2 className="h-3.5 w-3.5" />
              </div>
            ) : (
              <div className="p-1 bg-gradient-to-r from-purple-100 to-indigo-100 text-indigo-600 rounded-full mr-1.5 flex-shrink-0 shadow-sm">
                <Scissors className="h-3.5 w-3.5" />
              </div>
            )}
            <h3 className="text-sm font-medium text-gray-900 group-hover:text-indigo-600 line-clamp-1">{item.name}</h3>
          </div>
          
          {item.description && (
            <p className="mt-0.5 text-xs text-gray-500 line-clamp-2 ml-6">{item.description}</p>
          )}
        </div>
        
        <div className="flex space-x-1 ml-2">
          <button 
            onClick={() => handleEditClick(item)}
            className={`p-1 rounded-md transition-colors ${
              item.itemType === 'service'
                ? 'text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50'
                : 'text-green-500 hover:text-green-600 hover:bg-green-50'
            }`}
            title="Editar"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button 
            onClick={() => handleDeleteClick(item)}
            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
            title="Excluir"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {item.itemType === 'service' ? (
          <>
            <div className="flex items-center px-2 py-0.5 bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 rounded-full text-xs font-medium">
              <DollarSign className="h-2.5 w-2.5 mr-0.5" />
              {formatPrice(item.price)}
            </div>
            <div className="flex items-center px-2 py-0.5 bg-gradient-to-r from-blue-50 to-sky-50 text-blue-700 rounded-full text-xs font-medium">
              <span className="mr-0.5">⏱</span>
              {item.estimated_time >= 60 
                ? `${Math.floor(item.estimated_time / 60)}h${item.estimated_time % 60 > 0 ? `${item.estimated_time % 60}min` : ''}`
                : `${item.estimated_time}min`}
            </div>
            <div className="flex items-center px-2 py-0.5 bg-gradient-to-r from-violet-50 to-fuchsia-50 text-violet-700 rounded-full text-xs font-medium">
              <span className="mr-0.5">%</span>
              {item.commission_rate}% com.
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center px-2 py-0.5 bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 rounded-full text-xs font-medium">
              <DollarSign className="h-2.5 w-2.5 mr-0.5" />
              {formatPrice(item.price)}
            </div>
            <div className="flex items-center px-2 py-0.5 bg-gradient-to-r from-blue-50 to-sky-50 text-blue-700 rounded-full text-xs font-medium">
              <span className="mr-0.5">📦</span>
              {item.stock} und.
            </div>
            <div className="flex items-center px-2 py-0.5 bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-700 rounded-full text-xs font-medium">
              <span className="mr-0.5">📈</span>
              {item.profit_margin}%
            </div>
          </>
        )}
        
        {!item.active && (
          <div className="flex items-center px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs font-medium">
            Inativo
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Serviços e Produtos</h1>
        <button 
          onClick={() => {
            setEditingItem(null);
            setItemType(activeTab);
            resetForm();
            setShowModal(true);
          }}
          className={`
            relative overflow-hidden group
            ${activeTab === 'service' 
              ? 'bg-gradient-to-r from-purple-500 to-indigo-600' 
              : 'bg-gradient-to-r from-emerald-500 to-green-600'
            } 
            text-white px-3 py-2 rounded-lg 
            transition-all duration-300 
            shadow-sm hover:shadow-md 
            hover:translate-y-[-2px]
            active:translate-y-[1px]
            flex items-center justify-center
            text-sm
          `}
          disabled={loading}
        >
          <span className="absolute inset-0 w-full h-full bg-white opacity-0 group-hover:opacity-20 transition-opacity duration-300"></span>
          <Plus className="h-4 w-4 mr-1.5" />
          <span className="font-medium">
            {activeTab === 'service' ? 'Novo Serviço' : 'Novo Produto'}
          </span>
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex">
            <button
              onClick={() => setActiveTab('service')}
              className={`relative min-w-0 flex-1 overflow-hidden py-3 px-2 text-center text-sm font-medium hover:bg-gray-50 focus:z-10 focus:outline-none
                ${activeTab === 'service'
                  ? 'text-indigo-600 border-b-2 border-indigo-500'
                  : 'text-gray-500 border-b-2 border-transparent'
                }
              `}
            >
              <Scissors className="h-4 w-4 mx-auto mb-1" />
              Serviços
            </button>
            <button
              onClick={() => setActiveTab('product')}
              className={`relative min-w-0 flex-1 overflow-hidden py-3 px-2 text-center text-sm font-medium hover:bg-gray-50 focus:z-10 focus:outline-none
                ${activeTab === 'product'
                  ? 'text-green-600 border-b-2 border-green-500'
                  : 'text-gray-500 border-b-2 border-transparent'
                }
              `}
            >
              <Package2 className="h-4 w-4 mx-auto mb-1" />
              Produtos
            </button>
          </nav>
        </div>

        <div className="p-3 sm:p-4">
          <div className="w-full">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                placeholder={`Buscar ${activeTab === 'service' ? 'serviços' : 'produtos'}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          {loading && (
            <div className="flex justify-center items-center h-40 mt-4">
              <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
              <span className="ml-2 text-sm text-gray-500">Carregando {activeTab === 'service' ? 'serviços' : 'produtos'}...</span>
            </div>
          )}

          {error && !loading && (
            <div className="mt-4 text-center p-3 bg-red-50 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
              <button 
                onClick={fetchItems}
                className="mt-2 px-3 py-1.5 text-xs font-medium bg-red-100 text-red-800 rounded-md hover:bg-red-200"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {!loading && !error && filteredItems.length === 0 && (
            <div className="mt-4 text-center p-6">
              {searchTerm ? (
                <p className="text-sm text-gray-500">
                  Nenhum {activeTab === 'service' ? 'serviço' : 'produto'} encontrado com "{searchTerm}"
                </p>
              ) : (
                <div>
                  <p className="text-sm text-gray-500 mb-3">
                    Nenhum {activeTab === 'service' ? 'serviço' : 'produto'} cadastrado
                  </p>
                  <button
                    onClick={() => {
                      setEditingItem(null);
                      setItemType(activeTab);
                      resetForm();
                      setShowModal(true);
                    }}
                    className={`
                      px-3 py-2 rounded-lg transition-all duration-300 text-sm font-medium
                      ${activeTab === 'service' 
                        ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' 
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }
                      flex items-center justify-center shadow-sm hover:shadow
                    `}
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Adicionar {activeTab === 'service' ? 'serviço' : 'produto'}
                  </button>
                </div>
              )}
            </div>
          )}

          {!loading && !error && filteredItems.length > 0 && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map(renderItem)}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-2 max-h-[90vh] overflow-y-auto">
            <div className={`flex items-center justify-between p-3 border-b ${
              itemType === 'service' ? 'bg-gradient-to-r from-purple-50 to-indigo-50' : 'bg-gradient-to-r from-emerald-50 to-green-50'
            }`}>
              <div className="flex items-center">
                {itemType === 'service' ? (
                  <div className="p-1.5 bg-gradient-to-r from-purple-100 to-indigo-100 text-indigo-600 rounded-full mr-2 shadow-sm">
                    <Scissors className="h-4 w-4" />
                  </div>
                ) : (
                  <div className="p-1.5 bg-gradient-to-r from-emerald-100 to-green-100 text-green-600 rounded-full mr-2 shadow-sm">
                    <Package2 className="h-4 w-4" />
                  </div>
                )}
                <div>
                  <h3 className="text-base font-medium text-gray-900">
                    {editingItem 
                      ? `Editar ${itemType === 'service' ? 'Serviço' : 'Produto'}` 
                      : `Novo ${itemType === 'service' ? 'Serviço' : 'Produto'}`
                    }
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Preencha os dados do {itemType === 'service' ? 'serviço' : 'produto'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingItem(null);
                }}
                className="text-gray-400 hover:text-gray-500 transition-colors p-1.5 rounded-full hover:bg-gray-100"
                disabled={saving}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-3 max-h-[calc(100vh-150px)] overflow-y-auto">
              <div className="space-y-4">
                {itemType === 'product' ? (
                  <>
                    <div>
                      <label htmlFor="name" className="block text-xs font-medium text-gray-700 mb-1">
                        Nome
                      </label>
                      <input
                        type="text"
                        id="name"
                        value={newProduct.name}
                        onChange={(e) => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
                        className={`block w-full px-3 py-2 rounded-lg shadow-sm text-sm
                          ${errors.name
                            ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                            : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
                          }
                          transition-colors duration-200
                        `}
                        placeholder="Digite o nome do produto"
                        disabled={saving}
                        autoFocus
                      />
                      {errors.name && (
                        <p className="mt-1 text-xs text-red-600 flex items-center">
                          <span className="mr-1">•</span>
                          Nome é obrigatório
                        </p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="cost_price" className="block text-xs font-medium text-gray-700 mb-1">
                        Custo de Aquisição (R$)
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 text-sm">R$</span>
                        </div>
                        <input
                          type="text"
                          id="cost_price"
                          value={newProduct.displayCostPrice || ''}
                          onChange={(e) => handlePriceInput(e.target.value, setNewProduct, 'cost_price')}
                          className={`block w-full pl-10 pr-3 py-2 rounded-lg shadow-sm text-sm
                            ${errors.cost_price
                              ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                              : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
                            }
                            transition-colors duration-200
                          `}
                          placeholder="0,00"
                          disabled={saving}
                        />
                      </div>
                      {newProduct.cost_price > 0 && (
                        <p className="mt-0.5 text-xs text-gray-500">
                          Valor: {formatPrice(newProduct.cost_price)}
                        </p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="price" className="block text-xs font-medium text-gray-700 mb-1">
                        Preço de Venda (R$)
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 text-sm">R$</span>
                        </div>
                        <input
                          type="text"
                          id="price"
                          value={newProduct.displayPrice || ''}
                          onChange={(e) => handlePriceInput(e.target.value, setNewProduct, 'price')}
                          className={`block w-full pl-10 pr-3 py-2 rounded-lg shadow-sm text-sm
                            ${errors.price
                              ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                              : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
                            }
                            transition-colors duration-200
                          `}
                          placeholder="0,00"
                          disabled={saving}
                        />
                      </div>
                      {newProduct.price > 0 && (
                        <p className="mt-0.5 text-xs text-gray-500">
                          Valor: {formatPrice(newProduct.price)}
                        </p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="profit_margin" className="block text-xs font-medium text-gray-700 mb-1">
                        Margem de Lucro (%)
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 text-sm">%</span>
                        </div>
                        <input
                          type="number"
                          id="profit_margin"
                          value={newProduct.profit_margin || ''}
                          onChange={(e) => {
                            const profitMargin = e.target.value ? Number(e.target.value) : 0;
                            setNewProduct(prev => ({ 
                              ...prev, 
                              profit_margin: profitMargin
                            }));
                          }}
                          className="block w-full pl-10 pr-3 py-2 rounded-lg shadow-sm text-sm
                            border-gray-300 focus:ring-indigo-500 focus:border-indigo-500
                            transition-colors duration-200 bg-gray-50"
                          placeholder="Calculado automaticamente..."
                          readOnly
                        />
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">A margem é calculada automaticamente com base no preço de venda e custo de aquisição</p>
                    </div>

                    <div>
                      <label htmlFor="stock" className="block text-xs font-medium text-gray-700 mb-1">
                        Estoque
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          id="stock"
                          min="0"
                          step="1"
                          value={newProduct.stock || ''}
                          onChange={(e) => setNewProduct(prev => ({ ...prev, stock: e.target.value ? Number(e.target.value) : null as unknown as number }))}
                          className={`block w-full px-3 py-2 rounded-lg shadow-sm text-sm
                            ${errors.stock
                              ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                              : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
                            }
                            transition-colors duration-200
                          `}
                          placeholder="Quantidade em estoque..."
                          disabled={saving}
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center">
                          <div className="flex flex-col h-full">
                            <button
                              type="button"
                              onClick={() => {
                                const currentValue = newProduct.stock || 0;
                                setNewProduct(prev => ({ ...prev, stock: currentValue + 1 }));
                              }}
                              className="h-1/2 px-2 border-l border-t border-r border-gray-300 rounded-tr-md bg-gray-50 hover:bg-gray-100"
                              disabled={saving}
                            >
                              <span className="text-gray-500">▲</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const currentValue = newProduct.stock || 1;
                                setNewProduct(prev => ({ ...prev, stock: Math.max(0, currentValue - 1) }));
                              }}
                              className="h-1/2 px-2 border-l border-b border-r border-gray-300 rounded-br-md bg-gray-50 hover:bg-gray-100"
                              disabled={saving}
                            >
                              <span className="text-gray-500">▼</span>
                            </button>
                          </div>
                        </div>
                      </div>
                      {errors.stock && (
                        <p className="mt-1 text-xs text-red-600 flex items-center">
                          <span className="mr-1">•</span>
                          Estoque é obrigatório
                        </p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="description" className="block text-xs font-medium text-gray-700 mb-1">
                        Observações
                      </label>
                      <textarea
                        id="description"
                        rows={2}
                        value={newProduct.description}
                        onChange={(e) => setNewProduct(prev => ({ ...prev, description: e.target.value }))}
                        className="block w-full px-3 py-2 rounded-lg shadow-sm text-sm border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Descreva o produto... (opcional)"
                        disabled={saving}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Disponível
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <label className={`flex items-center p-2 border rounded-lg cursor-pointer transition-colors ${
                          newProduct.active 
                            ? 'border-green-300 bg-green-50 ring-1 ring-green-200'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}>
                          <input
                            type="radio"
                            checked={newProduct.active}
                            onChange={() => setNewProduct(prev => ({ ...prev, active: true }))}
                            className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 hidden"
                            disabled={saving}
                          />
                          <div className="w-4 h-4 mr-1.5 rounded-full bg-green-500 flex items-center justify-center">
                            <span className="text-white text-xs">✓</span>
                          </div>
                          <span className="text-sm">Sim</span>
                        </label>
                        <label className={`flex items-center p-2 border rounded-lg cursor-pointer transition-colors ${
                          !newProduct.active 
                            ? 'border-red-300 bg-red-50 ring-1 ring-red-200'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}>
                          <input
                            type="radio"
                            checked={!newProduct.active}
                            onChange={() => setNewProduct(prev => ({ ...prev, active: false }))}
                            className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 hidden"
                            disabled={saving}
                          />
                          <div className="w-4 h-4 mr-1.5 rounded-full bg-red-500 flex items-center justify-center">
                            <span className="text-white text-xs">×</span>
                          </div>
                          <span className="text-sm">Não</span>
                        </label>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label htmlFor="name" className="block text-xs font-medium text-gray-700 mb-1">
                        Nome
                      </label>
                      <input
                        type="text"
                        id="name"
                        value={newService.name}
                        onChange={(e) => setNewService(prev => ({ ...prev, name: e.target.value }))}
                        className={`block w-full px-3 py-2 rounded-lg shadow-sm text-sm
                          ${errors.name
                            ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                            : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
                          }
                          transition-colors duration-200
                        `}
                        placeholder="Digite o nome do serviço"
                        disabled={saving}
                        autoFocus
                      />
                      {errors.name && (
                        <p className="mt-1 text-xs text-red-600 flex items-center">
                          <span className="mr-1">•</span>
                          Nome é obrigatório
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="price" className="block text-xs font-medium text-gray-700 mb-1">
                          Preço (R$)
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 text-sm">R$</span>
                          </div>
                          <input
                            type="text"
                            id="price"
                            value={newService.displayPrice || ''}
                            onChange={(e) => handlePriceInput(e.target.value, setNewService, 'price')}
                            className={`block w-full pl-10 pr-3 py-2 rounded-lg shadow-sm text-sm
                              ${errors.price
                                ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                                : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
                              }
                              transition-colors duration-200
                            `}
                            placeholder="0,00"
                            disabled={saving}
                          />
                        </div>
                        {newService.price > 0 && (
                          <p className="mt-0.5 text-xs text-gray-500">
                            Valor: {formatPrice(newService.price)}
                          </p>
                        )}
                      </div>

                      <div>
                        <label htmlFor="estimated_time" className="block text-xs font-medium text-gray-700 mb-1">
                          Tempo Aproximado
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 text-sm">min</span>
                          </div>
                          <input
                            type="number"
                            id="estimated_time"
                            min="15"
                            step="15"
                            value={newService.estimated_time || ''}
                            onChange={(e) => setNewService(prev => ({ ...prev, estimated_time: e.target.value ? Number(e.target.value) : null as unknown as number }))}
                            className={`block w-full pl-10 pr-3 py-2 rounded-lg shadow-sm text-sm
                              ${errors.estimated_time
                                ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                                : 'border-gray-300 focus:ring-indigo-500 focus:border-indigo-500'
                              }
                              transition-colors duration-200
                            `}
                            placeholder="Ex: 15, 30, 45..."
                            disabled={saving}
                          />
                        </div>
                        {newService.estimated_time && (
                          <p className="mt-0.5 text-xs text-gray-500">
                            {newService.estimated_time >= 60 
                              ? `${Math.floor(newService.estimated_time / 60)} hora${Math.floor(newService.estimated_time / 60) > 1 ? 's' : ''}${newService.estimated_time % 60 > 0 ? ` e ${newService.estimated_time % 60} min` : ''}`
                              : `${newService.estimated_time} minutos`}
                          </p>
                        )}
                        {errors.estimated_time && (
                          <p className="mt-1 text-xs text-red-600 flex items-center">
                            <span className="mr-1">•</span>
                            Tempo aproximado é obrigatório
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="commission_rate" className="block text-xs font-medium text-gray-700 mb-1">
                        Comissão (%)
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 text-sm">%</span>
                        </div>
                        <input
                          type="number"
                          id="commission_rate"
                          min="0"
                          max="100"
                          step="10"
                          value={newService.commission_rate || ''}
                          onChange={(e) => setNewService(prev => ({ ...prev, commission_rate: e.target.value ? Number(e.target.value) : null as unknown as number }))}
                          className="block w-full pl-10 pr-3 py-2 rounded-lg shadow-sm text-sm
                            border-gray-300 focus:ring-indigo-500 focus:border-indigo-500
                            transition-colors duration-200"
                          placeholder="Ex: 10, 20, 30..."
                          disabled={saving}
                        />
                      </div>
                      <p className="mt-0.5 text-xs text-gray-500">Porcentagem que o profissional receberá pelo serviço</p>
                    </div>

                    <div>
                      <label htmlFor="description" className="block text-xs font-medium text-gray-700 mb-1">
                        Observações
                      </label>
                      <textarea
                        id="description"
                        rows={2}
                        value={newService.description}
                        onChange={(e) => setNewService(prev => ({ ...prev, description: e.target.value }))}
                        className="block w-full px-3 py-2 rounded-lg shadow-sm text-sm border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Descreva o serviço... (opcional)"
                        disabled={saving}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Disponível
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <label className={`flex items-center p-2 border rounded-lg cursor-pointer transition-colors ${
                          newService.active 
                            ? 'border-green-300 bg-green-50 ring-1 ring-green-200'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}>
                          <input
                            type="radio"
                            checked={newService.active}
                            onChange={() => setNewService(prev => ({ ...prev, active: true }))}
                            className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 hidden"
                            disabled={saving}
                          />
                          <div className="w-4 h-4 mr-1.5 rounded-full bg-green-500 flex items-center justify-center">
                            <span className="text-white text-xs">✓</span>
                          </div>
                          <span className="text-sm">Sim</span>
                        </label>
                        <label className={`flex items-center p-2 border rounded-lg cursor-pointer transition-colors ${
                          !newService.active 
                            ? 'border-red-300 bg-red-50 ring-1 ring-red-200'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}>
                          <input
                            type="radio"
                            checked={!newService.active}
                            onChange={() => setNewService(prev => ({ ...prev, active: false }))}
                            className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 hidden"
                            disabled={saving}
                          />
                          <div className="w-4 h-4 mr-1.5 rounded-full bg-red-500 flex items-center justify-center">
                            <span className="text-white text-xs">×</span>
                          </div>
                          <span className="text-sm">Não</span>
                        </label>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingItem(null);
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 
                    rounded-lg hover:bg-gray-50 transition-all duration-200 shadow-sm"
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`px-3 py-1.5 text-xs font-medium text-white 
                    ${itemType === 'service' 
                      ? 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700' 
                      : 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700'
                    } 
                    rounded-lg transition-all duration-200 shadow-sm hover:shadow 
                    active:transform active:scale-95`}
                  disabled={saving}
                >
                  {saving ? (
                    <div className="flex items-center">
                      <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                      Salvando...
                    </div>
                  ) : (
                    editingItem ? 'Salvar Alterações' : 'Salvar'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && itemToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 z-50">
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
              Tem certeza que deseja excluir o {itemToDelete.itemType === 'service' ? 'serviço' : 'produto'} <strong>{itemToDelete.name}</strong>? 
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setItemToDelete(null);
                }}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border 
                  border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 border 
                  border-transparent rounded-lg hover:bg-red-700 flex items-center"
                disabled={saving}
              >
                {saving && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}