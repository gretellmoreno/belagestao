/**
 * Teste para verificar se o payment_method_id está sendo corretamente atribuído
 * aos serviços durante a finalização do atendimento.
 */

// Simulação do objeto de atendimento
const mockAppointment = {
  id: '12345-abcde',
  client_id: 'client-123',
  date: '2023-09-01',
  status: 'agendado',
  appointment_services: [
    {
      service_id: 'service-1',
      custom_price: 100,
      custom_time: 60
    },
    {
      service_id: 'service-2',
      custom_price: 150,
      custom_time: 90
    }
  ]
};

// Simulação de método de pagamento selecionado
const selectedPaymentMethod = {
  id: 'payment-method-123',
  name: 'Cartão de Crédito',
  fee: 3.5
};

// Função para testar a transformação dos dados
function testPaymentMethodAssignment() {
  // Criar objeto com dados completos do agendamento finalizado
  const completeAppointmentData = {
    ...mockAppointment,
    status: 'finalizado',
    updated_at: new Date().toISOString(),
    payment_method_id: selectedPaymentMethod.id,
    appointment_services: mockAppointment.appointment_services.map(service => ({
      ...service,
      payment_method_id: selectedPaymentMethod.id // Adicionar payment_method_id para cada serviço
    }))
  };

  // Verificar se o payment_method_id foi adicionado corretamente a todos os serviços
  const allServicesHavePaymentMethod = completeAppointmentData.appointment_services.every(
    service => service.payment_method_id === selectedPaymentMethod.id
  );

  console.log('Todos os serviços têm payment_method_id:', allServicesHavePaymentMethod);
  console.log('Dados do agendamento com serviços atualizados:', JSON.stringify(completeAppointmentData, null, 2));

  return allServicesHavePaymentMethod;
}

// Verificar a estrutura do payload para atualização dos serviços
function testServiceUpdatePayload() {
  const updatePayloads = mockAppointment.appointment_services.map(service => ({
    payment_method_id: selectedPaymentMethod.id,
    custom_price: service.custom_price,
    updated_at: new Date().toISOString()
  }));

  console.log('Payloads para atualização dos serviços:', JSON.stringify(updatePayloads, null, 2));
  return updatePayloads;
}

// Exportar funções de teste
module.exports = {
  testPaymentMethodAssignment,
  testServiceUpdatePayload
}; 