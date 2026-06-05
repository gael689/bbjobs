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
    const t = searchParams.get("type");
    if (t === "company" || t === "candidate") setRole(t);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post(role === "company" ? "/auth/register/company" : "/auth/register/candidate", { email, password });
      const formData = new FormData();
      formData.append("username", email);
      formData.append("password", password);
      const res = await api.post("/auth/login", formData, { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
      setAccessToken(res.data.access_token);
      const userRes = await api.get("/auth/me");
      login(userRes.data, res.data.access_token);
      router.push(userRes.data.role === "company" ? "/dashboard/company" : "/dashboard/candidate");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Error en el registro.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-72px)] flex items-center justify-center px-4 bg-mesh">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-6">
            <Image src="/logo.png" alt="BBJobs" width={40} height={40} className="object-contain" />
            <span className="font-display font-bold text-2xl tracking-tight">
              <span className="text-[#1E8EA3]">BB</span><span className="text-[#1C2230]">JOBS</span>
            </span>
          </div>
          <h1 className="font-display font-bold text-3xl text-[#1C2230] mb-2">Creá tu cuenta</h1>
          <p className="text-[#64748B]">Elegí cómo querés usar BBJobs</p>
        </div>

        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-8 shadow-sm">
          {/* Toggle */}
          <div className="flex bg-[#FAFBFD] border border-[#DDE3EC] rounded-xl p-1.5 mb-6">
            {(["candidate", "company"] as const).map(r => (
              <button key={r} type="button" onClick={() => setRole(r)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all ${
                  role === r ? "bg-white text-[#1E8EA3] shadow-sm border border-[#DDE3EC]" : "text-[#64748B] hover:text-[#1C2230]"
                }`}
              >
                {r === "candidate" ? <><UserIcon className="w-4 h-4" />Candidato</> : <><BuildingOfficeIcon className="w-4 h-4" />Empresa</>}
              </button>
            ))}
          </div>

          {/* Info contextual */}
          <div className="bg-[#E6F4F7] border border-[#9ED4DF] rounded-xl p-3.5 mb-6 text-sm text-[#1C2230] font-medium">
            {role === "candidate"
              ? "✓ Subí tu CV  ·  ✓ Postulate con un click  ·  ✓ Tu perfil es privado"
              : "✓ Publicá búsquedas  ·  ✓ Recibí postulaciones  ·  ✓ Empresa verificada por Talency"}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl mb-6 text-center font-medium">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-[#1C2230] mb-2">Correo electrónico</label>
              <div className="relative">
                <EnvelopeIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#1E8EA3]" />
                <input type="email" required placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 border border-[#DDE3EC] rounded-xl bg-[#FAFBFD] text-[#1C2230] focus:outline-none focus:ring-2 focus:ring-[#1E8EA3]/20 focus:border-[#1E8EA3] transition-all text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-[#1C2230] mb-2">Contraseña</label>
              <div className="relative">
                <LockClosedIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#1E8EA3]" />
                <input type="password" required minLength={8} placeholder="Mínimo 8 caracteres" value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 border border-[#DDE3EC] rounded-xl bg-[#FAFBFD] text-[#1C2230] focus:outline-none focus:ring-2 focus:ring-[#1E8EA3]/20 focus:border-[#1E8EA3] transition-all text-sm" />
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-[#1E8EA3] hover:bg-[#187B8E] text-white font-bold py-4 rounded-xl transition-colors disabled:opacity-50 mt-2">
              {loading ? "Registrando..." : role === "company" ? "Crear cuenta de empresa" : "Crear mi cuenta gratis"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-[#64748B] mt-6">
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="text-[#1E8EA3] font-bold hover:underline">Iniciá sesión</Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-[#64748B]">Cargando...</div>}>
      <RegisterForm />
    </Suspense>
  );
}
