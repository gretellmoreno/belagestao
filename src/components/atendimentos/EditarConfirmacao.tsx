import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../../lib/financeiroUtils';
import { toast } from 'react-toastify';

interface Service {
  id: string;
  name: string;
  price: number;
  commission: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  cost_price: number;
  quantity: number;
}

interface ServiceData {
  id?: string;
  name: string;
  price: number;
  originalPrice?: number;
  commission?: number;
}

interface ProductData {
  id?: string;
  name: string;
  price: number;
  quantity: number;
  originalPrice?: number;
  cost_price?: number;
}

interface PaymentMethod {
  id: string;
  name: string;
  fee: number;
}

interface Appointment {
  id: string;
  client: {
    id: string;
    name: string;
  };
  professional: {
    id: string;
    name: string;
  };
  date: string;
  time: string;
  payment_method_id?: string;
  payment_method?: string;
  services?: string[];
  products?: ProductData[];
  /** @deprecated Campo custom_prices foi removido do banco de dados. Use services_data com final_price em vez disso. */
  custom_prices?: Record<string, number>;
  confirmation?: {
    services_data?: Record<string, ServiceData>;
    products_data?: Record<string, ProductData>;
    payment_method_id?: string;
  };
}

interface EditarConfirmacaoProps {
  appointment: Appointment;
  onClose: () => void;
  onSave: () => void;
  availableServices: Service[];
  availableProducts: Product[];
  paymentMethods: PaymentMethod[];
}

