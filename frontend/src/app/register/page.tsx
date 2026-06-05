"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, setAccessToken } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { Lock, Mail, User, Building, ArrowRight } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuthStore();
  
  const [role, setRole] = useState<'candidate' | 'company'>('candidate');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const type = searchParams.get('type');
    if (type === 'company' || type === 'candidate') {
      setRole(type);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = role === 'company' ? '/auth/register/company' : '/auth/register/candidate';
      await api.post(endpoint, {
        email,
        password
      });

      // Automatically login after registration
      const formData = new FormData();
      formData.append('username', email);
      formData.append('password', password);

      const res = await api.post('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      const { access_token } = res.data;
      setAccessToken(access_token);
      
      const userRes = await api.get('/auth/me');
      login(userRes.data, access_token);
      
      if (userRes.data.role === 'company') {
        router.push('/dashboard/company');
      } else {
        router.push('/dashboard/candidate');
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ocurrió un error en el registro.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/10 via-transparent to-blue-900/10 pointer-events-none" />
      
      <div className="w-full max-w-md bg-gray-950 border border-gray-800 rounded-2xl p-8 shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Crea tu cuenta</h1>
          <p className="text-gray-400">Únete a BBJobs y potencia tu futuro</p>
        </div>

        <div className="flex bg-gray-900 p-1 rounded-xl mb-8">
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${role === 'candidate' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setRole('candidate')}
          >
            <User className="w-4 h-4" /> Candidato
          </button>
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${role === 'company' ? 'bg-gray-800 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setRole('company')}
          >
            <Building className="w-4 h-4" /> Empresa
          </button>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-500/50 text-red-300 p-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Correo Electrónico</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-500" />
              </div>
              <input 
                type="email" 
                required
                className="block w-full pl-10 pr-3 py-3 border border-gray-700 rounded-xl bg-gray-900 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Contraseña</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-500" />
              </div>
              <input 
                type="password" 
                required
                minLength={8}
                className="block w-full pl-10 pr-3 py-3 border border-gray-700 rounded-xl bg-gray-900 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">Mínimo 8 caracteres.</p>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-xl font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Registrando...' : 'Registrarme'}
            {!loading && <ArrowRight className="w-5 h-5" />}
          </button>
        </form>
        
        <div className="mt-8 text-center">
          <p className="text-gray-400 text-sm">
            ¿Ya tienes cuenta? <a href="/login" className="text-blue-400 hover:text-blue-300 font-medium">Inicia sesión</a>
          </p>
        </div>
      </div>
    </div>
  );
}
