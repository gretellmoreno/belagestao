/**
 * Tipos relacionados a pagamentos e métodos de pagamento
 * 
 * Este arquivo contém definições para todos os tipos relacionados a pagamentos
 * e métodos de pagamento usados no sistema.
 * 
 * Tabela no banco de dados: payment_methods
 * - Colunas principais: id, name, fee
 * 
 * Relacionamentos:
 * - Appointments (payment_method_id -> payment_methods.id)
 * - Sales (payment_method_id -> payment_methods.id)
 * - Appointment Confirmations (payment_method_id -> payment_methods.id)
 */

// Tipo para método de pagamento completo
export interface PaymentMethod {
  id: string;
  name: string;
  fee: number;
}

// Tipo para dados de criação/edição de método de pagamento
export interface PaymentMethodData {
  name: string;
  fee: number;
}

// Tipo para estado do método de pagamento no formulário
export interface PaymentMethodFormState {
  name: string;
  fee: string; // Como string para facilitar manipulação em inputs
}

// Status de pagamento
export type PaymentStatus = 'pendente' | 'pago' | 'parcial' | 'cancelado'; 