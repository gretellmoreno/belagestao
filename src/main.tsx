import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Verificar se existe um redirecionamento armazenado
const redirectUrl = sessionStorage.getItem('redirectUrl');
if (redirectUrl) {
  // Limpar o redirecionamento
  sessionStorage.removeItem('redirectUrl');
  
  // Extrair o pathname e redirecionar após a montagem do app
  const url = new URL(redirectUrl);
  if (url.pathname !== '/') {
    // Usar setTimeout para garantir que o redirecionamento ocorra após a inicialização do React
    setTimeout(() => {
      window.history.replaceState({}, '', url.pathname);
      // Dispara um evento para notificar a aplicação sobre a mudança de URL
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, 100);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
