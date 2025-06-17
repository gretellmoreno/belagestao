import React from 'react';

interface DesktopLayoutProps {
  activeTab: 'resumo' | 'taxas' | 'caixa' | 'historico';
  children: React.ReactNode;
}

export const DesktopLayout: React.FC<DesktopLayoutProps> = ({
  activeTab,
  children
}) => {
  return (
    <div className="hidden md:block">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        {/* Renderizar o conteúdo da aba ativa */}
        {children}
      </div>
    </div>
  );
};

export default DesktopLayout; 