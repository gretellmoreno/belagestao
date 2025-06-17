import { format, parseISO } from 'date-fns';

// Função para formatar valores em moeda
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

// Função para formatar data
export const formatDate = (dateString: string): string => {
  return format(parseISO(dateString), 'dd/MM/yyyy');
};

// Calcular comissão com base em porcentagem
export const calculateCommission = (totalValue: number, commissionRate: number): number => {
  return totalValue * (commissionRate / 100);
};

// Calcular valor após dedução de taxa
export const calculateAfterFee = (totalValue: number, feePercent: number): number => {
  return totalValue * (1 - (feePercent / 100));
};

// Calcular valor da taxa
export const calculateFeeAmount = (totalValue: number, feePercent: number): number => {
  return totalValue * (feePercent / 100);
};

// Agrupar itens por data
export const groupByDate = <T extends { date: string }>(items: T[]): Record<string, T[]> => {
  return items.reduce((acc, item) => {
    const dateKey = format(parseISO(item.date), 'yyyy-MM-dd');
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(item);
    return acc;
  }, {} as Record<string, T[]>);
};

// Calcular totais por profissional
export const calculateTotalsByProfessional = <T extends { 
  professional_id: string, 
  professional?: { id: string, name: string },
  total_value: number 
}>(items: T[]): Array<{ id: string, name: string, total: number }> => {
  const professionalsMap = new Map<string, { id: string, name: string, total: number }>();

  items.forEach(item => {
    if (!item.professional_id) return;
    
    const profId = item.professional_id;
    const profName = item.professional?.name || 'Profissional não especificado';
    
    if (!professionalsMap.has(profId)) {
      professionalsMap.set(profId, { id: profId, name: profName, total: 0 });
    }
    
    const prof = professionalsMap.get(profId)!;
    prof.total += Number(item.total_value) || 0;
  });

  return Array.from(professionalsMap.values());
}; 