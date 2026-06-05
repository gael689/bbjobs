"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setAccessToken } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { LockClosedIcon, EnvelopeIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
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
      } else if (userRes.data.role === 'admin') {
        router.push('/dashboard/admin');
      } else {
        router.push('/dashboard/candidate');
      }
      
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Credenciales inválidas. Acceso denegado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#8a2be2]/10 blur-[100px] rounded-full pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md bg-[#121215]/80 backdrop-blur-xl border border-gray-800 rounded-3xl p-10 shadow-2xl relative z-10"
      >
        <div className="text-center mb-10">
          <h1 className="text-3xl font-display font-bold text-white mb-2 tracking-tight">Acceso VIP</h1>
          <p className="text-gray-400 font-sans text-sm">Autentícate para continuar al panel</p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
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
                <EnvelopeIcon className="h-5 w-5 text-gray-600 group-focus-within:text-[#00f0ff] transition-colors" />
              </div>
              <input 
                type="email" 
                required
                className="block w-full pl-12 pr-4 py-3.5 border border-gray-800 rounded-xl bg-[#0a0a0c] text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-[#00f0ff] focus:border-[#00f0ff] transition-all"
                placeholder="system@bbjobs.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Protocolo de Seguridad</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <LockClosedIcon className="h-5 w-5 text-gray-600 group-focus-within:text-[#00f0ff] transition-colors" />
              </div>
              <input 
                type="password" 
                required
                className="block w-full pl-12 pr-4 py-3.5 border border-gray-800 rounded-xl bg-[#0a0a0c] text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-[#00f0ff] focus:border-[#00f0ff] transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-end">
            <a href="#" className="text-xs text-gray-500 hover:text-white transition-colors">¿Resetear credenciales?</a>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full relative flex items-center justify-center gap-2 bg-white hover:bg-gray-200 text-black py-4 px-4 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            {loading ? 'Verificando...' : 'Entrar'}
            {!loading && <ArrowRightIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
          </button>
        </form>
        
        <div className="mt-10 text-center">
          <p className="text-gray-500 text-sm">
            ¿Nuevo en el sistema? <a href="/register" className="text-white hover:text-[#00f0ff] font-medium transition-colors border-b border-gray-700 hover:border-[#00f0ff] pb-0.5">Crear Identidad</a>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
