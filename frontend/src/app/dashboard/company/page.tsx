"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';
import { Building2, Briefcase, Users, Star, Plus } from 'lucide-react';

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
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-indigo-500 font-medium">Cargando panel empresarial...</div></div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Building2 className="w-8 h-8 text-indigo-500" />
            {profile?.legal_name || 'Panel de Empresa'}
          </h1>
          <p className="text-gray-400 mt-2">Gestiona tus vacantes y el talento de forma eficiente.</p>
        </div>
        <button className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium transition-all shadow-lg shadow-indigo-900/20">
          <Plus className="w-5 h-5" />
          Nueva Búsqueda
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Plan Info */}
        <div className="bg-gradient-to-br from-indigo-900/40 to-gray-950 border border-indigo-500/20 rounded-2xl p-6 relative overflow-hidden group md:col-span-1">
          <div className="absolute top-2 right-2 p-1.5 bg-indigo-500/20 rounded-lg">
            <Star className="w-4 h-4 text-indigo-400" />
          </div>
          <h3 className="text-gray-400 text-sm font-medium mb-1">Plan Actual</h3>
          <p className="text-2xl font-bold text-white mb-4">{subscription?.plan?.name || 'Free'}</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Búsquedas activas</span>
              <span className="text-white font-medium">0 / {subscription?.plan?.max_active_job_postings || '1'}</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-1.5">
              <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: '0%' }}></div>
            </div>
          </div>
          <button className="mt-6 w-full py-2 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-wider">
            Mejorar Plan
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:col-span-3">
          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6 flex flex-col justify-center">
            <div className="flex items-center space-x-3 mb-2">
              <Briefcase className="w-5 h-5 text-gray-500" />
              <h3 className="text-gray-400 font-medium">Vacantes Activas</h3>
            </div>
            <p className="text-4xl font-bold text-white">0</p>
          </div>
          
          <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6 flex flex-col justify-center">
            <div className="flex items-center space-x-3 mb-2">
              <Users className="w-5 h-5 text-gray-500" />
              <h3 className="text-gray-400 font-medium">Nuevos Postulantes</h3>
            </div>
            <p className="text-4xl font-bold text-white">0</p>
          </div>
        </div>
      </div>

      <div className="mt-10 bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-white">Búsquedas Recientes</h3>
          <a href="#" className="text-sm font-medium text-indigo-400 hover:text-indigo-300">Ver todas</a>
        </div>
        <div className="p-8 text-center flex flex-col items-center">
          <Briefcase className="w-12 h-12 text-gray-800 mb-4" />
          <p className="text-gray-400 mb-6">No tienes búsquedas publicadas todavía.</p>
          <button className="px-4 py-2 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors text-sm">
            Crear tu primer aviso
          </button>
        </div>
      </div>
    </div>
  );
}
