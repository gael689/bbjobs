export default function Footer() {
  return (
    <footer className="border-t border-gray-800 bg-gray-950 py-8 md:py-12 mt-auto">
      <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between text-gray-400 text-sm">
        <div>
          <p>© {new Date().getFullYear()} BBJobs. Todos los derechos reservados.</p>
        </div>
        <div className="flex space-x-6 mt-4 md:mt-0">
          <a href="#" className="hover:text-white transition-colors">Términos</a>
          <a href="#" className="hover:text-white transition-colors">Privacidad</a>
          <a href="#" className="hover:text-white transition-colors">Contacto</a>
        </div>
      </div>
    </footer>
  );
}
