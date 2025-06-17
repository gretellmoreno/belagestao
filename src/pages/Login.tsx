import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'react-toastify';
import { Eye, EyeOff, Calendar, Users, DollarSign, Package, BarChart2 } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Verificar se já está autenticado
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    if (isAuthenticated === 'true') {
      navigate('/');
    }
    
    // Remover scrollbars do body
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single();

      if (error) throw error;

      if (data) {
        // Salvar autenticação no localStorage
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('userId', data.id);
        toast.success('Login realizado com sucesso!');
        navigate('/');
      } else {
        toast.error('Usuário ou senha incorretos');
      }
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      toast.error('Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const benefits = [
    {
      title: "Gestão de Agendamentos",
      description: "Gerencie todos os agendamentos do seu salão de forma simples e eficiente",
      icon: Calendar
    },
    {
      title: "Cadastro de Clientes",
      description: "Mantenha um histórico completo de todos os seus clientes",
      icon: Users
    },
    {
      title: "Controle Financeiro",
      description: "Administre suas finanças com facilidade e tenha controle total do seu negócio",
      icon: DollarSign
    },
    {
      title: "Produtos e Serviços",
      description: "Gerencie seu estoque e catálogo de serviços em um único lugar",
      icon: Package
    },
    {
      title: "Relatórios Detalhados",
      description: "Acesse relatórios detalhados para tomar as melhores decisões",
      icon: BarChart2
    }
  ];

  return (
    <div className="fixed inset-0 flex flex-col lg:flex-row overflow-hidden bg-white">
      {/* Logo para mobile (aparece apenas em telas pequenas) */}
      <div className="lg:hidden w-full flex justify-center items-center pt-10 pb-6 bg-white">
        <img src="https://shofzrutkjkjqywtykpw.supabase.co/storage/v1/object/public/fotos//logo-bela-gestao.png" alt="Bela Gestão" className="h-10 w-auto ml-2 object-contain" />
      </div>
      
      {/* Lado esquerdo - Formulário de login */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8 bg-white lg:bg-indigo-600">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="text-center mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Bem-vindo(a)!</h2>
              <p className="mt-2 text-sm text-gray-600">
                Faça login para acessar o sistema
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5 sm:space-y-6">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                  Usuário
                </label>
                <div className="mt-1">
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                    placeholder="Digite seu usuário"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Senha
                </label>
                <div className="mt-1 relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
                    placeholder="Digite sua senha"
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                    Lembrar-me
                  </label>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-700 hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Entrando...' : 'Entrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Lado direito - Apenas a logo (visível apenas em desktop) */}
      <div className="hidden lg:flex w-1/2 bg-white items-center justify-center">
        <div className="flex items-center justify-center">
          <img src="https://shofzrutkjkjqywtykpw.supabase.co/storage/v1/object/public/fotos//logo-bela-gestao.png" alt="Bela Gestão" className="h-40 w-auto object-contain" />
        </div>
      </div>
    </div>
  );
} 