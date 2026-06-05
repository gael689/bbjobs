"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, setAccessToken } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { LockClosedIcon, EnvelopeIcon, UserIcon, BuildingOfficeIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';

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
      await api.post(endpoint, { email, password });

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
      setError(err.response?.data?.detail || 'Error en el proceso de registro.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#00f0ff]/5 blur-[120px] rounded-full pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-[#121215]/80 backdrop-blur-xl border border-gray-800 rounded-3xl p-10 shadow-2xl relative z-10"
      >
        <div className="text-center mb-10">
          <h1 className="text-3xl font-display font-bold text-white mb-2 tracking-tight">Registro de Identidad</h1>
          <p className="text-gray-400 font-sans text-sm">Selecciona tu perfil operativo</p>
        </div>

        <div className="flex bg-[#0a0a0c] p-1.5 rounded-2xl mb-8 border border-gray-800">
          <button
            type="button"
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${role === 'candidate' ? 'bg-[#121215] text-white shadow-md border border-gray-700' : 'text-gray-500 hover:text-white hover:bg-gray-900'}`}
            onClick={() => setRole('candidate')}
          >
            <UserIcon className="w-4 h-4" /> Talento
          </button>
          <button
            type="button"
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${role === 'company' ? 'bg-[#121215] text-[#00f0ff] shadow-md border border-[#00f0ff]/30' : 'text-gray-500 hover:text-white hover:bg-gray-900'}`}
            onClick={() => setRole('company')}
          >
            <BuildingOfficeIcon className="w-4 h-4" /> Empresa
          </button>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="bg-red-900/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl mb-8 text-sm text-center"
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Correo Electrónico</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <EnvelopeIcon className={`h-5 w-5 transition-colors ${role === 'company' ? 'group-focus-within:text-[#00f0ff]' : 'group-focus-within:text-white'} text-gray-600`} />
              </div>
              <input 
                type="email" 
                required
                className={`block w-full pl-12 pr-4 py-3.5 border border-gray-800 rounded-xl bg-[#0a0a0c] text-white placeholder-gray-600 focus:outline-none focus:ring-1 transition-all ${role === 'company' ? 'focus:ring-[#00f0ff] focus:border-[#00f0ff]' : 'focus:ring-white focus:border-white'}`}
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Contraseña</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <LockClosedIcon className={`h-5 w-5 transition-colors ${role === 'company' ? 'group-focus-within:text-[#00f0ff]' : 'group-focus-within:text-white'} text-gray-600`} />
              </div>
              <input 
                type="password" 
                required
                minLength={8}
                className={`block w-full pl-12 pr-4 py-3.5 border border-gray-800 rounded-xl bg-[#0a0a0c] text-white placeholder-gray-600 focus:outline-none focus:ring-1 transition-all ${role === 'company' ? 'focus:ring-[#00f0ff] focus:border-[#00f0ff]' : 'focus:ring-white focus:border-white'}`}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className={`w-full relative flex items-center justify-center gap-2 py-4 px-4 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed group ${role === 'company' ? 'bg-[#00f0ff] text-black hover:bg-[#00f0ff]/80' : 'bg-white text-black hover:bg-gray-200'}`}
          >
            {loading ? 'Generando...' : 'Crear Identidad'}
            {!loading && <ArrowRightIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
          </button>
        </form>
        
        <div className="mt-10 text-center">
          <p className="text-gray-500 text-sm">
            ¿Ya estás en el sistema? <a href="/login" className="text-white hover:text-[#00f0ff] font-medium transition-colors border-b border-gray-700 hover:border-[#00f0ff] pb-0.5">Ingresar</a>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
