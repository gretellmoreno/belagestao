import React, { createContext, useContext, useState } from 'react';

interface Employee {
  id: string;
  name: string;
  role: string;
  color: string;
  services: string[];
  commission: number;
}

interface EmployeeContextType {
  employees: Employee[];
  selectedEmployee: string | null;
  setSelectedEmployee: (id: string | null) => void;
}

const employees: Employee[] = [
  {
    id: '1',
    name: 'Isabella Santos',
    role: 'Cabeleireira',
    color: 'bg-pink-500',
    services: ['Corte', 'Coloração', 'Mechas', 'Penteado'],
    commission: 30
  },
  {
    id: '2',
    name: 'Rafael Costa',
    role: 'Barbeiro',
    color: 'bg-blue-500',
    services: ['Corte Masculino', 'Barba', 'Pigmentação'],
    commission: 30
  },
  {
    id: '3',
    name: 'Camila Oliveira',
    role: 'Manicure',
    color: 'bg-purple-500',
    services: ['Manicure', 'Pedicure', 'Esmaltação em Gel'],
    commission: 25
  },
  {
    id: '4',
    name: 'Lucas Mendes',
    role: 'Cabeleireiro',
    color: 'bg-green-500',
    services: ['Corte', 'Barba', 'Coloração', 'Relaxamento'],
    commission: 30
  },
  {
    id: '5',
    name: 'Amanda Lima',
    role: 'Esteticista',
    color: 'bg-yellow-500',
    services: ['Limpeza de Pele', 'Massagem', 'Depilação'],
    commission: 25
  },
  {
    id: '6',
    name: 'Pedro Alves',
    role: 'Barbeiro',
    color: 'bg-indigo-500',
    services: ['Corte Masculino', 'Barba', 'Pigmentação'],
    commission: 30
  },
  {
    id: '7',
    name: 'Juliana Costa',
    role: 'Cabeleireira',
    color: 'bg-rose-500',
    services: ['Corte', 'Coloração', 'Mechas', 'Penteado'],
    commission: 30
  },
  {
    id: '8',
    name: 'Marcos Silva',
    role: 'Barbeiro',
    color: 'bg-cyan-500',
    services: ['Corte Masculino', 'Barba'],
    commission: 30
  },
  {
    id: '9',
    name: 'Beatriz Santos',
    role: 'Manicure',
    color: 'bg-amber-500',
    services: ['Manicure', 'Pedicure', 'Esmaltação em Gel'],
    commission: 25
  },
  {
    id: '10',
    name: 'Thiago Oliveira',
    role: 'Cabeleireiro',
    color: 'bg-emerald-500',
    services: ['Corte', 'Coloração', 'Barba'],
    commission: 30
  },
  {
    id: '11',
    name: 'Laura Martins',
    role: 'Esteticista',
    color: 'bg-violet-500',
    services: ['Limpeza de Pele', 'Massagem', 'Depilação'],
    commission: 25
  },
  {
    id: '12',
    name: 'Gabriel Rocha',
    role: 'Barbeiro',
    color: 'bg-fuchsia-500',
    services: ['Corte Masculino', 'Barba', 'Pigmentação'],
    commission: 30
  },
  {
    id: '13',
    name: 'Sofia Lima',
    role: 'Cabeleireira',
    color: 'bg-orange-500',
    services: ['Corte', 'Coloração', 'Mechas'],
    commission: 30
  },
  {
    id: '14',
    name: 'Daniel Santos',
    role: 'Barbeiro',
    color: 'bg-teal-500',
    services: ['Corte Masculino', 'Barba'],
    commission: 30
  },
  {
    id: '15',
    name: 'Carolina Silva',
    role: 'Manicure',
    color: 'bg-lime-500',
    services: ['Manicure', 'Pedicure'],
    commission: 25
  }
];

const EmployeeContext = createContext<EmployeeContextType>({
  employees: [],
  selectedEmployee: null,
  setSelectedEmployee: () => {}
});

export function EmployeeProvider({ children }: { children: React.ReactNode }) {
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);

  return (
    <EmployeeContext.Provider value={{ employees, selectedEmployee, setSelectedEmployee }}>
      {children}
    </EmployeeContext.Provider>
  );
}

export function useEmployees() {
  const context = useContext(EmployeeContext);
  if (!context) {
    throw new Error('useEmployees must be used within an EmployeeProvider');
  }
  return context;
}