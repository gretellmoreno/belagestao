import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabaseClient';

// Interfaces para tipagem
interface AppointmentService {
  id: any;
  service_id: any;
  custom_price: any;
  payment_method_id: any;
  payment_fee: any;
  salon_profit: any;
  net_service_value: any;
  professional_profit?: any;
  commission_rate?: any;
  services?: any;
  payment_methods?: any;
  service?: any;
  payment_method?: any;
}

interface ProductSale {
  id: string;
  sale_date: string;
  product_id: string;
  product_name: string;
  payment_method_id: string;
  quantity: number;
  unit_price: number;
  gross_total: number;
  net_profit: number;
  professional_id?: string;
  appointment_id?: string;
  source?: 'appointment' | 'sale';
  payment_methods?: any;
  products?: any;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { startDate, endDate, professionalId } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Start date and end date are required' });
    }

    // Query appointments with related data
    let query = supabase
      .from('appointments')
      .select(`
        id,
        date,
        client_id,
        professional_id,
        status,
        professionals(id, name),
        clients(id, name),
        appointment_services(
          id,
          service_id,
          custom_price,
          payment_method_id,
          payment_fee,
          salon_profit,
          net_service_value,
          services(id, name, price),
          payment_methods(id, name, fee)
        )
      `)
      .eq('status', 'completed')
      .gte('date', startDate as string)
      .lte('date', endDate as string);

    // Apply professional filter if provided
    if (professionalId) {
      query = query.eq('professional_id', professionalId);
    }

    const { data: appointments, error } = await query.order('date', { ascending: false });

    if (error) {
      console.error('Error fetching financial data:', error);
      return res.status(500).json({ message: 'Failed to fetch financial data', error });
    }

    // Buscar produtos vendidos em cada atendimento
    const appointmentIds = appointments.map(app => app.id);
    let productSales: ProductSale[] = [];

    if (appointmentIds.length > 0) {
      // Buscar produtos vendidos nos atendimentos
      const { data: productSalesData, error: productSalesError } = await supabase
        .from('product_sales')
        .select(`
          id,
          sale_date,
          product_id,
          product_name,
          payment_method_id,
          quantity,
          unit_price,
          gross_total,
          net_profit,
          professional_id,
          appointment_id,
          source,
          payment_methods (
            id,
            name,
            fee
          ),
          products:product_id (
            id,
            name,
            cost_price
          )
        `)
        .in('appointment_id', appointmentIds);

      if (productSalesError) {
        console.error('Error fetching product sales:', productSalesError);
      } else {
        productSales = productSalesData || [];
      }
    }

    // Process appointments to include payment info and product sales
    const processedAppointments = appointments.map((appointment) => {
      // Encontrar produtos vendidos neste atendimento
      const appointmentProducts = productSales.filter(
        sale => sale.appointment_id === appointment.id
      );
      
      // Garantir que appointment_services é um array tipado
      const appointmentServices = Array.isArray(appointment.appointment_services) 
        ? appointment.appointment_services as AppointmentService[]
        : [] as AppointmentService[];

      // Calculate totals from appointment_services
      let serviceValueTotal = 0;
      let commissionTotal = 0;
      let salonProfitTotal = 0;
      let netServiceValueTotal = 0;
      let paymentFeeTotal = 0;
      const paymentMethods: Record<string, number> = {};

      if (appointmentServices.length > 0) {
        appointmentServices.forEach(service => {
          const serviceValue = service.custom_price || 0;
          const paymentFee = service.payment_fee || 0;
          const salonProfit = service.salon_profit || 0;
          const netServiceValue = service.net_service_value || 0;
          
          // Usar diretamente professional_profit calculado pelo backend
          const professionalProfit = service.professional_profit || 0;

          serviceValueTotal += serviceValue;
          paymentFeeTotal += paymentFee;
          salonProfitTotal += salonProfit;
          netServiceValueTotal += netServiceValue;
          commissionTotal += professionalProfit;

          // Aggregate payment methods
          if (service.payment_method_id) {
            const methodId = service.payment_method_id;
            paymentMethods[methodId] = (paymentMethods[methodId] || 0) + serviceValue;
          }
        });
      }

      // Calculate product totals
      let productValueTotal = 0;
      let productProfitTotal = 0;

      if (appointmentProducts.length > 0) {
        appointmentProducts.forEach(product => {
          productValueTotal += product.gross_total || 0;
          productProfitTotal += product.net_profit || 0;
        });
      }

      // Process professional
      const professional = Array.isArray(appointment.professionals)
        ? appointment.professionals[0]
        : appointment.professionals;

      // Process client
      const client = Array.isArray(appointment.clients)
        ? appointment.clients[0]
        : appointment.clients;

      // Create confirmation object with formatted data
      const confirmation = {
        id: appointment.id,
        date: appointment.date,
        professional: professional ? {
          id: professional.id,
          name: professional.name,
        } : null,
        client: client ? {
          id: client.id,
          name: client.name,
        } : null,
        appointment_services: appointmentServices,
        product_sales: appointmentProducts || [],
        total_service_value: serviceValueTotal,
        total_product_value: productValueTotal,
        total_payment_fee: paymentFeeTotal,
        total_salon_profit: salonProfitTotal,
        total_product_profit: productProfitTotal,
        total_net_service_value: netServiceValueTotal,
        total_commission: commissionTotal,
        payment_methods: Object.entries(paymentMethods).map(([id, value]) => ({
          id,
          value,
          payment_method: appointmentServices?.find(
            service => service.payment_method_id === id
          )?.payment_methods
        }))
      };

      return confirmation;
    });

    return res.status(200).json({
      data: processedAppointments,
      count: processedAppointments.length
    });
  } catch (error) {
    console.error('Error in financial data API:', error);
    return res.status(500).json({ message: 'Internal server error', error });
  }
} 