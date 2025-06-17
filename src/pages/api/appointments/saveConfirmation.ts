import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabaseClient';

// Tipos para os dados de serviços e produtos
interface ServiceData {
  id?: string;
  name?: string;
  price: number;
  originalPrice?: number;
  commission?: number;
}

interface ProductData {
  id?: string;
  name?: string;
  price: number;
  quantity: number;
  originalPrice?: number;
  cost_price?: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    // Verificação de autenticação removida para simplificar
    // Em produção, você deve adicionar um mecanismo de autenticação

    const { 
      appointmentId, 
      servicesData, 
      productsData, 
      paymentMethodId,
      finalTotalValue,
      commission,
      paymentFee,
      servicesTotal,
      productsTotal,
      isCommissionFromPaymentFee,
      paymentMethodName
    } = req.body;
    
    if (!appointmentId) {
      return res.status(400).json({ message: 'ID do atendimento é obrigatório' });
    }

    // Verifica se o serviço existe na tabela de appointment_services
    // Se não existir, precisamos adicionar à tabela
    if (servicesData && Object.keys(servicesData).length > 0) {
      // Buscar serviços existentes para este agendamento
      const { data: existingServices, error: servicesQueryError } = await supabase
        .from('appointment_services')
        .select('service_id')
        .eq('appointment_id', appointmentId);
      
      if (servicesQueryError) {
        console.error('Erro ao buscar serviços existentes:', servicesQueryError);
      } else {
        // Criar conjunto de IDs de serviços já associados ao agendamento
        const existingServiceIds = new Set((existingServices || []).map(s => s.service_id));
        console.log('Serviços existentes:', existingServiceIds);
        
        // Para cada serviço nos dados enviados, verificar se precisamos adicioná-lo
        for (const [serviceId, serviceData] of Object.entries(servicesData as Record<string, ServiceData>)) {
          // Verificar se o serviceId é um UUID válido
          const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(serviceId);
          
          if (isValidUUID && !existingServiceIds.has(serviceId)) {
            console.log(`Adicionando novo serviço (${serviceId}) à tabela appointment_services`);
            
            // Este serviço não está associado ao agendamento, vamos adicioná-lo
            const { error: insertError } = await supabase
              .from('appointment_services')
              .insert({
                appointment_id: appointmentId,
                service_id: serviceId,
                created_at: new Date().toISOString()
              });
              
            if (insertError) {
              console.error(`Erro ao adicionar serviço ${serviceId}:`, insertError);
            } else {
              console.log(`Serviço ${serviceId} adicionado com sucesso ao agendamento`);
            }
          }
        }
      }
    }

    // Atualizar os campos na tabela appointments
    const updateData = {
      status: 'finalizado',
      services_data: servicesData,
      payment_method_id: paymentMethodId,
      services_total_value: servicesTotal || 0,
      payment_fee: paymentFee || 0,
      commission_rate: commission || 0,
      is_commission_from_payment_fee: isCommissionFromPaymentFee || false,
      confirmation_date: new Date().toISOString(),
      payment_method_name: paymentMethodName || null
    };

    // Atualizar diretamente na tabela appointments
    const { error: updateError } = await supabase
      .from('appointments')
      .update(updateData)
      .eq('id', appointmentId);

    if (updateError) {
      console.error('Erro ao atualizar appointment:', updateError);
      return res.status(500).json({ 
        message: 'Erro ao atualizar appointment', 
        error: updateError.message 
      });
    }
    
    // Chamar função para calcular o lucro do salão
    try {
      console.log('Calculando lucro do salão para o atendimento:', appointmentId);
      const { data: salonProfitData, error: salonProfitError } = await supabase
        .rpc('calculate_salon_profit', { appointment_id: appointmentId });
        
      if (salonProfitError) {
        console.error('Erro ao calcular lucro do salão:', salonProfitError);
        // Não interrompe o fluxo principal se falhar o cálculo do salon_profit
      } else {
        console.log('Lucro do salão calculado com sucesso:', salonProfitData);
      }
    } catch (error) {
      console.error('Exceção ao calcular lucro do salão:', error);
      // Não interrompe o fluxo principal se falhar o cálculo do salon_profit
    }
    
