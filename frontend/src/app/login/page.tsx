"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, setAccessToken } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { LockClosedIcon, EnvelopeIcon } from "@heroicons/react/24/outline";
import Image from "next/image";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("username", email);
      formData.append("password", password);
      const res = await api.post("/auth/login", formData, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      setAccessToken(res.data.access_token);
      const userRes = await api.get("/auth/me");
      login(userRes.data, res.data.access_token);
      router.push(userRes.data.role === "company" ? "/dashboard/company" : "/dashboard/candidate");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Credenciales incorrectas.");
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
          <h1 className="font-display font-bold text-3xl text-[#1C2230] mb-2">Bienvenido de vuelta</h1>
          <p className="text-[#64748B]">Ingresá a tu cuenta para continuar</p>
        </div>

        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-8 shadow-sm">
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl mb-6 text-center font-medium">
              {error}
            </div>
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
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-bold text-[#1C2230]">Contraseña</label>
                <a href="#" className="text-xs text-[#1E8EA3] hover:underline font-medium">¿Olvidaste la contraseña?</a>
              </div>
              <div className="relative">
                <LockClosedIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#1E8EA3]" />
                <input type="password" required placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 border border-[#DDE3EC] rounded-xl bg-[#FAFBFD] text-[#1C2230] focus:outline-none focus:ring-2 focus:ring-[#1E8EA3]/20 focus:border-[#1E8EA3] transition-all text-sm" />
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-[#1E8EA3] hover:bg-[#187B8E] text-white font-bold py-4 rounded-xl transition-colors disabled:opacity-50 mt-2">
              {loading ? "Ingresando..." : "Iniciar sesión"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-[#64748B] mt-6">
          ¿No tenés cuenta?{" "}
          <Link href="/register?type=candidate" className="text-[#1E8EA3] font-bold hover:underline">Registrate gratis</Link>
        </p>
      </div>
    </div>
  );
}
