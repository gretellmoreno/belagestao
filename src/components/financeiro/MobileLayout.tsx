import React from 'react';
import useFinanceiroData from '../../hooks/useFinanceiroData';

interface MobileLayoutProps {
  activeTab: 'resumo' | 'taxas' | 'caixa' | 'historico';
  children: React.ReactNode;
}

export const MobileLayout: React.FC<MobileLayoutProps> = ({
  activeTab,
  children
}) => {
  return (
    <div className="md:hidden">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2">
        {/* Renderizar o conteúdo da aba ativa */}
        {children}
      </div>
    </div>
  );
};

export default MobileLayout; 