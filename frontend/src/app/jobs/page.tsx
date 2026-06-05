"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Search, MapPin, Briefcase, Filter } from 'lucide-react';
import Link from 'next/link';

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulamos la llamada a la ruta pública de listado de jobs
    api.get('/jobs')
      .then(res => setJobs(res.data))
      .catch(err => console.error("Error fetching jobs", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container mx-auto px-4 py-12 max-w-7xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">Descubre tu próximo rol</h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">Explora cientos de oportunidades laborales en las empresas líderes del sector.</p>
      </div>

      {/* Search Bar */}
      <div className="bg-gray-950 border border-gray-800 p-4 rounded-2xl mb-12 flex flex-col md:flex-row gap-4 shadow-xl">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Cargo, palabra clave o empresa" 
            className="w-full bg-gray-900 border border-gray-800 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
          />
        </div>
        <div className="flex-1 relative">
          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Ciudad, provincia o Remoto" 
            className="w-full bg-gray-900 border border-gray-800 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
          />
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-8 rounded-xl transition-colors flex items-center justify-center gap-2">
          Buscar
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Filters Sidebar */}
        <aside className="w-full md:w-64 space-y-6">
          <div className="flex items-center gap-2 text-white font-semibold pb-2 border-b border-gray-800">
            <Filter className="w-5 h-5 text-blue-500" />
            Filtros
          </div>
          
          <div>
            <h3 className="text-gray-400 font-medium mb-3">Modalidad</h3>
            <div className="space-y-2">
              {['Remoto', 'Híbrido', 'Presencial'].map(mode => (
                <label key={mode} className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-blue-600 focus:ring-blue-500/50" />
                  <span className="text-gray-300 group-hover:text-white transition-colors">{mode}</span>
                </label>
              ))}
            </div>
          </div>
        </aside>

        {/* Jobs List */}
        <div className="flex-1 space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">Resultados <span className="text-gray-500 font-normal text-sm ml-2">({jobs.length})</span></h2>
            <select className="bg-gray-900 border border-gray-800 text-gray-300 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5">
              <option>Más recientes</option>
              <option>Más relevantes</option>
            </select>
          </div>

          {loading ? (
            <div className="animate-pulse space-y-4">
              {[1,2,3].map(i => (
                <div key={i} className="h-32 bg-gray-900 rounded-2xl"></div>
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="bg-gray-950 border border-gray-800 rounded-2xl p-12 text-center flex flex-col items-center">
              <Briefcase className="w-16 h-16 text-gray-800 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No se encontraron búsquedas</h3>
              <p className="text-gray-400">Intenta ajustar los filtros o los términos de búsqueda.</p>
            </div>
          ) : (
            jobs.map((job: any) => (
              <div key={job.id} className="bg-gray-950 hover:bg-gray-900 border border-gray-800 hover:border-blue-500/30 rounded-2xl p-6 transition-all group">
                <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
                  <div>
                    <Link href={`/jobs/${job.id}`} className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                      {job.title}
                    </Link>
                    <p className="text-blue-400 text-sm font-medium mt-1">{job.company_name}</p>
                    <div className="flex items-center gap-4 mt-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {job.location || 'Remoto'}</span>
                      <span className="flex items-center gap-1.5"><Briefcase className="w-4 h-4" /> {job.modality || 'Full-time'}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end justify-between">
                    {job.is_featured && (
                      <span className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-500 border border-amber-500/30 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                        Destacado
                      </span>
                    )}
                    <span className="text-xs text-gray-500 mt-auto pt-4">Hace 2 horas</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
