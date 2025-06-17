import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      // Prevenir o prompt padrão
      e.preventDefault();
      // Armazenar o evento para uso posterior
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Mostrar o botão de instalação
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Mostrar o prompt de instalação
    await deferredPrompt.prompt();

    // Aguardar a escolha do usuário
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('Usuário aceitou a instalação');
    } else {
      console.log('Usuário recusou a instalação');
    }

    // Limpar o prompt armazenado
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  if (!isInstallable) return null;

  return (
    <button
      onClick={handleInstallClick}
      className="fixed bottom-4 right-4 bg-indigo-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors"
    >
      <Download size={20} />
      Instalar App
    </button>
  );
} 