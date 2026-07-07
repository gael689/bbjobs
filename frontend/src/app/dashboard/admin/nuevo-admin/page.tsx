"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { UserPlusIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";

export default function AdminNuevoAdminPage() {
  const [adminForm, setAdminForm] = useState({ email: "", password: "", full_name: "" });
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  function toast(text: string, type: "success" | "error" = "success") {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  }

  async function handleCreateAdmin(e: React.FormEvent) {
    e.preventDefault();
    setCreatingAdmin(true);
    try {
      await api.post("/admin/users", adminForm);
      toast("Administrador creado");
      setAdminForm({ email: "", password: "", full_name: "" });
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast(detail || "Error al crear admin", "error");
    } finally {
      setCreatingAdmin(false);
    }
  }

  return (
    <div className="px-4 sm:px-6 py-8 max-w-md">
      {toastMsg && (
        <div className={`fixed top-6 right-6 z-50 border shadow-lg rounded-xl px-5 py-3 text-sm font-medium flex items-center gap-2 ${
          toastMsg.type === "error" ? "bg-red-50 border-red-200 text-red-800" : "bg-white border-[#9ED4DF] text-[#1C2230]"
        }`}>
          {toastMsg.type === "error"
            ? <XCircleIcon className="w-4 h-4 text-red-500 shrink-0" />
            : <CheckCircleIcon className="w-4 h-4 text-[#1E8EA3] shrink-0" />}
          {toastMsg.text}
        </div>
      )}

      <div className="flex items-center gap-2 mb-6">
        <UserPlusIcon className="w-6 h-6 text-[#1E8EA3]" />
        <h1 className="font-display font-bold text-2xl text-[#1C2230]">Crear administrador</h1>
      </div>
      <form onSubmit={handleCreateAdmin} className="bg-white border border-[#DDE3EC] rounded-2xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-bold text-[#1C2230] mb-1.5">Nombre completo *</label>
          <input
            required
            value={adminForm.full_name}
            onChange={e => setAdminForm(f => ({ ...f, full_name: e.target.value }))}
            className="w-full border border-[#DDE3EC] rounded-xl px-4 py-2.5 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] transition-colors"
            placeholder="Juan Pérez"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-[#1C2230] mb-1.5">Email *</label>
          <input
            required
            type="email"
            value={adminForm.email}
            onChange={e => setAdminForm(f => ({ ...f, email: e.target.value }))}
            className="w-full border border-[#DDE3EC] rounded-xl px-4 py-2.5 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] transition-colors"
            placeholder="admin@talency.com.ar"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-[#1C2230] mb-1.5">Contraseña *</label>
          <input
            required
            type="password"
            minLength={8}
            value={adminForm.password}
            onChange={e => setAdminForm(f => ({ ...f, password: e.target.value }))}
            className="w-full border border-[#DDE3EC] rounded-xl px-4 py-2.5 text-sm text-[#1C2230] focus:outline-none focus:border-[#1E8EA3] transition-colors"
            placeholder="Mínimo 8 caracteres"
          />
        </div>
        <button
          type="submit"
          disabled={creatingAdmin}
          className="w-full bg-[#1E8EA3] hover:bg-[#187B8E] disabled:opacity-60 text-white font-bold rounded-xl py-3 text-sm transition-colors"
        >
          {creatingAdmin ? "Creando..." : "Crear administrador"}
        </button>
      </form>
    </div>
  );
}
