import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, Scissors, ChevronLeft, ChevronRight, Calendar, ShoppingBag, Plus, Package } from 'lucide-react';

interface MobileHeaderProps {
  navigation: {
    name: string;
    href: string;
    icon: React.ComponentType<any>;
  }[];
}

export default function MobileHeader({ navigation }: MobileHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [showNewAppointmentTip, setShowNewAppointmentTip] = useState(false);
  
  // Verificar se é a primeira vez que o usuário acessa
  useEffect(() => {
    const hasSeenTip = localStorage.getItem('hasSeenNewAppointmentTip');
    if (!hasSeenTip) {
      setShowNewAppointmentTip(true);
      localStorage.setItem('hasSeenNewAppointmentTip', 'true');
      
      // Esconder o tip após 5 segundos
      const timer = setTimeout(() => {
        setShowNewAppointmentTip(false);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, []);

  // Prevenir scroll da página quando o menu estiver aberto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    // Cleanup ao desmontar o componente
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Detector de scroll para aplicar efeito de sombra no header
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Funções para abrir modais
  const handleNewAppointment = () => {
    setShowNewAppointmentTip(false);
    
    // Se não estiver na página de agendamentos, redireciona primeiro
    if (!isAppointmentsPage) {
      navigate('/appointments');
      // Aguarda um tempo para garantir que a navegação ocorra e depois dispara o evento
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('openNewAppointment'));
      }, 100);
    } else {
      // Se já estiver na página de agendamentos, só abre o modal
      window.dispatchEvent(new CustomEvent('openNewAppointment'));
    }
  };

  const handleProductSale = () => {
    // Se não estiver na página de agendamentos, redireciona primeiro
    if (!isAppointmentsPage) {
      navigate('/appointments');
      // Aguarda um tempo para garantir que a navegação ocorra e depois dispara o evento
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('openProductSale'));
      }, 100);
    } else {
      // Se já estiver na página de agendamentos, só abre o modal
      window.dispatchEvent(new CustomEvent('openProductSale'));
    }
  };

  // Verifica se está na página de agendamentos (ajustado para verificar também o path raiz)
  const isAppointmentsPage = location.pathname === '/appointments' || location.pathname === '/';
  
  // Adicionar console.log para depuração
  useEffect(() => {
    console.log('MobileHeader - Caminho atual:', location.pathname);
    console.log('MobileHeader - É página de agendamentos:', isAppointmentsPage);
  }, [location.pathname, isAppointmentsPage]);

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden">
        <div className={`mobile-header-container fixed inset-x-0 top-0 h-16 bg-white border-b border-gray-200 transition-shadow ${scrolled ? 'shadow-md' : ''}`} style={{ zIndex: 1000 }}>
          <div className="flex items-center h-full px-3">
            {/* Menu Button */}
            <button
              type="button"
              className="mobile-close-button relative p-3 text-gray-500 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Botão clicado! Estado atual:', isOpen);
                setIsOpen(!isOpen);
              }}
              aria-label={isOpen ? "Fechar menu" : "Abrir menu"}
              style={{ zIndex: 1002 }}
            >
              <span className="sr-only">{isOpen ? "Fechar menu" : "Abrir menu"}</span>
              <Menu className="h-6 w-6" />
            </button>

            {/* Logo */}
            <div className="flex-1 flex justify-center">
              <img
                className="h-10 w-auto ml-2 object-contain"
                src="https://shofzrutkjkjqywtykpw.supabase.co/storage/v1/object/public/fotos//logo-bela-gestao.png"
                alt="Bela Gestão"
              />
            </div>

            {/* Ações rápidas - visíveis apenas quando não estiver na página de Financeiro */}
            {location.pathname !== '/finances' && (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={handleNewAppointment}
                    className="w-8 h-8 flex items-center justify-center bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-colors"
                    aria-label="Novo agendamento"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                  {showNewAppointmentTip && (
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg p-2 text-xs text-gray-600 border border-gray-100 animate-fade-in" style={{ zIndex: 1100 }}>
                      <div className="relative">
                        <div className="absolute -top-2 right-3 w-3 h-3 bg-white transform rotate-45 border-l border-t border-gray-100"></div>
                        Clique aqui para criar um novo agendamento
                      </div>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleProductSale}
                  className="w-8 h-8 flex items-center justify-center bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition-colors"
                  aria-label="Venda de produto"
                >
                  <Package className="h-5 w-5" />
                </button>
              </div>
            )}
            
            {/* Espaço vazio para manter o layout quando estiver na página de Financeiro */}
            {location.pathname === '/finances' && (
              <div className="w-16"></div> 
            )}
          </div>
        </div>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div
          className="mobile-menu-overlay fixed inset-0 bg-black bg-opacity-25 lg:hidden"
          style={{ zIndex: 999 }}
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile Navigation Menu */}
      {isOpen && (
        <div className="mobile-menu-content fixed inset-0 lg:hidden transition-opacity duration-200" style={{ zIndex: 1001 }}>
          <div className="fixed inset-x-0 top-16 bottom-0 bg-white shadow-lg">
            {/* Header do menu com botão fechar */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Botão X interno clicado!');
                  setIsOpen(false);
                }}
                className="mobile-close-button p-2 text-gray-500 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Fechar menu"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <nav className="h-full overflow-y-auto pb-20 overscroll-contain">
              <div className="px-2 py-4 space-y-1">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href;
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={(e) => {
                        // Garantir que o menu feche ao clicar em qualquer link
                        setIsOpen(false);
                        // Não prevenir o comportamento padrão, queremos que a navegação aconteça
                      }}
                      className={`
                        group flex items-center px-3 py-3 text-base font-medium rounded-lg transition-all duration-200
                        ${isActive
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                        }
                      `}
                    >
                      <Icon
                        className={`
                          mr-3 h-5 w-5 flex-shrink-0 transition-colors duration-200
                          ${isActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-500'}
                        `}
                      />
                      {item.name}
                    </Link>
                  );
                })}
              </div>

              {/* User Profile */}
              <div className="border-t border-gray-200 p-4">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                      <span className="text-sm font-medium text-indigo-600">
                        A
                      </span>
                    </div>
                  </div>
                  <div className="ml-3">
                    <p className="text-base font-medium text-gray-900">Admin</p>
                    <p className="text-sm text-gray-500">Administrador</p>
                  </div>
                </div>
              </div>
            </nav>
          </div>
        </div>
      )}

      {/* Espaçador para compensar o header fixo */}
      <div className="h-16 lg:hidden"></div>
    </>
  );
}