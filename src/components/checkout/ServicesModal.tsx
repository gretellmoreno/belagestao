import React, { useState } from 'react';
import { X, Plus, Check } from 'lucide-react';

interface Service {
  id: string;
  name: string;
  price: number;
  estimated_time?: number;
}

interface ServicesModalProps {
  availableServices: Service[];
  onAddService: (service: Service) => void;
  onClose: () => void;
}

export default function ServicesModal({
  availableServices,
  onAddService,
  onClose
}: ServicesModalProps) {
  // Estado para busca de serviços
  const [serviceSearch, setServiceSearch] = useState('');
  // Estado para controlar serviços selecionados
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  
  // Filtrar serviços com base na busca
  const filteredServices = serviceSearch 
    ? availableServices.filter(service => 
        service.name.toLowerCase().includes(serviceSearch.toLowerCase()))
    : availableServices;

  // Formatar duração (caso esteja disponível)
  const formatDuration = (minutes?: number) => {
    if (!minutes) return '';
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h${mins}min` : `${hours}h`;
  };

  // Verificar se um serviço está selecionado
  const isServiceSelected = (serviceId: string) => {
    return selectedServices.some(service => service.id === serviceId);
  };

  // Alternar seleção de serviço
  const toggleServiceSelection = (service: Service) => {
    if (isServiceSelected(service.id)) {
      setSelectedServices(selectedServices.filter(s => s.id !== service.id));
    } else {
      setSelectedServices([...selectedServices, service]);
    }
  };

  // Confirmar seleção e fechar modal
  const confirmSelection = () => {
    // Adicionar cada serviço selecionado
    selectedServices.forEach(service => {
      onAddService(service);
    });
    // Fechar o modal
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-sm">
        <div className="flex justify-between items-center px-3 py-2 border-b">
          <h3 className="text-sm font-medium">Selecionar Serviços</h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        </div>

        {/* Barra de busca */}
        <div className="px-3 py-2 border-b">
          <div className="relative">
            <div className="h-4 w-4 absolute left-2 top-2 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </div>
            <input
              type="text"
              placeholder="Buscar serviços..."
              className="w-full pl-8 py-1 border border-gray-300 rounded-md text-xs"
              value={serviceSearch}
              onChange={(e) => setServiceSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Lista de serviços */}
        <div className="px-3 py-2 max-h-[300px] overflow-y-auto">
          {filteredServices.length > 0 ? (
            <div className="space-y-1">
              {filteredServices.map(service => {
                const selected = isServiceSelected(service.id);
                return (
                  <div 
                    key={service.id} 
                    className={`flex justify-between items-center py-2 border-b cursor-pointer ${selected ? 'bg-indigo-50' : ''}`}
                    onClick={() => toggleServiceSelection(service)}
                  >
                    <div>
                      <div className="text-sm">{service.name}</div>
                      <div className="flex text-xs">
                        <span className="text-indigo-600">R$ {service.price.toFixed(2).replace('.', ',')}</span>
                        {service.estimated_time && (
                          <span className="ml-2 text-gray-500">{formatDuration(service.estimated_time)}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-indigo-600 ml-2">
                      {selected ? (
                        <Check size={16} />
                      ) : (
                        <Plus size={16} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500 text-xs">
              <p>Nenhum serviço encontrado</p>
            </div>
          )}
        </div>
        
        <div className="px-3 py-2 border-t flex justify-between items-center">
          <div className="text-xs text-gray-500">
            {selectedServices.length} {selectedServices.length === 1 ? 'serviço selecionado' : 'serviços selecionados'}
          </div>
          <button
            onClick={confirmSelection}
            className="px-3 py-1 text-xs bg-indigo-500 text-white rounded-md"
            disabled={selectedServices.length === 0}
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
} 