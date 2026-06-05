"use client";

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { MagnifyingGlassIcon, MapPinIcon, BriefcaseIcon, FunnelIcon, BoltIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/jobs')
      .then(res => setJobs(res.data))
      .catch(err => console.error("Error fetching jobs", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container mx-auto px-6 py-16 max-w-7xl">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-16 relative"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-[#00f0ff]/10 blur-[100px] rounded-full pointer-events-none" />
        <h1 className="text-5xl md:text-6xl font-display font-extrabold text-white mb-6 tracking-tight">Directorio <span className="text-[#00f0ff]">Global</span></h1>
        <p className="text-gray-400 text-xl max-w-2xl mx-auto font-light">Accede a las vacantes de las organizaciones más exigentes de la red.</p>
      </motion.div>

      {/* Search Bar */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#121215]/80 backdrop-blur-md border border-gray-800 p-3 rounded-2xl mb-16 flex flex-col md:flex-row gap-3 shadow-2xl relative z-20"
      >
        <div className="flex-1 relative group">
          <MagnifyingGlassIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5 group-focus-within:text-[#00f0ff] transition-colors" />
          <input 
            type="text" 
            placeholder="Puesto, tecnología o palabra clave" 
            className="w-full bg-[#0a0a0c] border border-gray-800 rounded-xl py-4 pl-14 pr-4 text-white font-medium focus:outline-none focus:ring-1 focus:ring-[#00f0ff] focus:border-[#00f0ff] transition-all"
          />
        </div>
        <div className="flex-1 relative group">
          <MapPinIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5 group-focus-within:text-[#00f0ff] transition-colors" />
          <input 
            type="text" 
            placeholder="Ubicación física o nodo remoto" 
            className="w-full bg-[#0a0a0c] border border-gray-800 rounded-xl py-4 pl-14 pr-4 text-white font-medium focus:outline-none focus:ring-1 focus:ring-[#00f0ff] focus:border-[#00f0ff] transition-all"
          />
        </div>
        <button className="bg-[#00f0ff] hover:bg-[#00f0ff]/80 text-black font-bold py-4 px-10 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,240,255,0.2)]">
          Escanear
        </button>
      </motion.div>

      <div className="flex flex-col lg:flex-row gap-10">
        {/* Filters Sidebar */}
        <aside className="w-full lg:w-72 space-y-8 flex-shrink-0">
          <div className="bg-[#121215] border border-gray-800 rounded-3xl p-6">
            <div className="flex items-center gap-3 text-white font-display font-bold pb-4 border-b border-gray-800 mb-6 text-lg">
              <FunnelIcon className="w-5 h-5 text-gray-500" />
              Parámetros
            </div>
            
            <div className="space-y-4">
              <h3 className="text-gray-500 font-bold uppercase tracking-wider text-xs">Modalidad</h3>
              <div className="space-y-3">
                {['Remoto Total', 'Híbrido', 'Base Física'].map(mode => (
                  <label key={mode} className="flex items-center gap-4 cursor-pointer group">
                    <div className="relative flex items-center justify-center">
                      <input type="checkbox" className="peer appearance-none w-5 h-5 rounded border border-gray-700 bg-[#0a0a0c] checked:bg-[#00f0ff] checked:border-[#00f0ff] transition-all" />
                      <div className="absolute text-black opacity-0 peer-checked:opacity-100 pointer-events-none">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                    <span className="text-gray-300 font-medium group-hover:text-white transition-colors">{mode}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Jobs List */}
        <div className="flex-1 space-y-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-display font-bold text-white">Salida <span className="text-gray-600 font-sans font-medium text-lg ml-2">({jobs.length})</span></h2>
            <div className="relative">
              <select className="appearance-none bg-[#121215] border border-gray-800 text-gray-300 font-medium text-sm rounded-xl focus:ring-1 focus:ring-[#00f0ff] focus:outline-none block px-4 py-2.5 pr-10 cursor-pointer">
                <option>Prioridad Alta</option>
                <option>Cronológico</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="animate-pulse space-y-4">
              {[1,2,3].map(i => (
                <div key={i} className="h-32 bg-[#121215] border border-gray-800 rounded-3xl"></div>
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="bg-[#121215] border border-gray-800 rounded-3xl p-16 text-center flex flex-col items-center">
              <BriefcaseIcon className="w-16 h-16 text-gray-800 mb-6" />
              <h3 className="text-2xl font-display font-bold text-white mb-3">Señal vacía</h3>
              <p className="text-gray-400 font-medium">No se encontraron registros que coincidan con la búsqueda.</p>
            </div>
          ) : (
            jobs.map((job: any) => (
              <motion.div 
                key={job.id} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.01 }}
                className="bg-[#121215] hover:bg-[#1a1a1e] border border-gray-800 hover:border-gray-700 rounded-3xl p-8 transition-all group flex flex-col sm:flex-row justify-between sm:items-center gap-6"
              >
                <div>
                  <Link href={`/jobs/${job.id}`} className="text-2xl font-display font-bold text-white group-hover:text-[#00f0ff] transition-colors">
                    {job.title}
                  </Link>
                  <p className="text-gray-400 font-medium mt-2 text-lg">{job.company_name}</p>
                  <div className="flex flex-wrap items-center gap-6 mt-5 text-sm text-gray-500 font-medium">
                    <span className="flex items-center gap-2"><MapPinIcon className="w-4 h-4" /> {job.location || 'Distribuido'}</span>
                    <span className="flex items-center gap-2"><BriefcaseIcon className="w-4 h-4" /> {job.modality || 'Full-time'}</span>
                  </div>
                </div>
                <div className="flex flex-col items-start sm:items-end justify-between h-full min-h-[80px]">
                  {job.is_featured ? (
                    <span className="flex items-center gap-1.5 bg-[#8a2be2]/10 border border-[#8a2be2]/30 text-[#8a2be2] text-xs font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider">
                      <BoltIcon className="w-3.5 h-3.5" />
                      Destacado
                    </span>
                  ) : <div></div>}
                  <span className="text-xs font-bold text-gray-600 mt-auto uppercase tracking-wider">T-02:00</span>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
