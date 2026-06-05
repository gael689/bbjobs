"use client";

import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { api, setAccessToken } from '@/lib/api';
import { ArrowRightOnRectangleIcon, UserIcon, BriefcaseIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';

export default function Header() {
  const { user, isAuthenticated, logout } = useAuthStore();

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      console.error(e);
    } finally {
      setAccessToken(null);
      logout();
      window.location.href = '/';
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-800/50 bg-[#0a0a0c]/80 backdrop-blur-md supports-[backdrop-filter]:bg-[#0a0a0c]/60">
      <div className="container mx-auto flex h-20 items-center justify-between px-6">
        <Link href="/" className="flex items-center space-x-3 group">
          <motion.div 
            whileHover={{ rotate: 15, scale: 1.1 }}
            className="p-2 bg-[#00f0ff]/10 rounded-xl"
          >
            <BriefcaseIcon className="h-6 w-6 text-[#00f0ff]" />
          </motion.div>
          <span className="text-2xl font-display font-extrabold tracking-tight text-white drop-shadow-sm">
            BB<span className="text-[#00f0ff]">Jobs</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center space-x-8 text-sm font-medium">
          <Link href="/jobs" className="text-gray-400 hover:text-white transition-colors relative group">
            <span>Explorar</span>
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#00f0ff] transition-all group-hover:w-full"></span>
          </Link>
          <Link href="/companies" className="text-gray-400 hover:text-white transition-colors relative group">
            <span>Empresas</span>
            <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#00f0ff] transition-all group-hover:w-full"></span>
          </Link>
        </nav>

        <div className="flex items-center space-x-6">
          {isAuthenticated ? (
            <div className="flex items-center space-x-6">
              <Link 
                href={user?.role === 'company' ? '/dashboard/company' : '/dashboard/candidate'} 
                className="text-sm font-medium text-gray-300 hover:text-white flex items-center space-x-2 transition-colors"
              >
                <div className="p-1.5 bg-gray-800 rounded-lg group-hover:bg-gray-700">
                  <UserIcon className="h-4 w-4 text-gray-400" />
                </div>
                <span>Portal</span>
              </Link>
              <button 
                onClick={handleLogout} 
                className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                title="Cerrar sesión"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
                Ingresar
              </Link>
              <Link href="/register" className="relative inline-flex h-10 items-center justify-center overflow-hidden rounded-xl bg-gray-900 px-6 font-medium text-white transition-all hover:bg-gray-800 border border-gray-800 hover:border-[#00f0ff]/50">
                <span className="absolute inset-0 bg-gradient-to-r from-[#00f0ff]/0 via-[#00f0ff]/10 to-[#00f0ff]/0 opacity-0 hover:opacity-100 transition-opacity"></span>
                <span className="relative">Registro VIP</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
