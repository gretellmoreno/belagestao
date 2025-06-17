import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Calendar, Users, DollarSign, Package, UserPlus } from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { EmployeeProvider } from './contexts/EmployeeContext';
import { AppointmentProvider } from './contexts/AppointmentContext';
import { SidebarProvider, useSidebar } from './contexts/SidebarContext';
import Sidebar from './components/Sidebar';
import MobileHeader from './components/MobileHeader';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import Appointments from './pages/Appointments';
import Clients from './pages/Clients';
import Employees from './pages/Employees';
import Financeiro from './pages/Financeiro';
import Services from './pages/Services';
import Login from './pages/Login';
import PrivateRoute from './components/PrivateRoute';
import { supabase } from './lib/supabaseClient';

const navigation = [
  { name: 'Agendamentos', href: '/', icon: Calendar },
  { name: 'Clientes', href: '/clients', icon: Users },
  { name: 'Funcionários', href: '/employees', icon: UserPlus },
  { name: 'Serviços e Produtos', href: '/services', icon: Package },
  { name: 'Financeiro', href: '/finances', icon: DollarSign }
];

function AppContent() {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
  const { expanded } = useSidebar();
  const [dbConnectionStatus, setDbConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  
  // Verificar conectividade com o banco de dados na inicialização
  useEffect(() => {
    // Definir como conectado sem fazer verificação separada
    setDbConnectionStatus('connected');
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      {isAuthenticated && !isLoginPage && (
        <>
          <Sidebar navigation={navigation} />
          <MobileHeader navigation={navigation} />
          <PWAInstallPrompt />
        </>
      )}
      
      <div className={isAuthenticated && !isLoginPage ? `transition-all duration-400 ease-in-out ${expanded ? 'lg:pl-64' : 'lg:pl-20'} flex flex-col flex-1` : ""}>
        <main className="flex-1 pb-4">
          <div className="px-1 sm:px-2 lg:px-3 w-full">
            {/* Aviso de erro de conexão com o banco de dados */}
            {dbConnectionStatus === 'error' && (
              <div className="bg-red-50 p-4 border-l-4 border-red-500 mt-2 mx-2">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Problema de conexão</h3>
                    <div className="text-sm text-red-700 mt-2">
                      <p>
                        Não foi possível conectar ao banco de dados. Algumas funcionalidades 
                        podem não funcionar corretamente.
                      </p>
                      <p className="mt-1">
                        Verifique a conexão com a internet ou se o serviço Supabase está disponível.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/"
                element={
                  <PrivateRoute>
                    <Appointments />
                  </PrivateRoute>
                }
              />
              <Route
                path="/appointments"
                element={
                  <PrivateRoute>
                    <Appointments />
                  </PrivateRoute>
                }
              />
              <Route
                path="/clients"
                element={
                  <PrivateRoute>
                    <Clients />
                  </PrivateRoute>
                }
              />
              <Route
                path="/employees"
                element={
                  <PrivateRoute>
                    <Employees />
                  </PrivateRoute>
                }
              />
              <Route
                path="/services"
                element={
                  <PrivateRoute>
                    <Services />
                  </PrivateRoute>
                }
              />
              <Route
                path="/finances"
                element={
                  <PrivateRoute>
                    <Financeiro />
                  </PrivateRoute>
                }
              />
              <Route
                path="*"
                element={
                  <PrivateRoute>
                    <Appointments />
                  </PrivateRoute>
                }
              />
            </Routes>
          </div>
        </main>
      </div>
      <ToastContainer position="top-right" />
    </div>
  );
}

// Função para atualizar a altura da viewport
function setAppHeight() {
  const doc = document.documentElement;
  doc.style.setProperty('--app-height', `${window.innerHeight}px`);
}

// Adicionar event listeners para atualizar a altura
window.addEventListener('resize', setAppHeight);
window.addEventListener('orientationchange', setAppHeight);

// Chamar a função inicialmente
setAppHeight();

function App() {
  return (
    <Router>
      <EmployeeProvider>
        <AppointmentProvider>
          <SidebarProvider>
            <AppContent />
          </SidebarProvider>
        </AppointmentProvider>
      </EmployeeProvider>
    </Router>
  );
}

export default App;
