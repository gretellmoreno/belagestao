import React, { useState, useEffect, useMemo } from 'react';
import { X, Check, Plus, Search, ShoppingBag } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  updateAppointment,
  type Appointment,
  finalizeAppointment
} from '../../lib/appointmentService';
import ServicesModal from './ServicesModal';
import { supabase } from '../../lib/supabaseClient';
import { useProducts } from '../../hooks/useProducts';

interface Service {
  id: string;
  name: string;
  price: number;
  estimated_time?: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface CheckoutModalProps {
  appointment: any;
  onClose: () => void;
  onSave: () => void;
  availableServices: Service[];
  availableProducts?: any[];
  paymentMethods: {
    id: string | number;
    name: string;
    fee?: number;
  }[];
}

export default function CheckoutModal({
  appointment,
  onClose,
  onSave,
  availableServices,
  availableProducts,
  paymentMethods
}: CheckoutModalProps) {
  // Estados
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<{ id: string | number; name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Adicionando estado de erro para mensagens de erro
  const [error, setError] = useState<string | null>(null);
  const [showServicesModal, setShowServicesModal] = useState(false);
  const [showProductsModal, setShowProductsModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Estado para busca de produtos
  const [productSearch, setProductSearch] = useState('');
  
  // Modificar o hook useProducts para incluir informações de estoque
  const { products, loading: productsLoading } = useProducts();
  
  // Filtrar produtos baseado na busca e mostrar informação de estoque
  const filteredProducts = useMemo(() => {
    return products.filter(product =>
      product.name.toLowerCase().includes(productSearch.toLowerCase())
    ).map(product => ({
      ...product,
      // Garantir que stock seja um número
      stock: typeof product.stock === 'number' ? product.stock : 0
    }));
  }, [productSearch, products]);
  
  // Função utilitária para validar UUID
  const isValidUUID = (id: string) => {
    if (!id) return false;
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidPattern.test(id);
  };
  
  // Inicializar com os serviços existentes do agendamento
  useEffect(() => {
    // Verificar se o agendamento possui serviços
    if (appointment && appointment.appointment_services && Array.isArray(appointment.appointment_services)) {
      console.log('Inicializando serviços do agendamento a partir de appointment_services:', appointment.appointment_services);
      
      const mappedServices = appointment.appointment_services.map((serviceData: any) => {
        if (!serviceData.service) {
          console.warn('Serviço sem detalhes encontrado:', serviceData);
          return null;
        }
        
        return {
          id: serviceData.service_id,
          name: serviceData.service?.name || `Serviço ${serviceData.service_id.substring(0, 6)}...`,
          price: serviceData.custom_price || serviceData.service?.price || 0,
          estimated_time: serviceData.custom_time || serviceData.service?.estimated_time || 0
        };
      }).filter(Boolean);
      
      if (mappedServices.length > 0) {
        console.log('Serviços mapeados a partir de appointment_services:', mappedServices);
        setSelectedServices(mappedServices);
        return;
      }
    } else if (appointment && appointment.services_data && Array.isArray(appointment.services_data)) {
      console.log('Inicializando serviços do agendamento a partir de services_data:', appointment.services_data);
      
      const mappedServices = appointment.services_data.map((serviceData: any) => {
        // Buscar detalhes completos do serviço em availableServices
        const serviceDetails = availableServices.find(s => s.id === serviceData.service_id);
        
        if (serviceDetails) {
          return {
            ...serviceDetails,
            price: serviceData.final_price || serviceDetails.price
          };
        }
        
        // Se não encontrar o serviço nos disponíveis, usar os dados básicos do services_data
        return {
          id: serviceData.service_id,
          name: serviceData.service_name || `Serviço ${serviceData.service_id.substring(0, 6)}...`,
          price: serviceData.final_price || 50
        };
      });
      
      if (mappedServices.length > 0) {
        console.log('Serviços mapeados a partir de services_data:', mappedServices);
        setSelectedServices(mappedServices);
        return;
      }
    } else if (appointment && appointment.services && Array.isArray(appointment.services)) {
      // Fallback para o formato antigo de services (array de IDs)
      console.log('Usando formato services (array de IDs) para inicializar serviços');
      const mappedServices = appointment.services.map((serviceId: string) => {
        // Verificar se é um ID ou já um objeto completo
        if (typeof serviceId === 'string') {
          // Buscar o serviço completo nos disponíveis
          const serviceDetails = availableServices.find(s => s.id === serviceId);
          if (serviceDetails) {
            // Verificar se existe um preço personalizado para este serviço
            const customPrice = appointment.custom_prices?.[serviceId];
            return {
              ...serviceDetails,
              price: customPrice || serviceDetails.price
            };
          }
          // Se não encontrar nos disponíveis, criar um serviço padrão com o ID
          return {
            id: serviceId,
            name: `Serviço ${serviceId.substring(0, 6)}...`,
            price: 50
          };
        }
        // Se já for um objeto, usá-lo diretamente
        return serviceId;
      });
      
      if (mappedServices.length > 0) {
        console.log('Serviços mapeados a partir do array services:', mappedServices);
        setSelectedServices(mappedServices);
        return;
      }
    }
    
    // Se não houver serviços no agendamento, inicializar com array vazio
    console.log('Nenhum serviço encontrado no agendamento, iniciando lista vazia');
    setSelectedServices([]);
  }, [appointment, availableServices]);
  
  // Função para processar serviços do agendamento (novos e existentes)
  const processAppointmentServices = async () => {
    if (!selectedPaymentMethod) {
      throw new Error('Método de pagamento não selecionado');
    }

    console.log('Processando serviços do agendamento...');
    console.log('Serviços selecionados:', selectedServices);
    
    // 1. Buscar serviços existentes no banco
    const { data: existingServices, error: fetchError } = await supabase
      .from('appointment_services')
      .select('service_id')
      .eq('appointment_id', appointment.id);
      
    if (fetchError) {
      console.error('Erro ao buscar serviços existentes:', fetchError);
      throw fetchError;
    }
    
    const existingServiceIds = existingServices?.map(s => s.service_id) || [];
    console.log('Serviços existentes no banco:', existingServiceIds);
    
    // 2. Identificar serviços novos e existentes
    const newServices = selectedServices.filter(service => 
      !existingServiceIds.includes(service.id)
    );
    const existingServicesToUpdate = selectedServices.filter(service => 
      existingServiceIds.includes(service.id)
    );
    
    console.log('Serviços novos a inserir:', newServices);
    console.log('Serviços existentes a atualizar:', existingServicesToUpdate);
    
    // 3. Inserir novos serviços
    if (newServices.length > 0) {
      const servicesToInsert = newServices.map(service => ({
        appointment_id: appointment.id,
        service_id: service.id,
        custom_price: service.price,
        custom_time: service.estimated_time,
        payment_method_id: selectedPaymentMethod.id,
        created_at: new Date().toISOString()
      }));
      
      console.log('Inserindo novos serviços:', servicesToInsert);
      
      const { error: insertError } = await supabase
        .from('appointment_services')
        .insert(servicesToInsert);
        
      if (insertError) {
        console.error('Erro ao inserir novos serviços:', insertError);
        throw insertError;
      } else {
        console.log(`${newServices.length} novos serviços inseridos com sucesso`);
      }
    }
    
    // 4. Atualizar serviços existentes
    for (const service of existingServicesToUpdate) {
      const { error } = await supabase
        .from('appointment_services')
        .update({ 
          payment_method_id: selectedPaymentMethod.id,
          custom_price: service.price,
          custom_time: service.estimated_time,
          updated_at: new Date().toISOString()
        })
        .eq('appointment_id', appointment.id)
        .eq('service_id', service.id);
        
      if (error) {
        console.error(`Erro ao atualizar serviço ${service.id}:`, error);
      } else {
        console.log(`Serviço ${service.id} atualizado com sucesso`);
      }
    }
    
    console.log('Processamento de serviços concluído com sucesso');
  };
  
  // Função simplificada para finalizar o atendimento
  const handleFinishAppointment = async () => {
    if (!selectedPaymentMethod) {
      toast.error('Por favor, selecione um método de pagamento');
      return;
    }

    try {
      setIsSubmitting(true);
      // Verificar estoque de todos os produtos antes de finalizar
      const stockIssues = [];
      
      for (const product of selectedProducts) {
        // Buscar informações atualizadas do produto
        const { data: productData, error } = await supabase
          .from('products')
          .select('stock, name')
          .eq('id', product.id)
          .single();
          
        if (error) {
          console.error('Erro ao verificar estoque:', error);
          continue;
        }
        
        // Verificar se tem estoque suficiente
        if (!productData || productData.stock < product.quantity) {
          const available = productData?.stock || 0;
          stockIssues.push({
            name: product.name,
            requested: product.quantity,
            available
          });
        }
      }
      
      // Se houver problemas de estoque, mostrar erro e não continuar
      if (stockIssues.length > 0) {
        const issues = stockIssues.map(issue => 
          `- ${issue.name}: solicitado ${issue.requested}, disponível ${issue.available}`
        ).join('\n');
        
        toast.error(`Produtos com estoque insuficiente:\n${issues}`, { duration: 5000 });
        return;
      }
      
      // Formatar products_data no formato correto
      const formattedProductsData = selectedProducts.map(product => ({
        product_id: product.id,
        product_name: product.name,
        quantity: product.quantity,
        unit_price: product.price,
        payment_method_id: selectedPaymentMethod.id
      }));

      // Primeiro, atualizar o products_data
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ products_data: formattedProductsData })
        .eq('id', appointment.id);

      if (updateError) {
        console.error('Erro ao atualizar products_data:', updateError);
        toast.error('Erro ao salvar produtos do atendimento');
        setIsSubmitting(false);
        return;
      }

      // Criar objeto com dados completos do agendamento finalizado
      const completeAppointmentData = {
        ...appointment,
        status: 'finalizado',
        updated_at: new Date().toISOString(),
        payment_method_id: selectedPaymentMethod.id,
        appointment_services: selectedServices.map(service => ({
          service_id: service.id,
          service: service,
          custom_price: service.price,
          custom_time: service.estimated_time,
          payment_method_id: selectedPaymentMethod.id
        })),
        products_data: formattedProductsData,
        total_value: calculateTotal()
      };

      // Disparar evento de atualização otimista ANTES da chamada à API
      console.log('[CheckoutModal] Disparando atualização otimista:', completeAppointmentData);
      
      const optimisticEvent = new CustomEvent('appointmentUpdated', {
        detail: {
          id: appointment.id,
          date: appointment.date,
          status: 'finalizado',
          forceRefresh: true,
          appointmentData: completeAppointmentData
        }
      });
      window.dispatchEvent(optimisticEvent);

      // Processar serviços do agendamento
      await processAppointmentServices();

      // Chamar onSave imediatamente após processar os serviços
      // para garantir que a UI seja atualizada, independentemente da resposta da API
      if (onSave) {
        console.log('[CheckoutModal] Chamando onSave para atualizar UI imediatamente');
        onSave();
      }

      // Chamar a API para finalizar o agendamento
      const result = await finalizeAppointment(
        appointment.id, 
        selectedPaymentMethod.id.toString(),
        false // discountPaymentFee - por padrão false, pode ser configurado conforme necessário
      );

      if (result) {
        toast.success('Atendimento finalizado com sucesso!');
        
        // Segundo evento com os dados do servidor para garantir sincronização
        // Garantir que forceRefresh seja true para forçar recarregamento completo
        const updatedEvent = new CustomEvent('appointmentUpdated', {
          detail: {
            id: appointment.id,
            date: result.date,
            status: 'finalizado',
            forceRefresh: true, // Sempre forçar atualização
            appointmentData: {
              ...result,
              status: 'finalizado'
            }
          }
        });
        window.dispatchEvent(updatedEvent);
        
        // Fechar o modal
        onClose();
      } else {
        toast.error('Erro ao fechar comanda');
        // Disparar evento para reverter o status em caso de erro
        // Ainda assim forçar uma atualização para garantir dados corretos
        const revertEvent = new CustomEvent('appointmentUpdated', {
          detail: {
            id: appointment.id,
            date: appointment.date,
            status: appointment.status,
            forceRefresh: true
          }
        });
        window.dispatchEvent(revertEvent);
      }
    } catch (error) {
      console.error('Erro ao fechar comanda:', error);
      toast.error('Erro ao fechar comanda');
      
      // Mesmo com erro, forçar uma atualização para garantir consistência
      const errorEvent = new CustomEvent('appointmentUpdated', {
        detail: {
          id: appointment.id,
          date: appointment.date,
          forceRefresh: true
        }
      });
      window.dispatchEvent(errorEvent);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Adicionar produto ao checkout - com verificação de estoque
  const addProduct = (product: any) => {
    console.log("Verificando estoque do produto:", product);
    
    // Verificar se o produto tem estoque disponível
    if (product.stock <= 0) {
      toast.error(`🔴 Produto "${product.name}" fora de estoque`);
      return;
    }
    
    const existing = selectedProducts.find(p => p.id === product.id);
    
    if (existing) {
      // Calcular nova quantidade após adicionar
      const newQuantity = existing.quantity + 1;
      
      // Verificar se tem estoque suficiente
      if (newQuantity > product.stock) {
        toast.error(`🟡 Estoque insuficiente: restam apenas ${product.stock} unidades de "${product.name}"`);
        return;
      }
      
      // Aumentar quantidade se já existir e tiver estoque
      setSelectedProducts(prevProducts => 
        prevProducts.map(p => p.id === product.id 
          ? { ...p, quantity: newQuantity } 
          : p
        )
      );
      
      // Fechar o modal após adicionar
      setShowProductsModal(false);
      toast.success(`${product.name} adicionado (${newQuantity}x)`);
      
    } else {
      // Adicionar novo produto
      setSelectedProducts(prevProducts => [
        ...prevProducts, 
        { 
          id: product.id, 
          name: product.name, 
          price: product.price, 
          quantity: 1,
          stock: product.stock // Manter informação de estoque
        }
      ]);
      
      // Fechar o modal após adicionar
      setShowProductsModal(false);
      toast.success(`${product.name} adicionado`);
    }
  };
  
  // Adicionar serviço ao checkout
  const addService = (service: Service) => {
    console.log("Adicionando serviço:", service);
    
    // Verificar se o serviço já existe na lista
    const existing = selectedServices.find(s => s.id === service.id);
    
    if (!existing) {
      setSelectedServices(prev => [...prev, service]);
    }
    
    // Fechar o modal após adicionar
    setShowServicesModal(false);
  };

  // Remover produto do checkout
  const removeProduct = (productId: string) => {
    setSelectedProducts(prev => prev.filter(p => p.id !== productId));
  };
  
  // Remover serviço do checkout
  const removeService = (serviceId: string) => {
    setSelectedServices(prev => prev.filter(s => s.id !== serviceId));
  };
  
  // Atualizar preço de produto
  const updateProductPrice = (productId: string, newPrice: number) => {
    setSelectedProducts(prev => prev.map(p => 
      p.id === productId ? { ...p, price: newPrice } : p
    ));
  };
  
  // Atualizar preço de serviço
  const updateServicePrice = (serviceId: string, newPrice: number) => {
    setSelectedServices(prev => prev.map(s => 
      s.id === serviceId ? { ...s, price: newPrice } : s
    ));
  };
  
  // Função para formatar valor do input de preço
  const formatPriceInput = (value: string) => {
    // Remove qualquer caractere que não seja número
    const numbers = value.replace(/\D/g, '');
    
    // Formata o número com a vírgula decimal
    if (numbers.length > 0) {
      const integerPart = numbers.slice(0, -2) || '0';
      const decimalPart = numbers.slice(-2).padStart(2, '0');
      
      // Formata com pontos para milhares
      const formattedInteger = integerPart.replace(/^0+/, '').split('').reverse().join('')
        .match(/.{1,3}/g)?.join('.')
        .split('')
        .reverse()
        .join('') || '0';
      
      return formattedInteger + ',' + decimalPart;
    }
    
    return '';
  };
  
  // Função para processar input de preço de produto
  const handleProductPriceInput = (value: string, productId: string, quantity: number) => {
    // Remove qualquer caractere que não seja número
    const numbers = value.replace(/\D/g, '');
    
    // Converte para centavos e depois para reais
    const price = numbers ? Number(numbers) / 100 : 0;
    
    // Atualiza o preço do produto (dividindo pelo quantity para obter o preço unitário)
    updateProductPrice(productId, price / quantity);
  };
  
  // Função para processar input de preço de serviço
  const handleServicePriceInput = (value: string, serviceId: string) => {
    // Remove qualquer caractere que não seja número
    const numbers = value.replace(/\D/g, '');
    
    // Converte para centavos e depois para reais
    const price = numbers ? Number(numbers) / 100 : 0;
    
    // Atualiza o preço do serviço
    updateServicePrice(serviceId, price);
  };

  // Calcular total
  const calculateTotal = () => {
    const productsTotal = selectedProducts.reduce((sum, product) => 
      sum + (product.price * product.quantity), 0);
    
    const servicesTotal = selectedServices.reduce((sum, service) => 
      sum + service.price, 0);
    
    return productsTotal + servicesTotal;
  };

  const handlePaymentMethodSelect = (method: { id: string | number; name: string }) => {
    setSelectedPaymentMethod(method);
    toast.success(`Pagamento: ${method.name} selecionado`);
  };

  // Atualizar quantidade de produto com verificação de estoque
  const updateProductQuantity = (productId: string, delta: number) => {
    setSelectedProducts(prev => {
      return prev.map(p => {
        if (p.id === productId) {
          const newQuantity = p.quantity + delta;
          
          // Não permitir quantidade menor que 1
          if (newQuantity < 1) return p;
          
          // Verificar estoque máximo
          if (delta > 0) {
            // Buscar produto completo para verificar estoque
            const fullProduct = products.find(prod => prod.id === productId);
            const stockAvailable = fullProduct?.stock || 0;
            
            if (newQuantity > stockAvailable) {
              toast.error(`🟡 Estoque insuficiente: restam apenas ${stockAvailable} unidades`);
              return p;
            }
          }
          
          return { ...p, quantity: newQuantity };
        }
        return p;
      });
    });
  };

  return (
    <div className="p-5">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Fechar Comanda</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>
      </div>

      {/* Produtos */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-medium text-sm">Produtos</h3>
          <button 
            className="text-indigo-600 text-xs font-medium flex items-center"
            onClick={() => setShowProductsModal(true)}
          >
            <Plus size={14} className="mr-1" /> Adicionar
          </button>
        </div>
        {selectedProducts.length > 0 ? (
          <div className="space-y-2">
            {selectedProducts.map(product => {
              // Buscar informações atualizadas do produto, incluindo estoque
              const fullProduct = products.find(p => p.id === product.id);
              const stockAvailable = fullProduct?.stock || 0;
              const hasStockIssue = product.quantity > stockAvailable;
              
              return (
                <div 
                  key={product.id} 
                  className={`flex justify-between items-center py-2 px-3 rounded-md ${hasStockIssue ? 'bg-red-50' : ''}`}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{product.name}</span>
                    {hasStockIssue && (
                      <span className="text-xs text-red-500">
                        Estoque insuficiente (disponível: {stockAvailable})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center">
                    {/* Controles de quantidade */}
                    <div className="flex items-center mr-3 border rounded-md">
                      <button
                        onClick={() => updateProductQuantity(product.id, -1)}
                        className="px-2 py-1 text-gray-500 hover:bg-gray-100"
                      >
                        -
                      </button>
                      <span className="px-2 py-1 min-w-[30px] text-center">{product.quantity}</span>
                      <button
                        onClick={() => updateProductQuantity(product.id, 1)}
                        className={`px-2 py-1 ${product.quantity >= stockAvailable ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-100'}`}
                        disabled={product.quantity >= stockAvailable}
                      >
                        +
                      </button>
                    </div>
                    
                    <div className="mr-2 relative">
                      <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500">R$</span>
                      <input
                        type="text"
                        value={formatPriceInput((product.price * product.quantity).toFixed(2).replace('.', ''))}
                        onChange={(e) => handleProductPriceInput(e.target.value, product.id, product.quantity)}
                        className="pl-8 py-1 w-24 border rounded-md text-right"
                        onFocus={(e) => e.target.select()}
                      />
                    </div>
                    <button className="text-gray-400 hover:text-red-500" onClick={() => removeProduct(product.id)}>
                      <X size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-gray-500">
            Nenhum produto selecionado
          </div>
        )}
      </div>

      {/* Serviços */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-medium text-sm">Serviços</h3>
          <button 
            className="text-indigo-600 text-xs font-medium flex items-center"
            onClick={() => setShowServicesModal(true)}
          >
            <Plus size={14} className="mr-1" /> Adicionar
          </button>
        </div>
        {selectedServices.length > 0 ? (
          <div className="space-y-2">
            {selectedServices.map(service => (
              <div key={service.id} className="flex justify-between items-center py-2">
                <span>{service.name}</span>
                <div className="flex items-center">
                  <div className="mr-2 relative">
                    <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500">R$</span>
                    <input
                      type="text"
                      value={formatPriceInput(service.price.toFixed(2).replace('.', ''))}
                      onChange={(e) => handleServicePriceInput(e.target.value, service.id)}
                      className="pl-8 py-1 w-24 border rounded-md text-right"
                      onFocus={(e) => e.target.select()}
                    />
                  </div>
                  <button 
                    className="text-gray-400 hover:text-red-500" 
                    onClick={() => removeService(service.id)}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500">
            Nenhum serviço selecionado
          </div>
        )}
      </div>

      {/* Total */}
      <div className="mb-3 font-medium">
        <div className="flex justify-between items-center py-1">
          <span className="text-sm">Total</span>
          <span className="text-indigo-600">
            R$ {calculateTotal().toFixed(2).replace('.', ',')}
          </span>
        </div>
      </div>

      {/* Pagamento */}
      <div className="mb-4">
        <h3 className="font-medium mb-2">Pagamento</h3>
        <div className="flex flex-wrap gap-1.5">
          {paymentMethods.map(method => (
            <button
              key={method.id}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                String(selectedPaymentMethod?.id) === String(method.id) 
                  ? 'bg-indigo-100 text-indigo-700 border border-indigo-300 shadow-sm' 
                  : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
              }`}
              onClick={() => handlePaymentMethodSelect(method)}
            >
              {method.name}
            </button>
          ))}
        </div>
      </div>

      {/* Ações */}
      <div className="flex justify-end gap-2 mt-3">
        <button
          className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-md hover:bg-gray-50"
          onClick={onClose}
        >
          Cancelar
        </button>
        <button
          className={`px-3 py-1.5 text-xs font-medium rounded-md ${selectedPaymentMethod ? 'bg-indigo-500 hover:bg-indigo-600' : 'bg-indigo-300'} text-white flex items-center justify-center`}
          onClick={handleFinishAppointment}
          disabled={!selectedPaymentMethod || isLoading}
        >
          {isLoading ? (
            <span className="animate-spin mr-1">⏳</span>
          ) : (
            <Check size={14} className="mr-1" />
          )}
          {selectedPaymentMethod ? 'Fechar Comanda' : 'Selecione um pagamento'}
        </button>
      </div>

      {/* Modal de produtos - Atualizar para mostrar informação de estoque */}
      {showProductsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-5 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Selecionar Produtos</h3>
              <button 
                onClick={() => setShowProductsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            {/* Barra de busca */}
            <div className="relative mb-4">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar produtos..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
            </div>

            {/* Lista de produtos com indicador de estoque */}
            <div className="space-y-2">
              {filteredProducts.length > 0 ? (
                filteredProducts.map(product => (
                  <div 
                    key={product.id} 
                    className={`flex justify-between items-center p-3 border rounded-md ${
                      product.stock <= 0 
                        ? 'border-red-200 bg-red-50 cursor-not-allowed' 
                        : 'border-gray-100 hover:bg-gray-50 cursor-pointer'
                    }`}
                    onClick={() => {
                      if (product.stock > 0) {
                        addProduct(product);
                      } else {
                        toast.error(`🔴 Produto "${product.name}" fora de estoque`);
                      }
                    }}
                  >
                    <div>
                      <div className="font-medium">{product.name}</div>
                      <div className="text-sm text-gray-500">
                        R$ {product.price.toFixed(2).replace('.', ',')}
                        {product.stock <= 0 ? (
                          <span className="ml-2 text-red-500 font-medium">Sem estoque</span>
                        ) : product.stock <= 5 ? (
                          <span className="ml-2 text-amber-500 font-medium">Estoque: {product.stock}</span>
                        ) : (
                          <span className="ml-2 text-green-500 font-medium">Disponível</span>
                        )}
                      </div>
                    </div>
                    <div className={product.stock <= 0 ? "text-gray-300" : "text-indigo-600"}>
                      <Plus size={20} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <ShoppingBag className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>{productSearch ? 'Nenhum produto encontrado' : 'Nenhum produto disponível'}</p>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowProductsModal(false)}
                className="px-4 py-2 bg-indigo-500 text-white rounded-md"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de serviços */}
      {showServicesModal && (
        <ServicesModal 
          availableServices={availableServices}
          onAddService={addService}
          onClose={() => setShowServicesModal(false)}
        />
      )}
    </div>
  );
} 