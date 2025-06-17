import React from 'react';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-grow flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Bela Gestão</h1>
          <p className="text-gray-600 mb-8">Sistema de Gerenciamento para Salões de Beleza</p>
          
          <nav className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-4 justify-center">
            <Link href="/Clients" className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors">
              Clientes
            </Link>
            
            <Link href="/Appointments" className="px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors">
              Agendamentos
            </Link>
            
            <Link href="/Services" className="px-4 py-2 rounded-md bg-purple-600 text-white hover:bg-purple-700 transition-colors">
              Serviços
            </Link>
            
            <Link href="/Employees" className="px-4 py-2 rounded-md bg-amber-600 text-white hover:bg-amber-700 transition-colors">
              Funcionários
            </Link>
            
            <Link href="/Finances" className="px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
              Financeiro
            </Link>
            
            <Link href="/debug" className="px-4 py-2 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors">
              Debug
            </Link>
          </nav>
        </div>
      </main>
      
      <footer className="py-4 text-center text-gray-500 text-sm">
        &copy; {new Date().getFullYear()} Bela Gestão - Todos os direitos reservados
      </footer>
    </div>
  );
} 