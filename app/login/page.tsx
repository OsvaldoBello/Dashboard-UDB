'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, Loader2, KeyRound, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase-client';

type AuthMode = 'login' | 'register';

// Validador de senha forte
const validatePassword = (pwd: string) => {
  return {
    length: pwd.length >= 8 && pwd.length <= 32,
    uppercase: /[A-Z]/.test(pwd),
    lowercase: /[a-z]/.test(pwd),
    number: /[0-9]/.test(pwd),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(pwd)
  };
};

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  // Captura código de confirmação vindo do link de e-mail automaticamente (?code=...)
  useEffect(() => {
    const handleUrlCode = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get('code');
      if (code) {
        setIsLoading(true);
        setErrorMessage(null);
        setSuccessMessage('Verificando seu link de confirmação...');
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          
          setSuccessMessage('E-mail confirmado com sucesso! Redirecionando...');
          setTimeout(() => {
            router.push('/dashboard');
            router.refresh();
          }, 1500);
        } catch (err) {
          const error = err as Error;
          setErrorMessage(error.message || 'Link expirado ou inválido.');
          setIsLoading(false);
        }
      }
    };
    handleUrlCode();
  }, [router, supabase]);

  // Validação em tempo real
  const pwdCriteria = validatePassword(password);
  const isPasswordValid = Object.values(pwdCriteria).every(Boolean);
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error && (data.error.includes('confirm') || data.error.includes('confirmado'))) {
          throw new Error('E-mail de confirmação pendente. Por favor, verifique seu e-mail para ativar sua conta.');
        }
        throw new Error(data.error || 'Falha ao efetuar o login.');
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      const error = err as Error;
      setErrorMessage(error.message || 'Erro ao fazer login. Verifique suas credenciais.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmailValid) {
      setErrorMessage('Por favor, insira um endereço de e-mail válido.');
      return;
    }
    if (!isPasswordValid) {
      setErrorMessage('A senha fornecida não atende a todos os requisitos de segurança.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // 1. Cadastrar usuário no Supabase Auth via API Route do Servidor (Seguro e dinâmico)
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar conta.');
      }

      // 2. Se já retornou sessão (confirmação desativada no Supabase), entra direto
      if (data.session) {
        setSuccessMessage('Conta criada com sucesso! Redirecionando...');
        setTimeout(() => {
          router.push('/dashboard');
          router.refresh();
        }, 1500);
        return;
      }

      // 3. Caso contrário, tenta fazer login automático
      const loginResponse = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const loginData = await loginResponse.json();

      if (!loginResponse.ok) {
        if (loginData.error && (loginData.error.includes('confirm') || loginData.error.includes('confirmado'))) {
          setSuccessMessage('Conta cadastrada! Verifique seu e-mail para ativar e poder acessar o painel.');
          return;
        }
        throw new Error(loginData.error || 'Conta criada, mas falha ao autenticar.');
      }

      setSuccessMessage('Conta criada com sucesso! Redirecionando...');
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 1500);
    } catch (err) {
      const error = err as Error;
      setErrorMessage(error.message || 'Erro ao criar conta. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const changeMode = (newMode: AuthMode) => {
    setMode(newMode);
    setErrorMessage(null);
    setSuccessMessage(null);
    setPassword('');
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-teal-950 to-slate-950 overflow-hidden">
      {/* Elemento Decorativo de Fundo */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-900/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-emerald-900/10 rounded-full blur-3xl" />

      {/* Card Glassmorphic */}
      <div className="relative z-10 w-full max-w-md p-8 bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl space-y-6 animate-in fade-in duration-300">
        
        {/* Cabeçalho do Card */}
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 tracking-tight">
            UBD Training Tracker
          </h1>
          <p className="text-xs text-slate-400 mt-2 uppercase tracking-widest font-black">
            {mode === 'login' && 'Acesso ao Painel'}
            {mode === 'register' && 'Novo Supervisor'}
          </p>
        </div>

        {/* Alerta de Configuração Faltante */}
        {(!process.env.NEXT_PUBLIC_SUPABASE_URL || 
          !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
          process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder')) && (
          <div className="p-3.5 bg-amber-950/40 border border-amber-900/50 rounded-xl text-xs text-amber-300 text-left space-y-1">
            <div className="flex items-center gap-2 font-bold text-amber-400">
              <AlertCircle size={14} className="flex-shrink-0" />
              <span>Erro de Configuração Supabase</span>
            </div>
            <p className="leading-relaxed opacity-90">
              As variáveis de ambiente do Supabase não foram detectadas no navegador. 
              Se estiver rodando <strong>localmente</strong>, reinicie seu servidor de desenvolvimento (parando e rodando <code>npm run dev</code> de novo). 
              Se estiver na <strong>Vercel</strong>, adicione <code>NEXT_PUBLIC_SUPABASE_URL</code> e <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> no painel de Environment Variables do projeto e faça um novo deploy.
            </p>
          </div>
        )}

        {/* Mensagens de Feedback */}
        {errorMessage && (
          <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-xs text-red-400 text-center flex items-center justify-center gap-2">
            <AlertCircle size={14} className="flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-900/50 rounded-xl text-xs text-emerald-400 text-center flex items-center justify-center gap-2">
            <CheckCircle2 size={14} className="flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* FORMULÁRIO DE LOGIN */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Endereço de E-mail
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@empresa.com.br"
                  disabled={isLoading}
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition disabled:opacity-50"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Senha de Acesso
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isLoading}
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition disabled:opacity-50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-950/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 disabled:opacity-50 disabled:transform-none"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Autenticando...
                </>
              ) : (
                'Entrar no Sistema'
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => changeMode('register')}
                className="text-xs text-slate-400 hover:text-emerald-400 transition"
              >
                Não tem uma conta? <span className="font-bold underline">Criar conta de Supervisor</span>
              </button>
            </div>
          </form>
        )}

        {/* FORMULÁRIO DE REGISTRO */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Endereço de E-mail
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@empresa.com.br"
                  disabled={isLoading}
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition disabled:opacity-50"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Definir Senha
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Defina uma senha segura"
                  disabled={isLoading}
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition disabled:opacity-50"
                />
              </div>
            </div>

            {/* Checklist Visual Interativa de Segurança */}
            {password.length > 0 && (
              <div className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl space-y-1.5 text-[10px]">
                <p className="font-bold text-slate-450 uppercase tracking-wider">Requisitos da Senha:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${pwdCriteria.length ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <span className={pwdCriteria.length ? 'text-emerald-400' : 'text-slate-500'}>8 a 32 caracteres</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${pwdCriteria.uppercase ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <span className={pwdCriteria.uppercase ? 'text-emerald-400' : 'text-slate-500'}>Letra maiúscula (A-Z)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${pwdCriteria.lowercase ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <span className={pwdCriteria.lowercase ? 'text-emerald-400' : 'text-slate-500'}>Letra minúscula (a-z)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${pwdCriteria.number ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <span className={pwdCriteria.number ? 'text-emerald-400' : 'text-slate-500'}>Um número (0-9)</span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:col-span-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${pwdCriteria.special ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <span className={pwdCriteria.special ? 'text-emerald-400' : 'text-slate-500'}>Caractere especial (!@#$...)</span>
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !isPasswordValid || !isEmailValid}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-950/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 disabled:opacity-50 disabled:transform-none"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Registrando...
                </>
              ) : (
                'Criar Minha Conta'
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => changeMode('login')}
                className="text-xs text-slate-400 hover:text-emerald-400 transition flex items-center justify-center gap-1.5 mx-auto"
              >
                <ArrowLeft size={12} />
                Já tem uma conta? <span className="font-bold underline">Fazer Login</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
