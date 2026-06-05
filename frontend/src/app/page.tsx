import Link from 'next/link';
import { ArrowRight, Briefcase, Building, Zap } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)]">
      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center py-32 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900/20 to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay pointer-events-none" />
        
        <div className="relative z-10 text-center max-w-4xl mx-auto space-y-8">
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white drop-shadow-sm">
            Encuentra tu trabajo <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">soñado</span> hoy
          </h1>
          <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto">
            Conectamos a los mejores talentos con las empresas más innovadoras.
            Un portal diseñado para impulsar tu carrera profesional.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
            <Link 
              href="/register?type=candidate" 
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full font-medium transition-all transform hover:scale-105"
            >
              Soy Candidato
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link 
              href="/register?type=company" 
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-8 py-4 rounded-full font-medium transition-all ring-1 ring-gray-700 hover:ring-gray-600"
            >
              Soy Empresa
              <Building className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-gray-900/50">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-950 p-8 rounded-2xl border border-gray-800 hover:border-blue-500/50 transition-colors group">
              <div className="w-12 h-12 bg-blue-900/30 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Briefcase className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Miles de empleos</h3>
              <p className="text-gray-400 leading-relaxed">
                Accede a una base de datos actualizada diariamente con las mejores ofertas del mercado laboral.
              </p>
            </div>
            
            <div className="bg-gray-950 p-8 rounded-2xl border border-gray-800 hover:border-indigo-500/50 transition-colors group">
              <div className="w-12 h-12 bg-indigo-900/30 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Building className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Empresas verificadas</h3>
              <p className="text-gray-400 leading-relaxed">
                Todas las empresas pasan por un riguroso proceso de verificación para garantizar tu seguridad.
              </p>
            </div>

            <div className="bg-gray-950 p-8 rounded-2xl border border-gray-800 hover:border-purple-500/50 transition-colors group">
              <div className="w-12 h-12 bg-purple-900/30 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Zap className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Postulación rápida</h3>
              <p className="text-gray-400 leading-relaxed">
                Carga tu CV una sola vez y postúlate a múltiples ofertas con un solo click. Perfil centralizado.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