const EditarConfirmacao: React.FC<EditarConfirmacaoProps> = ({
  appointment,
  onClose,
  onSave,
  availableServices,
  availableProducts,
  paymentMethods
}) => {
  // Estado para armazenar as edições
  const [services, setServices] = useState<Record<string, ServiceData>>({});
  const [products, setProducts] = useState<Record<string, ProductData>>({});
  const [paymentMethodId, setPaymentMethodId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // Inicializar com dados existentes
  useEffect(() => {
    // Serviços
    if (appointment.confirmation?.services_data) {
      // Usar dados da confirmação se existirem
      setServices(appointment.confirmation.services_data);
    } else if (appointment.services && appointment.services.length > 0) {
      // Ou converter a lista de serviços para o formato de objeto
      const servicesObj: Record<string, ServiceData> = {};
      appointment.services.forEach(serviceName => {
        // Buscar o serviço disponível para obter detalhes como comissão
        const serviceDetails = availableServices.find(s => s.name === serviceName);
        
        if (serviceDetails) {
          // Verificar se existe preço personalizado para este serviço
          let price = serviceDetails.price;
          if (appointment.custom_prices && appointment.custom_prices[serviceName]) {
            price = appointment.custom_prices[serviceName];
            console.log(`Usando preço personalizado para ${serviceName}: ${price}`);
          }
          
          servicesObj[serviceName] = {
            id: serviceDetails.id,
            name: serviceName,
            price: price,
            originalPrice: serviceDetails.price,
            commission: serviceDetails.commission
          };
        }
      });
      setServices(servicesObj);
    }

    // Produtos
    if (appointment.confirmation?.products_data) {
      // Usar dados da confirmação se existirem
      setProducts(appointment.confirmation.products_data);
    } else if (appointment.products && appointment.products.length > 0) {
      // Ou converter a lista de produtos para o formato de objeto
      const productsObj: Record<string, ProductData> = {};
      appointment.products.forEach(product => {
        productsObj[product.name] = {
          id: product.id,
          name: product.name,
          price: product.price,
          originalPrice: product.price,
          quantity: product.quantity,
          cost_price: product.cost_price
        };
      });
      setProducts(productsObj);
    }

    // Método de pagamento
    setPaymentMethodId(
      appointment.confirmation?.payment_method_id || 
      appointment.payment_method_id || 
      ''
    );
  }, [appointment]);

  // Alterar preço de um serviço
  const handleServicePriceChange = (serviceName: string, newPrice: number) => {
    setServices(prev => ({
      ...prev,
      [serviceName]: {
        ...prev[serviceName],
        price: newPrice
      }
    }));
  };

  // Remover um serviço
  const handleRemoveService = (serviceName: string) => {
    setServices(prev => {
      const newServices = { ...prev };
      delete newServices[serviceName];
      return newServices;
    });
  };

  // Adicionar um novo serviço
  const handleAddService = (service: Service) => {
    // Verificar se o serviço já existe
    if (services[service.name]) {
      toast.warn(`O serviço ${service.name} já foi adicionado`);
      return;
    }

    setServices(prev => ({
      ...prev,
      [service.name]: {
        id: service.id,
        name: service.name,
        price: service.price,
        originalPrice: service.price,
        commission: service.commission
      }
    }));
  };

  // Alterar a quantidade de um produto
  const handleProductQuantityChange = (productName: string, newQuantity: number) => {
    setProducts(prev => ({
      ...prev,
      [productName]: {
        ...prev[productName],
        quantity: newQuantity
      }
    }));
  };

  // Alterar preço de um produto
  const handleProductPriceChange = (productName: string, newPrice: number) => {
    setProducts(prev => ({
      ...prev,
      [productName]: {
        ...prev[productName],
        price: newPrice
      }
    }));
  };

  // Remover um produto
  const handleRemoveProduct = (productName: string) => {
    setProducts(prev => {
      const newProducts = { ...prev };
      delete newProducts[productName];
      return newProducts;
    });
  };

  // Adicionar um novo produto
  const handleAddProduct = (product: Product) => {
    // Verificar se o produto já existe
    if (products[product.name]) {
      // Apenas aumentar a quantidade
      handleProductQuantityChange(
        product.name, 
        (products[product.name].quantity || 0) + 1
      );
      return;
    }

    setProducts(prev => ({
      ...prev,
      [product.name]: {
        id: product.id,
        name: product.name,
        price: product.price,
        originalPrice: product.price,
        quantity: 1,
        cost_price: product.cost_price
      }
    }));
  };

  // Calcular total
  const calculateTotal = () => {
    let total = 0;
    
    // Somar serviços
    Object.values(services).forEach(service => {
      total += Number(service.price) || 0;
    });
    
    // Somar produtos
    Object.values(products).forEach(product => {
      total += (Number(product.price) || 0) * (Number(product.quantity) || 1);
    });
    
    return total;
  };

  // Calcular comissão
  const calculateCommission = () => {
    let commission = 0;
    
    // Somar comissões dos serviços
    Object.values(services).forEach(service => {
      const servicePrice = Number(service.price) || 0;
      const commissionRate = Number(service.commission) || 0.5; // padrão 50%
      commission += servicePrice * commissionRate;
    });
    
    return commission;
  };

  // Calcular taxa de pagamento
  const calculatePaymentFee = () => {
    const total = calculateTotal();
    const selectedMethod = paymentMethods.find(m => m.id === paymentMethodId);
    
    if (!selectedMethod) return 0;
    
    return total * (selectedMethod.fee / 100);
  };

  // Salvar as alterações
  const handleSave = async () => {
    setIsLoading(true);
    
    try {
      // Preparar dados dos serviços no formato compatível com a API
      const servicesData = Object.values(services).map(service => ({
        service_id: service.id,
        professional_id: appointment.professional?.id,
        original_price: service.originalPrice || service.price,
        final_price: service.price,
        commission_rate: service.commission || 0.5 // Taxa de comissão padrão se não informada
      }));
      
      // Preparar dados dos produtos no formato compatível com a API
      const productsData = Object.values(products).map(product => ({
        product_id: product.id,
        quantity: product.quantity || 1,
        unit_price: product.price,
        total_price: product.price * (product.quantity || 1)
      }));
      
      // Calcular valores derivados
      const servicesTotal = Object.values(services).reduce((sum, s) => sum + Number(s.price || 0), 0);
      const productsTotal = Object.values(products).reduce((sum, p) => sum + Number(p.price || 0) * Number(p.quantity || 1), 0);
      const totalValue = servicesTotal + productsTotal;
      
      // Verificar se o método de pagamento tem taxa
      const selectedMethod = paymentMethods.find(m => m.id === paymentMethodId);
      const paymentFee = selectedMethod?.fee || 0;
      const netValue = paymentFee > 0 ? totalValue * (1 - paymentFee / 100) : totalValue;
      
      // Dados para atualização
      const updateData = {
        // Dados de serviços no formato services_data
        services_data: servicesData,
        // Valores financeiros
        services_total_value: servicesTotal,
        // products_total_value: productsTotal, // Removido - campo não existe mais no banco
        net_value: netValue,
        // Método de pagamento
        payment_method_id: paymentMethodId,
        // Dados de produtos em JSON para banco de dados
        products_data: productsData,
        // custom_prices foi removido do banco de dados e não é mais usado
        // Manter compatibilidade com interfaces antigas
        services: Object.values(services).filter(s => s.id).map(s => s.id),
        confirmation: {
          services_data: services,
          products_data: products,
          payment_method_id: paymentMethodId
        }
      };
      
      const response = await fetch('/api/appointments/saveConfirmation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('Confirmação salva com sucesso!');
        onSave();
      } else {
        toast.error(`Erro ao salvar confirmação: ${data.message}`);
      }
    } catch (error) {
      console.error('Erro ao salvar confirmação:', error);
      toast.error('Erro ao salvar confirmação. Verifique sua conexão.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-lg max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Editar Confirmação de Atendimento</h2>
        <button 
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p><span className="font-medium">Cliente:</span> {appointment.client?.name}</p>
          <p><span className="font-medium">Profissional:</span> {appointment.professional?.name}</p>
        </div>
        <div>
          <p><span className="font-medium">Data:</span> {appointment.date}</p>
          <p><span className="font-medium">Hora:</span> {appointment.time}</p>
        </div>
      </div>
      
      {/* Método de pagamento */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Método de Pagamento
        </label>
        <select
          value={paymentMethodId}
          onChange={(e) => setPaymentMethodId(e.target.value)}
          className="block w-full p-2 border border-gray-300 rounded-md shadow-sm"
        >
          <option value="">Selecione um método</option>
          {paymentMethods.map(method => (
            <option key={method.id} value={method.id}>
              {method.name} {method.fee > 0 ? `(${method.fee}%)` : ''}
            </option>
          ))}
        </select>
      </div>
      
      {/* Serviços */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-md font-medium text-gray-800">Serviços</h3>
          <div className="relative">
            <select
              onChange={(e) => {
                const serviceId = e.target.value;
                if (!serviceId) return;
                
                const service = availableServices.find(s => s.id === serviceId);
                if (service) {
                  handleAddService(service);
                  e.target.value = ''; // Resetar após adicionar
                }
              }}
              className="block w-full p-2 border border-gray-300 rounded-md shadow-sm text-sm"
            >
              <option value="">Adicionar serviço...</option>
              {availableServices.map(service => (
                <option key={service.id} value={service.id}>
                  {service.name} - R$ {formatCurrency(service.price)}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="bg-gray-50 p-3 rounded-md">
          {Object.keys(services).length === 0 ? (
            <p className="text-gray-500 text-sm">Nenhum serviço adicionado</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(services).map(([name, service]) => (
                <div key={name} className="flex items-center justify-between bg-white p-2 rounded shadow-sm">
                  <div className="flex-grow">
                    <p className="font-medium">{name}</p>
                    <div className="flex items-center mt-1">
                      <span className="text-sm text-gray-600 mr-2">Preço:</span>
                      <input
                        type="number"
                        value={service.price}
                        onChange={(e) => handleServicePriceChange(name, Number(e.target.value))}
                        className="p-1 w-24 text-sm border border-gray-300 rounded"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                  <div className="flex items-center">
                    {service.originalPrice !== service.price && (
                      <span className="text-sm line-through text-gray-500 mr-2">
                        {formatCurrency(service.originalPrice || 0)}
                      </span>
                    )}
                    <span className="font-medium">
                      {formatCurrency(service.price)}
                    </span>
                    <button
                      onClick={() => handleRemoveService(name)}
                      className="ml-2 text-red-500 hover:text-red-700"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Produtos */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-md font-medium text-gray-800">Produtos</h3>
          <div className="relative">
            <select
              onChange={(e) => {
                const productId = e.target.value;
                if (!productId) return;
                
                const product = availableProducts.find(p => p.id === productId);
                if (product) {
                  handleAddProduct(product);
                  e.target.value = ''; // Resetar após adicionar
                }
              }}
              className="block w-full p-2 border border-gray-300 rounded-md shadow-sm text-sm"
            >
              <option value="">Adicionar produto...</option>
              {availableProducts.map(product => (
                <option key={product.id} value={product.id}>
                  {product.name} - R$ {formatCurrency(product.price)}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="bg-gray-50 p-3 rounded-md">
          {Object.keys(products).length === 0 ? (
            <p className="text-gray-500 text-sm">Nenhum produto adicionado</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(products).map(([name, product]) => (
                <div key={name} className="flex items-center justify-between bg-white p-2 rounded shadow-sm">
                  <div className="flex-grow">
                    <p className="font-medium">{name}</p>
                    <div className="flex items-center mt-1">
                      <span className="text-sm text-gray-600 mr-2">Qtd:</span>
                      <input
                        type="number"
                        value={product.quantity}
                        onChange={(e) => handleProductQuantityChange(name, Number(e.target.value))}
                        className="p-1 w-16 text-sm border border-gray-300 rounded"
                        min="1"
                        step="1"
                      />
                      <span className="text-sm text-gray-600 mx-2">Preço:</span>
                      <input
                        type="number"
                        value={product.price}
                        onChange={(e) => handleProductPriceChange(name, Number(e.target.value))}
                        className="p-1 w-24 text-sm border border-gray-300 rounded"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>
                  <div className="flex items-center">
                    {product.originalPrice !== product.price && (
                      <span className="text-sm line-through text-gray-500 mr-2">
                        {formatCurrency(product.originalPrice || 0)}
                      </span>
                    )}
                    <span className="font-medium">
                      {formatCurrency(product.price * product.quantity)} ({product.quantity}x)
                    </span>
                    <button
                      onClick={() => handleRemoveProduct(name)}
                      className="ml-2 text-red-500 hover:text-red-700"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Resumo */}
      <div className="bg-gray-100 p-4 rounded-md mb-4">
        <h3 className="text-md font-medium text-gray-800 mb-2">Resumo</h3>
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <span>Total:</span>
            <span className="font-medium">{formatCurrency(calculateTotal())}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Comissão do Profissional:</span>
            <span className="font-medium">{formatCurrency(calculateCommission())}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Taxa de Pagamento:</span>
            <span className="font-medium">{formatCurrency(calculatePaymentFee())}</span>
          </div>
          <div className="flex justify-between items-center font-bold">
            <span>Lucro do Salão:</span>
            <span>{formatCurrency(calculateTotal() - calculateCommission() - calculatePaymentFee())}</span>
          </div>
        </div>
      </div>
      
      {/* Botões */}
      <div className="flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 mr-2 hover:bg-gray-50"
          disabled={isLoading}
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? 'Salvando...' : 'Salvar Confirmação'}
        </button>
      </div>
    </div>
  );
};

export default EditarConfirmacao; 