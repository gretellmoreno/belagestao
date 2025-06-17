export interface Appointment {
  id?: string;
  client_id?: string;
  salon_id?: string;
  professional_id?: string;
  date: string;
  time: string;
  end_time?: string;
  duration?: number;
  status: string;
  services?: string[] | any[];
  client_name?: string;
  professional_name?: string;
  observation?: string;
  created_at?: string;
  _selectedServices?: Array<{
    id?: string;
    service_id?: string;
    professional_id?: string;
    custom_price?: number;
    custom_time?: number;
    payment_method_id?: string;
    created_at?: string;
  }>;
  _serviceIds?: string[];
  professional?: any;
  client?: any;
  services_data?: Array<{
    service_id: string;
    custom_price?: number;
    custom_time?: number;
    service?: {
      id: string;
      name: string;
      price: number;
      estimated_time: number;
    };
  }>;
  appointment_services?: Array<{
    service_id: string;
    custom_price?: number;
    custom_time?: number;
    service?: {
      id: string;
      name: string;
      price: number;
      estimated_time: number;
    };
  }>;
  services_relations?: any[];
  services_data_json?: any[];
  endTime?: string;
  notes?: string;
  custom_times?: Record<string, number>;
  updated_at?: string;
  
  // Flags para indicar campos pré-selecionados
  preSelectedTime?: boolean;
  preSelectedDate?: boolean;
  preSelectedProfessional?: boolean;

  // Propriedades de UI
  _updating?: boolean;
  _transition?: boolean;
  _lastUpdated?: number;
} 