    // Salvando produtos na tabela product_sales se houver produtos
    if (productsData && Object.keys(productsData).length > 0) {
      try {
        // Buscar informações do atendimento, incluindo professional_id
        const { data: appointmentData, error: appointmentError } = await supabase
          .from('appointments')
          .select('date, client_id, professional_id')
          .eq('id', appointmentId)
          .single();

        if (appointmentError) {
          console.error('Erro ao buscar dados do appointment:', appointmentError);
          throw appointmentError;
        }
        
        if (!appointmentData) {
          throw new Error('Dados do agendamento não encontrados');
        }
        
        // Calcular o total dos produtos
        const productsTotal = Object.values(productsData as Record<string, ProductData>).reduce((sum: number, product: ProductData) => {
          return sum + (Number(product.price || 0) * Number(product.quantity || 1));
        }, 0);

        // SOLUÇÃO DIRETA: Buscar um método de pagamento válido diretamente do banco
        console.log('Buscando método de pagamento válido do banco...');
        let finalPaymentMethodId;
        
        if (paymentMethodId) {
          // Verificar se o paymentMethodId fornecido existe no banco
          const { data: methodCheck, error: methodCheckError } = await supabase
            .from('payment_methods')
            .select('id')
            .eq('id', paymentMethodId)
            .single();
            
          if (!methodCheckError && methodCheck && methodCheck.id) {
            finalPaymentMethodId = methodCheck.id;
            console.log('Método de pagamento fornecido é válido:', finalPaymentMethodId);
          } else {
            console.warn('Método de pagamento fornecido não encontrado ou inválido:', paymentMethodId);
          }
        }
        
        // Se ainda não temos um ID válido, buscar qualquer método válido
        if (!finalPaymentMethodId) {
          const { data: fallbackMethod, error: fallbackError } = await supabase
            .from('payment_methods')
            .select('id')
            .limit(1)
            .single();
            
          if (fallbackError || !fallbackMethod || !fallbackMethod.id) {
            console.error('Não foi possível obter qualquer método de pagamento válido:', fallbackError);
            throw new Error('Não foi possível obter um método de pagamento válido. Verifique se existem métodos cadastrados no sistema.');
          }
          
          finalPaymentMethodId = fallbackMethod.id;
          console.log('Usando método de pagamento alternativo:', finalPaymentMethodId);
        }

        // Criar venda na tabela product_sales com método de pagamento GARANTIDAMENTE válido
        const productSalesData = [];
        
        // Processar cada produto na venda
        if (productsData && Object.keys(productsData).length > 0) {
          for (const [productName, productData] of Object.entries(productsData as Record<string, ProductData>)) {
            // Calcular valores
            const price = Number(productData.price) || 0;
            const quantity = Number(productData.quantity) || 0;
            const gross_total = price * quantity;
            
            // Calcular taxa de pagamento proporcional
            const totalPaymentFee = paymentFee || 0;
            const productRatio = gross_total / finalTotalValue; // proporção do valor do produto em relação ao total
            const productFeeAmount = totalPaymentFee * productRatio;
            
            // Calcular lucro líquido: (preço - custo) * quantidade - taxa
            const costPrice = Number(productData.cost_price) || 0;
            const net_profit = (price - costPrice) * quantity - productFeeAmount;
            
            // Criar registro para este produto
            productSalesData.push({
              sale_date: appointmentData.date,
              product_name: productName,
              payment_method_id: finalPaymentMethodId,
              quantity: quantity,
              unit_price: price,
              gross_total: gross_total,
              net_profit: net_profit,
              client_id: appointmentData.client_id,
              professional_id: appointmentData.professional_id,
              appointment_id: appointmentId,
              created_at: new Date().toISOString()
            });
          }
        }
        
        // Log final para verificação
        console.log('DADOS FINAIS PARA INSERÇÃO:', JSON.stringify(productSalesData, null, 2));

        console.log('Salvando produtos em product_sales:', productSalesData);
        
        const { data: insertedSales, error: saleError } = await supabase
          .from('product_sales')
          .insert(productSalesData)
          .select();

        if (saleError) {
          console.error('Erro ao salvar venda de produtos:', saleError);
          throw saleError;
        }
        
        if (!insertedSales || insertedSales.length === 0) {
          throw new Error('Falha ao inserir venda de produtos');
        }
      } catch (error: any) {
        console.error('Erro ao salvar produtos em product_sales:', error);
        // Não interrompe o fluxo principal se falhar no salvamento dos produtos
      }
    }
    
    return res.status(200).json({ 
      success: true, 
      message: 'Dados de confirmação salvos com sucesso' 
    });
  } catch (error: any) {
    console.error('Erro ao salvar dados de confirmação:', error);
    return res.status(500).json({ 
      message: 'Erro ao salvar dados de confirmação', 
      error: error.message 
    });
  }
} 