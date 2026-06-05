"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { api } from '@/lib/api';
import { FileText, Send, BrainCircuit, UploadCloud } from 'lucide-react';

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
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-blue-500 font-medium">Cargando perfil...</div></div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Hola, {profile?.first_name || user?.email.split('@')[0]}</h1>
        <p className="text-gray-400 mt-2">Aquí tienes un resumen de tu carrera y postulaciones.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Mi CV Card */}
        <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-900/20 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
          <div className="flex items-center space-x-4 mb-4">
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
              <FileText className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-semibold text-white">Mi Currículum</h2>
          </div>
          <p className="text-gray-400 text-sm mb-6">Mantené tu CV actualizado para destacar frente a los reclutadores.</p>
          <button className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
            <UploadCloud className="w-4 h-4" />
            Subir PDF
          </button>
        </div>

        {/* Postulaciones Card */}
        <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-900/20 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
          <div className="flex items-center space-x-4 mb-4">
            <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
              <Send className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-semibold text-white">Postulaciones</h2>
          </div>
          <div className="flex items-end justify-between mb-2">
            <span className="text-4xl font-bold text-white">0</span>
            <span className="text-gray-400 text-sm mb-1">activas</span>
          </div>
          <p className="text-gray-500 text-sm">Explora las ofertas para encontrar tu match.</p>
        </div>

        {/* Tests Card */}
        <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-900/20 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
          <div className="flex items-center space-x-4 mb-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-semibold text-white">Tests Psicométricos</h2>
          </div>
          <p className="text-gray-400 text-sm mb-6">Potenciá tu perfil completando nuestras evaluaciones.</p>
          <button className="w-full py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white rounded-xl text-sm font-medium transition-colors">
            Ver Evaluaciones
          </button>
        </div>
      </div>

      <div className="mt-12 bg-gray-950 border border-gray-800 rounded-2xl p-8">
        <h3 className="text-xl font-semibold text-white mb-6">Actividad Reciente</h3>
        <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-gray-800 rounded-xl">
          <Send className="w-12 h-12 text-gray-700 mb-4" />
          <p className="text-gray-400 font-medium">Aún no te has postulado a ninguna oferta</p>
          <a href="/jobs" className="mt-4 text-blue-400 hover:text-blue-300 transition-colors text-sm font-medium">Explorar empleos disponibles</a>
        </div>
      </div>
    </div>
  );
}
