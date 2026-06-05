"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';
import { BuildingOffice2Icon, BriefcaseIcon, UsersIcon, StarIcon, PlusIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';

export default function CompanyDashboard() {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
    if (user?.role && user.role !== 'company') {
      router.push(`/dashboard/${user.role}`);
    }
  }, [user, isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'company') {
      api.get('/me/company/profile')
        .then(res => setProfile(res.data))
        .catch(err => console.error("Error fetching profile", err));
        
      api.get('/me/company/subscription')
        .then(res => setSubscription(res.data))
        .catch(err => console.error("Error fetching subscription", err));
    }
  }, [isAuthenticated, user]);

  if (isLoading || !isAuthenticated || user?.role !== 'company') {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-[#00f0ff] font-display animate-pulse">Accediendo a la terminal corporativa...</div></div>;
  }

  return (
    <div className="container mx-auto px-6 py-12 max-w-7xl">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6"
      >
        <div>
          <h1 className="text-4xl font-display font-extrabold text-white flex items-center gap-4">
            <div className="p-3 bg-[#00f0ff]/10 rounded-2xl">
              <BuildingOffice2Icon className="w-8 h-8 text-[#00f0ff]" />
            </div>
            {profile?.legal_name || 'Terminal Corporativa'}
          </h1>
          <p className="text-gray-400 mt-3 font-sans max-w-lg">Despliega nuevas vacantes y filtra al talento mediante inteligencia y precisión.</p>
        </div>
        <button className="flex items-center justify-center gap-3 bg-[#00f0ff] hover:bg-[#00f0ff]/80 text-black px-8 py-4 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:shadow-[0_0_30px_rgba(0,240,255,0.5)]">
          <PlusIcon className="w-5 h-5 stroke-2" />
          Nueva Directiva
        </button>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Plan Info */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-[#121215] to-[#0a0a0c] border border-gray-800 hover:border-[#00f0ff]/30 rounded-3xl p-8 relative overflow-hidden group md:col-span-1"
        >
          <div className="absolute top-4 right-4 p-2 bg-gray-900 border border-gray-800 rounded-xl">
            <StarIcon className="w-5 h-5 text-[#00f0ff]" />
          </div>
          <h3 className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-2">Nivel de Acceso</h3>
          <p className="text-3xl font-display font-bold text-white mb-6">{subscription?.plan?.name || 'Standard'}</p>
          <div className="space-y-3">
            <div className="flex justify-between text-sm font-medium">
              <span className="text-gray-400">Búsquedas</span>
              <span className="text-white">0 / {subscription?.plan?.max_active_job_postings || '1'}</span>
            </div>
            <div className="w-full bg-gray-900 rounded-full h-2 overflow-hidden border border-gray-800">
              <div className="bg-[#00f0ff] h-full rounded-full w-[0%]"></div>
            </div>
          </div>
          <button className="mt-8 w-full py-3 bg-gray-900 hover:bg-gray-800 text-white border border-gray-800 hover:border-gray-700 rounded-xl text-sm font-bold transition-all">
            Escalar Plan
          </button>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 md:col-span-3">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-[#121215] border border-gray-800 rounded-3xl p-8 flex flex-col justify-center"
          >
            <div className="flex items-center space-x-4 mb-4">
              <div className="p-3 bg-gray-900 border border-gray-800 rounded-xl">
                <BriefcaseIcon className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-gray-500 font-bold uppercase tracking-wider text-xs">Directivas Activas</h3>
            </div>
            <p className="text-6xl font-display font-extrabold text-white">0</p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="bg-[#121215] border border-gray-800 rounded-3xl p-8 flex flex-col justify-center"
          >
            <div className="flex items-center space-x-4 mb-4">
              <div className="p-3 bg-gray-900 border border-gray-800 rounded-xl">
                <UsersIcon className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-gray-500 font-bold uppercase tracking-wider text-xs">Candidatos Recibidos</h3>
            </div>
            <p className="text-6xl font-display font-extrabold text-white">0</p>
          </motion.div>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-12 bg-[#121215] border border-gray-800 rounded-3xl overflow-hidden"
      >
        <div className="px-8 py-6 border-b border-gray-800 flex justify-between items-center bg-[#0a0a0c]">
          <h3 className="text-xl font-display font-bold text-white">Últimas Publicaciones</h3>
          <button className="text-sm font-bold text-[#00f0ff] hover:text-white transition-colors">Ver Archivo</button>
        </div>
        <div className="p-16 text-center flex flex-col items-center">
          <BriefcaseIcon className="w-16 h-16 text-gray-800 mb-6" />
          <p className="text-gray-500 mb-8 font-medium">El registro de directivas está vacío.</p>
          <button className="px-6 py-3 bg-white hover:bg-gray-200 text-black rounded-xl font-bold transition-colors">
            Generar primera búsqueda
          </button>
        </div>
      </motion.div>
    </div>
  );
}
