import React, { useCallback } from 'react';
import { Receipt, CreditCard, DollarSign, History } from 'lucide-react';

interface TabsNavigationProps {
  activeTab: 'resumo' | 'taxas' | 'caixa' | 'historico';
  setActiveTab: (tab: 'resumo' | 'taxas' | 'caixa' | 'historico') => void;
  showMobileMenu: boolean;
  setShowMobileMenu: (show: boolean) => void;
}

const TabsNavigation: React.FC<TabsNavigationProps> = React.memo(({
  activeTab,
  setActiveTab,
  showMobileMenu,
  setShowMobileMenu
}) => {
  // Usar useCallback para evitar recriação das funções
  const handleTabChange = useCallback((tab: 'resumo' | 'taxas' | 'caixa' | 'historico') => {
    // Evitar recarregar a mesma aba
    if (tab === activeTab) return;
    
    setActiveTab(tab);
  }, [activeTab, setActiveTab]);

  const handleMobileMenuToggle = useCallback((show: boolean) => {
    setShowMobileMenu(show);
  }, [setShowMobileMenu]);

  const handleMobileTabChange = useCallback((tab: 'resumo' | 'taxas' | 'caixa' | 'historico') => {
    // Evitar recarregar a mesma aba
    if (tab === activeTab) {
      setShowMobileMenu(false);
      return;
    }
    
    setActiveTab(tab);
    requestAnimationFrame(() => {
      setTimeout(() => setShowMobileMenu(false), 40);
    });
  }, [activeTab, setActiveTab, setShowMobileMenu]);

  return (
    <>
      <style>{`
        /* Sombra suave apenas para os botões */
        .btn-shadow {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }
        
        /* Transição suave para os botões */
        .menu-transition {
          transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        /* Animação de entrada para os botões móveis */
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-slideIn {
          animation: slideIn 0.2s ease-out forwards;
        }
        
        .animate-slideIn-1 {
          animation-delay: 0.05s;
        }
        
        .animate-slideIn-2 {
          animation-delay: 0.1s;
        }
        
        .animate-slideIn-3 {
          animation-delay: 0.15s;
        }
        
        .animate-slideIn-4 {
          animation-delay: 0.2s;
        }

        /* Estilo para os botões com texto ao lado */
        .menu-button-with-text {
          display: flex;
          align-items: center;
          padding: 0.75rem 1.25rem;
          border-radius: 9999px;
          width: auto;
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }

        .menu-text {
          margin-left: 0.75rem;
          font-weight: 500;
          font-size: 0.875rem;
        }

        /* Background suave para o menu expandido */
        .menu-backdrop {
          background-color: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(8px);
          border-radius: 12px;
          padding: 0.75rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }
      `}</style>
      
      <div className="flex justify-between items-center">
        {/* Título removido conforme solicitação anterior */}
        
        {/* Overlay invisível para fechar o menu ao clicar fora */}
        {showMobileMenu && (
          <div 
            className="fixed inset-0 z-[9999998] md:hidden"
            onClick={() => setShowMobileMenu(false)}
          />
        )}
        
        {/* Ícones para dispositivos móveis no canto superior direito */}
        <div className="flex md:hidden fixed top-3 right-3 z-[9999999]">
          {!showMobileMenu ? (
            <div className="flex justify-end">
              <button
                onClick={() => handleMobileMenuToggle(true)}
                className="p-3 rounded-full btn-shadow transition-all duration-200 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white hover:shadow-lg menu-transition"
                title="Menu"
              >
                {activeTab === 'resumo' && <Receipt className="h-5 w-5" />}
                {activeTab === 'taxas' && <CreditCard className="h-5 w-5" />}
                {activeTab === 'caixa' && <DollarSign className="h-5 w-5" />}
                {activeTab === 'historico' && <History className="h-5 w-5" />}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 menu-backdrop">
              <button
                onClick={() => handleMobileTabChange('resumo')}
                className={`menu-button-with-text transition-all duration-150 animate-slideIn animate-slideIn-1 menu-transition ${
                  activeTab === 'resumo'
                    ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white'
                    : 'bg-white/90 backdrop-blur-md text-indigo-500'
                }`}
                title="Vales"
              >
                <Receipt className="h-5 w-5" />
                <span className="menu-text">Vales</span>
              </button>
              
              <button
                onClick={() => handleMobileTabChange('taxas')}
                className={`menu-button-with-text transition-all duration-150 animate-slideIn animate-slideIn-2 menu-transition ${
                  activeTab === 'taxas'
                    ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white'
                    : 'bg-white/90 backdrop-blur-md text-indigo-500'
                }`}
                title="Taxas de Pagamento"
              >
                <CreditCard className="h-5 w-5" />
                <span className="menu-text">Taxas</span>
              </button>
              
              <button
                onClick={() => handleMobileTabChange('caixa')}
                className={`menu-button-with-text transition-all duration-150 animate-slideIn animate-slideIn-3 menu-transition ${
                  activeTab === 'caixa'
                    ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white'
                    : 'bg-white/90 backdrop-blur-md text-indigo-500'
                }`}
                title="Caixa"
              >
                <DollarSign className="h-5 w-5" />
                <span className="menu-text">Caixa</span>
              </button>
              
              <button
                onClick={() => handleMobileTabChange('historico')}
                className={`menu-button-with-text transition-all duration-150 animate-slideIn animate-slideIn-4 menu-transition ${
                  activeTab === 'historico'
                    ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white'
                    : 'bg-white/90 backdrop-blur-md text-indigo-500'
                }`}
                title="Histórico"
              >
                <History className="h-5 w-5" />
                <span className="menu-text">Histórico</span>
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Tabs de navegação responsivas com ícones - apenas para desktop */}
      <nav className="hidden md:grid md:grid-cols-2 sm:flex gap-3">
        <button
          onClick={() => handleTabChange('resumo')}
          className={`flex items-center justify-center sm:justify-start px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
            activeTab === 'resumo'
              ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          <Receipt className="h-5 w-5 sm:mr-2" />
          <span className="hidden sm:inline">Vales</span>
        </button>
        <button
          onClick={() => handleTabChange('taxas')}
          className={`flex items-center justify-center sm:justify-start px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
            activeTab === 'taxas' 
              ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          <CreditCard className="h-5 w-5 sm:mr-2" />
          <span className="hidden sm:inline">Taxas de Pagamento</span>
        </button>
        <button
          onClick={() => handleTabChange('caixa')}
          className={`flex items-center justify-center sm:justify-start px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
            activeTab === 'caixa' 
              ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          <DollarSign className="h-5 w-5 sm:mr-2" />
          <span className="hidden sm:inline">Caixa</span>
        </button>
        <button
          onClick={() => handleTabChange('historico')}
          className={`flex items-center justify-center sm:justify-start px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
            activeTab === 'historico' 
              ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          <History className="h-5 w-5 sm:mr-2" />
          <span className="hidden sm:inline">Histórico</span>
        </button>
      </nav>
    </>
  );
});

TabsNavigation.displayName = 'TabsNavigation';

export default TabsNavigation; 