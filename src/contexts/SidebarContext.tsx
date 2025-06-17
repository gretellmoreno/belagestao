import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

interface SidebarContextType {
  expanded: boolean;
  setExpanded: (value: boolean) => void;
  toggleExpanded: () => void;
}

interface SidebarProviderProps {
  children: React.ReactNode;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};

export const SidebarProvider: React.FC<SidebarProviderProps> = ({ children }) => {
  const [expanded, setExpandedState] = useState(false);
  
  const setExpanded = useCallback((value: boolean) => {
    setExpandedState(value);
  }, []);
  
  const toggleExpanded = useCallback(() => {
    setExpandedState(prev => !prev);
  }, []);

  // Memoize o valor do contexto para evitar re-renderizações desnecessárias
  const value = useMemo(() => ({
    expanded,
    setExpanded,
    toggleExpanded
  }), [expanded, setExpanded, toggleExpanded]);

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  );
}; 