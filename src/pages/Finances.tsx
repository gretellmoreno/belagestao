import React, { useState, useEffect } from 'react';
import { 
  DollarSign, Save, Receipt, Calendar, User, CreditCard, Filter, 
  FileText, Percent, CalendarRange, History, Info, AlertTriangle, 
  CheckCircle, XCircle, AlertCircle, ClipboardList, Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { NumericFormat } from 'react-number-format';
import VerifyDatabaseTables from '../components/financeiro/VerifyDatabaseTables';

// Definição de tipo para os dados de serviço
interface ServiceData {
  price: number;
  originalPrice?: number;
  commission?: number;
}

// Definição de tipo para um serviço
interface Service {
  id: string;
  name: string;
  price: number;
  commission: number;
}

// Definição de tipo para um objeto appointment
interface AppointmentWithConfirmation {
  id: string;
  confirmation?: {
    services_data?: Record<string, ServiceData>;
  };
  services_data?: Record<string, ServiceData>;
  services?: string[];
}

const getServicesFromAppointment = (appointment: AppointmentWithConfirmation, availableServices: Service[] = []) => {
  // Se houver confirmação, usar os dados de services_data dela
  if (appointment.confirmation && appointment.confirmation.services_data) {
    return Object.entries(appointment.confirmation.services_data).map(([name, data]) => ({
      name,
      price: data.price || 0,
      originalPrice: data.originalPrice || data.price || 0,
      commission: data.commission || 0
    }));
  }
  
  // Caso contrário, usar os dados do appointment.services_data se disponível
  if (appointment.services_data && typeof appointment.services_data === 'object') {
    return Object.entries(appointment.services_data).map(([name, data]) => ({
      name,
      price: data.price || 0,
      originalPrice: data.originalPrice || data.price || 0,
      commission: data.commission || 0
    }));
  }
  
  // Se não tiver nenhum dos anteriores, usar appointment.services
  if (appointment.services && Array.isArray(appointment.services)) {
    return appointment.services.map((serviceName: string) => {
      const serviceData = availableServices.find(s => s.name === serviceName);
      return {
        name: serviceName,
        price: serviceData?.price || 0,
        commission: serviceData?.commission || 0
      };
    });
  }
  
  // Retorna array vazio se não encontrar serviços
  return [];
};

const Finances = () => {
  const [tablesVerified, setTablesVerified] = useState(false);
  // ... rest of your state variables ...

  // ... existing useEffect and other functions ...

  // Função para marcar que a verificação de tabelas foi concluída
  const handleTablesVerified = () => {
    setTablesVerified(true);
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Financeiro</h1>
      
      {!tablesVerified ? (
        <VerifyDatabaseTables onComplete={handleTablesVerified} />
      ) : (
        // Conteúdo principal da página Financeiro
        <div>
          {/* Restante do conteúdo aqui */}
        </div>
      )}
    </div>
  );
};

export default Finances; 