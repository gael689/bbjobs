"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, setAccessToken } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { LockClosedIcon, EnvelopeIcon, UserIcon, BuildingOfficeIcon } from "@heroicons/react/24/outline";
import Image from "next/image";
import Link from "next/link";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuthStore();
  const [role, setRole] = useState<"candidate" | "company">("candidate");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const type = searchParams.get("type");
    if (type === "company" || type === "candidate") setRole(type);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = role === "company" ? "/auth/register/company" : "/auth/register/candidate";
      await api.post(endpoint, { email, password });
      const formData = new FormData();
      formData.append("username", email);
      formData.append("password", password);
      const res = await api.post("/auth/login", formData, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      const { access_token } = res.data;
      setAccessToken(access_token);
      const userRes = await api.get("/auth/me");
      login(userRes.data, access_token);
      router.push(userRes.data.role === "company" ? "/dashboard/company" : "/dashboard/candidate");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Error en el registro.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 bg-gradient-to-br from-[#fce4f3] via-[#fdf6fb] to-white">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-6">
            <Image src="/logo.png" alt="BBJobs" width={40} height={40} className="object-contain" />
            <span className="text-2xl font-display font-extrabold">
              <span className="text-[#e91e8c]">BB</span><span className="text-[#1a1a2e]">JOBS</span>
            </span>
          </div>
          <h1 className="text-3xl font-display font-bold text-[#1a1a2e] mb-2">Creá tu cuenta</h1>
          <p className="text-[#6b7280]">Elegí cómo querés usar BBJobs</p>
        </div>

        <div className="bg-white border border-[#f0d4e8] rounded-3xl p-8 shadow-sm">
          {/* Toggle candidato / empresa */}
          <div className="flex bg-[#fdf6fb] border border-[#f0d4e8] rounded-2xl p-1.5 mb-6">
            <button
              type="button"
              onClick={() => setRole("candidate")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl transition-all ${
                role === "candidate"
                  ? "bg-white text-[#e91e8c] shadow-sm border border-[#f0d4e8]"
                  : "text-[#6b7280] hover:text-[#1a1a2e]"
              }`}
            >
              <UserIcon className="w-4 h-4" />
              Soy Candidato
            </button>
            <button
              type="button"
              onClick={() => setRole("company")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl transition-all ${
                role === "company"
                  ? "bg-white text-[#e91e8c] shadow-sm border border-[#f0d4e8]"
                  : "text-[#6b7280] hover:text-[#1a1a2e]"
              }`}
            >
              <BuildingOfficeIcon className="w-4 h-4" />
              Soy Empresa
            </button>
          </div>

          {/* Descripción contextual */}
          <div className="bg-[#fce4f3] border border-[#f0d4e8] rounded-xl p-3.5 mb-6 text-sm text-[#1a1a2e]">
            {role === "candidate"
              ? "✓ Subí tu CV · ✓ Postulate con un click · ✓ Tu perfil es privado"
              : "✓ Publicá búsquedas · ✓ Recibí postulaciones · ✓ Empresa verificada por Talency"}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl mb-6 text-center font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-[#1a1a2e] mb-2">Correo electrónico</label>
              <div className="relative">
                <EnvelopeIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#e91e8c]" />
                <input
                  type="email"
                  required
                  placeholder="tu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 border border-[#f0d4e8] rounded-xl bg-[#fdf6fb] text-[#1a1a2e] focus:outline-none focus:ring-2 focus:ring-[#e91e8c]/20 focus:border-[#e91e8c] transition-all text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-[#1a1a2e] mb-2">Contraseña</label>
              <div className="relative">
                <LockClosedIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#e91e8c]" />
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 border border-[#f0d4e8] rounded-xl bg-[#fdf6fb] text-[#1a1a2e] focus:outline-none focus:ring-2 focus:ring-[#e91e8c]/20 focus:border-[#e91e8c] transition-all text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#e91e8c] hover:bg-[#c4177a] text-white font-bold py-4 rounded-xl transition-colors disabled:opacity-50 mt-2"
            >
              {loading ? "Registrando..." : role === "company" ? "Crear cuenta de empresa" : "Crear mi cuenta gratis"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-[#6b7280] mt-6">
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="text-[#e91e8c] font-bold hover:underline">
            Iniciá sesión
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-[#6b7280]">Cargando...</div>}>
      <RegisterForm />
    </Suspense>
  );
}
