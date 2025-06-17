export interface PaymentMethod {
  id: string;
  name: string;
  fee: number;
  created_at?: string;
  updated_at?: string;
}

export interface Client {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Professional {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  color?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Service {
  id: string;
  name: string;
  description?: string;
  price: string | number;
  duration: number;
  commission?: number;
  created_at?: string;
  updated_at?: string;
} 