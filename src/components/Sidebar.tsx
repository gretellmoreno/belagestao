import React, { memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Scissors } from 'lucide-react';
import { useSidebar } from '../contexts/SidebarContext';

interface SidebarProps {
  navigation: {
    name: string;
    href: string;
    icon: React.ComponentType<any>;
  }[];
}

const Sidebar = memo(({ navigation }: SidebarProps) => {
  const location = useLocation();
  const { expanded, setExpanded } = useSidebar();

  const handleMouseEnter = React.useCallback(() => {
    setExpanded(true);
  }, [setExpanded]);

  const handleMouseLeave = React.useCallback(() => {
    setExpanded(false);
  }, [setExpanded]);

  return (
    <div 
      className={`sidebar-container hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 transition-all duration-400 ${expanded ? 'lg:w-64' : 'lg:w-20'}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ zIndex: 1100 }}
    >
      <div className="sidebar-nav flex flex-col flex-grow bg-white border-r border-gray-200">
        {/* Logo */}
        <div className={`sidebar-logo flex items-center ${expanded ? 'justify-center' : 'justify-center'} h-20 flex-shrink-0 px-4 bg-white border-b border-gray-100`}>
          {expanded ? (
            <img
              className="h-10 w-auto ml-2 object-contain"
              src="https://shofzrutkjkjqywtykpw.supabase.co/storage/v1/object/public/fotos//logo-bela-gestao.png"
              alt="Bela Gestão"
            />
          ) : (
            <img
              className="h-8 w-auto object-contain"
              src="https://shofzrutkjkjqywtykpw.supabase.co/storage/v1/object/public/fotos//logo-bela-gestao.png"
              alt="Bela Gestão"
            />
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.name}
                to={item.href}
                className={`
                  group flex items-center ${expanded ? 'px-3' : 'justify-center px-2'} py-2.5 text-sm font-medium rounded-lg transition-all duration-200
                  ${isActive
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
                title={!expanded ? item.name : ''}
              >
                <Icon
                  className={`
                    ${expanded ? 'mr-3' : 'mr-0'} h-5 w-5 flex-shrink-0 transition-colors duration-200
                    ${isActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-500'}
                  `}
                />
                <span 
                  className={`
                    whitespace-nowrap overflow-hidden transition-all duration-400
                    ${expanded ? 'opacity-100 max-w-full transform translate-x-0' : 'opacity-0 max-w-0 transform -translate-x-10'}
                  `}
                >
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="sidebar-profile border-t border-gray-200 p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                <span className="text-sm font-medium text-indigo-600">
                  A
                </span>
              </div>
            </div>
            <div className={`ml-3 transition-opacity duration-200 ${expanded ? 'opacity-100' : 'opacity-0'}`}>
              <p className="text-base font-medium text-gray-900">Admin</p>
              <p className="text-sm text-gray-500">Administrador</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;