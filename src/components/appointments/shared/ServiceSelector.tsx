import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Service } from '../../../lib/serviceService';
import { useDebounce } from '../../../hooks/useDebounce';

interface ServiceSelectorProps {
  services: Service[];
  selectedServices: string[];
  onSelectService: (serviceName: string) => void;
  onRemoveService?: (serviceName: string) => void;
  className?: string;
  showSelected?: boolean;
  loading?: boolean;
  placeHolder?: string;
}

export default function ServiceSelector({
  services,
  selectedServices,
  onSelectService,
  onRemoveService,
  className = '',
  showSelected = true,
  loading = false,
  placeHolder = 'Buscar serviço...'
}: ServiceSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [filteredServices, setFilteredServices] = useState<Service[]>([]);
  const [dropdownVisible, setDropdownVisible] = useState(false);

  useEffect(() => {
    if (!debouncedSearchTerm) {
      setFilteredServices([]);
      return;
    }

    const searchLower = debouncedSearchTerm.toLowerCase();
    const filtered = services.filter(service =>
      service.name.toLowerCase().includes(searchLower) ||
      (service.description || '').toLowerCase().includes(searchLower)
    );

    setFilteredServices(filtered);
  }, [debouncedSearchTerm, services]);

  const handleServiceSelect = (service: Service) => {
    if (selectedServices.includes(service.name)) {
      toast.error(`O serviço "${service.name}" já foi selecionado`);
      return;
    }

    onSelectService(service.name);
    setSearchTerm('');
    setFilteredServices([]);
  };

  const handleServiceRemove = (serviceName: string) => {
    onRemoveService?.(serviceName);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setDropdownVisible(e.target.value.length > 0);
          }}
          onFocus={() => setDropdownVisible(searchTerm.length > 0)}
          placeholder={placeHolder}
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {searchTerm && (
          <button
            onClick={() => {
              setSearchTerm('');
              setDropdownVisible(false);
            }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {dropdownVisible && filteredServices.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white shadow-lg rounded-md border border-gray-200 max-h-60 overflow-auto">
            {filteredServices.map((service) => (
              <div
                key={service.id}
                onClick={() => handleServiceSelect(service)}
                className="px-4 py-2 hover:bg-gray-50 cursor-pointer flex justify-between items-center"
              >
                <div>
                  <div className="font-medium">{service.name}</div>
                  {service.estimated_time && (
                    <div className="text-sm text-gray-500">
                      {service.estimated_time} min
                    </div>
                  )}
                </div>
                <div className="text-sm font-medium">
                  {service.price.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {dropdownVisible && searchTerm && filteredServices.length === 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white shadow-lg rounded-md border border-gray-200">
            <div className="px-4 py-2 text-gray-500 text-center">
              Nenhum serviço encontrado
            </div>
          </div>
        )}
      </div>

      {showSelected && selectedServices.length > 0 && (
        <div className="mt-2">
          <div className="text-sm font-medium text-gray-700 mb-1">Serviços selecionados</div>
          <div className="flex flex-wrap gap-2">
            {selectedServices.map((serviceName) => {
              const service = services.find(s => s.name === serviceName);

              return (
                <div
                  key={serviceName}
                  className="flex items-center bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md"
                >
                  <span className="text-sm">{serviceName}</span>
                  {onRemoveService && (
                    <button
                      onClick={() => handleServiceRemove(serviceName)}
                      className="ml-1 text-indigo-500 hover:text-indigo-700"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                  {service?.price && (
                    <span className="ml-1 text-xs font-medium bg-indigo-100 px-1 rounded">
                      {service.price.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-2">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500"></div>
        </div>
      )}
    </div>
  );
}
