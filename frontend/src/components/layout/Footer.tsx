import { BriefcaseIcon } from '@heroicons/react/24/solid';

export default function Footer() {
  return (
    <footer className="border-t border-gray-800/50 bg-[#0a0a0c] pt-16 pb-8 mt-auto relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-[#8a2be2]/10 blur-[100px] pointer-events-none" />
      
      <div className="container mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-6">
              <BriefcaseIcon className="h-6 w-6 text-[#8a2be2]" />
              <span className="text-2xl font-display font-extrabold tracking-tight text-white">
                BB<span className="text-[#8a2be2]">Jobs</span>
              </span>
            </div>
            <p className="text-gray-400 max-w-sm">
              Plataforma de reclutamiento ultra-moderna. Conectamos la excelencia técnica con la innovación empresarial.
            </p>
          </div>
          
          <div>
            <h4 className="text-white font-display font-semibold mb-6">Plataforma</h4>
            <ul className="space-y-4">
              <li><a href="#" className="text-gray-400 hover:text-[#00f0ff] transition-colors">Candidatos VIP</a></li>
              <li><a href="#" className="text-gray-400 hover:text-[#00f0ff] transition-colors">Empresas Elite</a></li>
              <li><a href="#" className="text-gray-400 hover:text-[#00f0ff] transition-colors">Precios</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-display font-semibold mb-6">Legal</h4>
            <ul className="space-y-4">
              <li><a href="#" className="text-gray-400 hover:text-[#00f0ff] transition-colors">Términos</a></li>
              <li><a href="#" className="text-gray-400 hover:text-[#00f0ff] transition-colors">Privacidad</a></li>
              <li><a href="#" className="text-gray-400 hover:text-[#00f0ff] transition-colors">Cookies</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800/50 pt-8 flex flex-col md:flex-row items-center justify-between text-gray-500 text-sm">
          <p>© {new Date().getFullYear()} BBJobs. Neo-Industrial Design.</p>
          <div className="flex items-center space-x-2 mt-4 md:mt-0">
            <span>Crafted with</span>
            <span className="text-[#00f0ff]">♥</span>
            <span>in Web3 Era</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
