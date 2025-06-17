import { X, Clock, User, Scissors, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';

interface AppointmentDetailsProps {
  appointment: {
    id: string;
    clientName: string;
    services: string[];
    date: string;
    time: string;
    // A duração pode vir dos serviços, calculada em tempo de execução
    duration?: string;
    services_data?: Array<{
      duration?: number;
      service_id: string;
    }>;
    notes?: string;
    employeeId: string;
  };
  employee: {
    name: string;
    role: string;
  };
  onClose: () => void;
}

export default function AppointmentDetails({ appointment, employee, onClose }: AppointmentDetailsProps) {
  const formatDateTime = () => {
    const formattedDate = format(parseISO(appointment.date), 'dd/MM/yyyy');
    const normalizedTime = appointment.time.includes(':')
      ? appointment.time.split(':').slice(0, 2).join(':')
      : appointment.time;
    return `${formattedDate} às ${normalizedTime}`;
  };

  const formattedDateTime = formatDateTime();

  // Calcular duração total a partir dos serviços, ou usar a duração legada se disponível
  const calculateDuration = () => {
    // Primeiro tenta calcular com base nos services_data
    if (appointment.services_data && appointment.services_data.length > 0) {
      return appointment.services_data.reduce((total, service) => total + (service.duration || 0), 0);
    }
    
    // Se não encontrar, tenta usar a duração legada
    if (appointment.duration) {
      return parseInt(appointment.duration);
    }
    
    // Valor padrão
    return 30;
  };
  
  const duration = calculateDuration();
  const formattedDuration = duration >= 60 ? `${(duration / 60).toFixed(1)}h` : `${duration}min`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 500 }}
          className="bg-white rounded-t-2xl sm:rounded-lg shadow-xl w-full max-w-md mx-0 sm:mx-4 overflow-hidden"
        >
          <div className="flex items-center justify-between p-4 sm:p-5 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Comanda</h3>
            <button
              onClick={onClose}
              className="p-2 -mr-2 text-gray-400 hover:text-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-full"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-4 sm:p-5 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
            <div className="flex items-start space-x-3">
              <User className="h-6 w-6 text-gray-400 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900 text-base">{appointment.clientName}</p>
                <p className="text-sm text-gray-500">Cliente</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Scissors className="h-6 w-6 text-gray-400 mt-0.5" />
              <div className="flex-1">
                <div className="flex flex-wrap gap-2">
                  {appointment.services.map((service) => (
                    <span
                      key={service}
                      className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800"
                    >
                      {service}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-gray-500 mt-1">Serviços</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <User className="h-6 w-6 text-gray-400 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900 text-base">{employee.name}</p>
                <p className="text-sm text-gray-500">{employee.role}</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Clock className="h-6 w-6 text-gray-400 mt-0.5" />
              <div>
                <p className="font-medium text-gray-900 text-base">{formattedDateTime}</p>
                <p className="text-sm text-gray-500">Duração: {formattedDuration}</p>
              </div>
            </div>

            {appointment.notes && (
              <div className="flex items-start space-x-3">
                <FileText className="h-6 w-6 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-900">{appointment.notes}</p>
                  <p className="text-sm text-gray-500">Observações</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 p-4 sm:p-5 border-t bg-gray-50">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 text-base font-medium text-gray-700 hover:bg-gray-100 active:bg-gray-200 border border-gray-300 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Fechar
            </button>
            <button className="flex-1 sm:flex-none px-4 py-2.5 text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
              Editar
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
