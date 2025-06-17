// Mock de dados para uso temporário enquanto o banco de dados está sendo configurado

import { Appointment } from './appointmentService';
import { Client } from './clientService';
import { Professional } from './professionalService';
import { Service } from './serviceService';

// Mock de clientes
export const mockClients: Client[] = [
  {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    name: 'Ana Silva',
    phone: '(11) 98765-4321',
    email: 'ana@example.com',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    name: 'Carlos Oliveira',
    phone: '(11) 91234-5678',
    email: 'carlos@example.com',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
    name: 'Mariana Santos',
    phone: '(11) 99876-5432',
    email: 'mariana@example.com',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

// Mock de profissionais
export const mockProfessionals: Professional[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Juliana Ferreira',
    role: 'Cabeleireira',
    phone: '(11) 98888-7777',
    email: 'juliana@example.com',
    color: '#FF5733',
    active: true,
    deduct_payment_fee: false
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Bianca Souza',
    role: 'Manicure',
    phone: '(11) 97777-8888',
    email: 'bianca@example.com',
    color: '#337DFF',
    active: true,
    deduct_payment_fee: false
  }
];

// Mock de serviços
export const mockServices: Service[] = [
  {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Corte Feminino',
    price: 80,
    description: 'Corte feminino com finalização',
    commission_rate: 30,
    estimated_time: 60,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    type: 'service'
  },
  {
    id: '123e4567-e89b-12d3-a456-426614174001',
    name: 'Coloração',
    price: 150,
    description: 'Coloração de cabelo completa',
    commission_rate: 30,
    estimated_time: 120,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    type: 'service'
  },
  {
    id: '123e4567-e89b-12d3-a456-426614174002',
    name: 'Hidratação',
    price: 70,
    description: 'Hidratação profunda',
    commission_rate: 30,
    estimated_time: 45,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    type: 'service'
  },
  {
    id: '123e4567-e89b-12d3-a456-426614174003',
    name: 'Manicure',
    price: 50,
    description: 'Manicure completa',
    commission_rate: 30,
    estimated_time: 45,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    type: 'service'
  },
  {
    id: '123e4567-e89b-12d3-a456-426614174004',
    name: 'Pedicure',
    price: 60,
    description: 'Pedicure completa',
    commission_rate: 30,
    estimated_time: 60,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    type: 'service'
  }
];

// Função para gerar uma data de hoje com hora específica
const getTodayWithTime = (hours: number, minutes: number): Date => {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
};

// Função para formatar data como string YYYY-MM-DD
const formatDateYYYYMMDD = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Função para formatar hora como string HH:MM
const formatTimeHHMM = (date: Date): string => {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

// Data de hoje
const today = new Date();
const todayStr = formatDateYYYYMMDD(today);

// Mock de agendamentos
export const mockAppointments: Appointment[] = [
  {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    client_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    client: mockClients[0],
    professional_id: '550e8400-e29b-41d4-a716-446655440000',
    professional: mockProfessionals[0],
    services: ['123e4567-e89b-12d3-a456-426614174000', '123e4567-e89b-12d3-a456-426614174002'],
    services_data_json: [
      { id: 1, name: 'Corte Feminino', price: 80, estimated_time: 60 },
      { id: 2, name: 'Hidratação', price: 70, estimated_time: 45 }
    ],
    date: todayStr,
    time: '09:00',
    status: 'agendado',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
    client_id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    client: mockClients[1],
    professional_id: '550e8400-e29b-41d4-a716-446655440000',
    professional: mockProfessionals[0],
    services: ['123e4567-e89b-12d3-a456-426614174000'],
    services_data_json: [
      { id: 1, name: 'Corte Feminino', price: 80, estimated_time: 60 }
    ],
    date: todayStr,
    time: '14:00',
    status: 'agendado',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
    client_id: '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
    client: mockClients[2],
    professional_id: '550e8400-e29b-41d4-a716-446655440001',
    professional: mockProfessionals[1],
    services: ['123e4567-e89b-12d3-a456-426614174003', '123e4567-e89b-12d3-a456-426614174004'],
    services_data_json: [
      { id: 3, name: 'Manicure', price: 50, estimated_time: 45 },
      { id: 4, name: 'Pedicure', price: 60, estimated_time: 60 }
    ],
    date: todayStr,
    time: '10:00',
    status: 'agendado',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

// Função para gerar um novo ID único
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 11);
};

// Função para buscar agendamentos por data
export const getMockAppointmentsByDate = (date: string): Appointment[] => {
  return mockAppointments.filter(apt => apt.date === date);
};

// Função para simular o carregamento (atraso)
export const simulateLoading = async (ms: number = 500): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};