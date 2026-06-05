"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';
import { DocumentTextIcon, PaperAirplaneIcon, SparklesIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';

export default function CandidateDashboard() {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
    if (user?.role && user.role !== 'candidate') {
      router.push(`/dashboard/${user.role}`);
    }
  }, [user, isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'candidate') {
      api.get('/me/candidate/profile')
        .then(res => setProfile(res.data))
        .catch(err => console.error("Error fetching profile", err));
    }
  }, [isAuthenticated, user]);

  if (isLoading || !isAuthenticated || user?.role !== 'candidate') {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-white font-display animate-pulse">Iniciando terminal...</div></div>;
  }

  return (
    <div className="container mx-auto px-6 py-12 max-w-7xl">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12"
      >
        <h1 className="text-4xl font-display font-extrabold text-white">
          <span className="text-gray-500 font-light">OPERATOR_</span>
          {profile?.first_name || user?.email.split('@')[0].toUpperCase()}
        </h1>
        <p className="text-gray-400 mt-2 font-sans">Panel de control de tu trayectoria.</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Mi CV Card */}
        <motion.div 
          whileHover={{ y: -5 }}
          className="bg-[#121215] border border-gray-800 hover:border-white/20 rounded-3xl p-8 relative overflow-hidden group"
        >
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-colors" />
          <div className="w-14 h-14 bg-[#0a0a0c] border border-gray-800 rounded-2xl flex items-center justify-center mb-6">
            <DocumentTextIcon className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-display font-bold text-white mb-2">Protocolo CV</h2>
          <p className="text-gray-500 text-sm mb-8 leading-relaxed">Actualiza tu documento base (PDF) en el vault seguro.</p>
          <button className="w-full py-3 bg-white hover:bg-gray-200 text-black rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2">
            <CloudArrowUpIcon className="w-5 h-5" />
            Cargar al Servidor
          </button>
        </motion.div>

        {/* Postulaciones Card */}
        <motion.div 
          whileHover={{ y: -5 }}
          className="bg-[#121215] border border-gray-800 hover:border-[#8a2be2]/30 rounded-3xl p-8 relative overflow-hidden group"
        >
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#8a2be2]/10 rounded-full blur-2xl group-hover:bg-[#8a2be2]/20 transition-colors" />
          <div className="w-14 h-14 bg-[#0a0a0c] border border-gray-800 rounded-2xl flex items-center justify-center mb-6">
            <PaperAirplaneIcon className="w-7 h-7 text-[#8a2be2]" />
          </div>
          <h2 className="text-2xl font-display font-bold text-white mb-2">Transmisiones</h2>
          <div className="flex items-end gap-2 mb-2">
            <span className="text-5xl font-extrabold text-white">0</span>
            <span className="text-gray-500 font-bold uppercase tracking-wider text-xs mb-1.5">Activas</span>
          </div>
          <p className="text-gray-500 text-sm">Postulaciones en curso.</p>
        </motion.div>

        {/* Tests Card */}
        <motion.div 
          whileHover={{ y: -5 }}
          className="bg-[#121215] border border-gray-800 hover:border-emerald-500/30 rounded-3xl p-8 relative overflow-hidden group"
        >
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-colors" />
          <div className="w-14 h-14 bg-[#0a0a0c] border border-gray-800 rounded-2xl flex items-center justify-center mb-6">
            <SparklesIcon className="w-7 h-7 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-display font-bold text-white mb-2">Psicométricas</h2>
          <p className="text-gray-500 text-sm mb-8 leading-relaxed">Demuestra tu coeficiente y habilidades lógicas en el simulador.</p>
          <button className="w-full py-3 border border-gray-700 hover:border-emerald-500/50 hover:bg-emerald-500/10 text-emerald-400 rounded-xl text-sm font-bold transition-all">
            Iniciar Evaluación
          </button>
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mt-16 bg-[#121215] border border-gray-800 rounded-3xl p-10"
      >
        <h3 className="text-2xl font-display font-bold text-white mb-8">Registro de Actividad</h3>
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-gray-800 rounded-2xl bg-[#0a0a0c]">
          <PaperAirplaneIcon className="w-12 h-12 text-gray-700 mb-6" />
          <p className="text-gray-400 font-medium mb-4">No hay logs de transmisiones recientes.</p>
          <a href="/jobs" className="text-white hover:text-[#00f0ff] transition-colors text-sm font-bold border-b border-white hover:border-[#00f0ff] pb-0.5">Escanear mercado laboral</a>
        </div>
      </motion.div>
    </div>
  );
}
