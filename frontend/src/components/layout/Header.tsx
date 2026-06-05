"use client";

import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { LogOut, User, Briefcase } from 'lucide-react';
import { api, setAccessToken } from '@/lib/api';

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
    <header className="sticky top-0 z-50 w-full border-b border-gray-800 bg-gray-950/80 backdrop-blur supports-[backdrop-filter]:bg-gray-950/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center space-x-2">
          <Briefcase className="h-6 w-6 text-blue-500" />
          <span className="text-xl font-bold text-white tracking-tight">BB<span className="text-blue-500">Jobs</span></span>
        </Link>

        <nav className="hidden md:flex items-center space-x-6 text-sm font-medium text-gray-300">
          <Link href="/jobs" className="hover:text-white transition-colors">Empleos</Link>
          <Link href="/companies" className="hover:text-white transition-colors">Empresas</Link>
        </nav>

        <div className="flex items-center space-x-4">
          {isAuthenticated ? (
            <div className="flex items-center space-x-4">
              <Link href={user?.role === 'company' ? '/dashboard/company' : '/dashboard/candidate'} className="text-sm font-medium text-gray-300 hover:text-white flex items-center space-x-1">
                <User className="h-4 w-4" />
                <span>Mi Panel</span>
              </Link>
              <button onClick={handleLogout} className="text-sm font-medium text-red-400 hover:text-red-300 flex items-center space-x-1">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-gray-300 hover:text-white transition-colors">
                Ingresar
              </Link>
              <Link href="/register" className="text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors">
                Regístrate
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
