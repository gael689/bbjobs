"use client";

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRightIcon, BuildingOfficeIcon, BoltIcon, ChartBarSquareIcon } from '@heroicons/react/24/outline';

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } }
};

export default function Home() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-80px)] overflow-hidden">
      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center pt-32 pb-40 px-6">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#00f0ff]/10 blur-[120px] rounded-full pointer-events-none" />
        
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="relative z-10 text-center max-w-5xl mx-auto space-y-10"
        >
          <motion.div variants={fadeUp} className="inline-block">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-900 border border-gray-800 text-sm text-gray-300 font-medium tracking-wide">
              <span className="w-2 h-2 rounded-full bg-[#00f0ff] animate-pulse"></span>
              BBJobs Next-Gen Portal
            </span>
          </motion.div>

          <motion.h1 variants={fadeUp} className="text-6xl md:text-8xl font-display font-extrabold tracking-tight text-white leading-[1.1]">
            El futuro del talento <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00f0ff] to-[#8a2be2]">
              es ahora.
            </span>
          </motion.h1>
          
          <motion.p variants={fadeUp} className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto font-light">
            Conectamos a las mentes más brillantes con empresas disruptivas. Una plataforma sin fricción, rápida y brutalmente eficaz.
          </motion.p>
          
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-10">
            <Link 
              href="/register?type=candidate" 
              className="group relative inline-flex items-center gap-3 bg-white text-black px-8 py-4 rounded-xl font-bold text-lg transition-transform hover:scale-105"
            >
              Comenzar Carrera
              <ArrowRightIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link 
              href="/register?type=company" 
              className="group relative inline-flex items-center gap-3 bg-transparent text-white px-8 py-4 rounded-xl font-bold text-lg border border-gray-700 hover:border-[#00f0ff]/50 hover:bg-gray-900/50 transition-colors"
            >
              Publicar Búsqueda
              <BuildingOfficeIcon className="w-5 h-5 text-gray-400 group-hover:text-[#00f0ff] transition-colors" />
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* Bento Grid Features */}
      <section className="py-32 bg-[#0a0a0c] relative border-t border-gray-800/50">
        <div className="container mx-auto px-6 max-w-7xl">
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">Ingeniería de Selección.</h2>
            <p className="text-gray-400 text-lg max-w-2xl">Hemos rediseñado el proceso de reclutamiento para que sea una experiencia de primer nivel.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Bento Card 1 */}
            <motion.div 
              whileHover={{ y: -5 }}
              className="md:col-span-2 bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800 hover:border-gray-700 rounded-3xl p-10 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#00f0ff]/5 rounded-full blur-[50px] group-hover:bg-[#00f0ff]/10 transition-colors" />
              <div className="w-14 h-14 bg-gray-800 rounded-2xl flex items-center justify-center mb-8 border border-gray-700">
                <BoltIcon className="w-7 h-7 text-[#00f0ff]" />
              </div>
              <h3 className="text-2xl font-display font-bold text-white mb-4">Postulación One-Click</h3>
              <p className="text-gray-400 text-lg leading-relaxed max-w-md">
                Sube tu currículum a nuestro Vault (S3 R2). Tu información se guarda segura y lista para dispararse a la oferta ideal al instante.
              </p>
            </motion.div>
            
            {/* Bento Card 2 */}
            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-gradient-to-bl from-gray-900 to-gray-950 border border-gray-800 hover:border-gray-700 rounded-3xl p-10 relative overflow-hidden group"
            >
              <div className="w-14 h-14 bg-gray-800 rounded-2xl flex items-center justify-center mb-8 border border-gray-700">
                <BuildingOfficeIcon className="w-7 h-7 text-[#8a2be2]" />
              </div>
              <h3 className="text-2xl font-display font-bold text-white mb-4">Destaca tu Empresa</h3>
              <p className="text-gray-400 leading-relaxed">
                Adquiere slots destacados a través de nuestra integración de pagos y pon tus vacantes en la cima.
              </p>
            </motion.div>

            {/* Bento Card 3 */}
            <motion.div 
              whileHover={{ y: -5 }}
              className="md:col-span-3 bg-[#121215] border border-gray-800 hover:border-gray-700 rounded-3xl p-10 relative overflow-hidden flex flex-col md:flex-row items-center justify-between group"
            >
               <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay pointer-events-none" />
               <div className="md:w-1/2 relative z-10 mb-8 md:mb-0">
                 <div className="w-14 h-14 bg-gray-800 rounded-2xl flex items-center justify-center mb-8 border border-gray-700">
                   <ChartBarSquareIcon className="w-7 h-7 text-emerald-400" />
                 </div>
                 <h3 className="text-3xl font-display font-bold text-white mb-4">Tests Psicométricos Nativos</h3>
                 <p className="text-gray-400 text-lg leading-relaxed">
                   Demuestra tu valía. Nuestra plataforma incorpora pruebas cognitivas directamente en tu perfil, sumando credibilidad sin fricciones externas.
                 </p>
               </div>
               <div className="md:w-5/12 bg-gray-900 border border-gray-800 rounded-2xl p-6 relative z-10 shadow-2xl">
                 {/* Fake UI Graphic */}
                 <div className="flex justify-between items-center mb-6">
                    <div className="h-4 w-24 bg-gray-800 rounded-full"></div>
                    <div className="h-6 w-12 bg-emerald-500/20 rounded-md flex items-center justify-center text-emerald-400 text-xs font-bold border border-emerald-500/30">98%</div>
                 </div>
                 <div className="space-y-4">
                    <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 w-[98%]"></div>
                    </div>
                    <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-[#00f0ff] w-[85%]"></div>
                    </div>
                    <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-[#8a2be2] w-[92%]"></div>
                    </div>
                 </div>
               </div>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}
