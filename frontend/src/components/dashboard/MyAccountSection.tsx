"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";
import { api } from "@/lib/api";
import { ArrowsRightLeftIcon, TrashIcon } from "@heroicons/react/24/outline";
import { ROLE_LABEL, SIGNUP_ROLE_KEY, type SignupRole } from "@/components/auth/RoleChooser";

interface MyPreview {
  mode: "full" | "tombstone";
  counts: Record<string, number>;
  can_reset_role: boolean;
}

function errorMessage(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === "string" ? detail : fallback;
}

/** Trae el preview de borrado de la cuenta propia. `null` mientras carga o si falla. */
export function useMyAccountPreview() {
  const [preview, setPreview] = useState<MyPreview | null>(null);
  useEffect(() => {
    api.get("/me/account/deletion-preview").then(r => setPreview(r.data)).catch(() => {});
  }, []);
  return preview;
}

/**
 * "Me equivoqué de tipo de cuenta": borra el perfil (sólo si la cuenta está vacía, lo valida el
 * backend) y manda al onboarding con el otro rol, sin registrarse de nuevo ni verificar el mail
 * otra vez. Existe por el caso real que originó el pedido de Eugenia (23/09/2026): alguien que
 * se registró como empresa buscando trabajo.
 */
export function useResetRole(role: SignupRole) {
  const router = useRouter();
  const { user } = useUser();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const other: SignupRole = role === "company" ? "candidate" : "company";

  async function resetRole() {
    if (!confirm(`Tu cuenta de ${ROLE_LABEL[role]} se va a borrar y vas a completar tus datos como ${ROLE_LABEL[other]}. ¿Seguimos?`)) return;
    setBusy(true);
    setError("");
    try {
      await api.post("/me/account/reset-role");
      // El onboarding decide qué formulario mostrar por unsafeMetadata.role (y localStorage de
      // respaldo): sin esto volvería a mostrar el rol viejo.
      localStorage.setItem(SIGNUP_ROLE_KEY, other);
      await user?.update({ unsafeMetadata: { ...(user.unsafeMetadata ?? {}), role: other } }).catch(() => {});
      router.push("/onboarding");
    } catch (err) {
      setError(errorMessage(err, "No se pudo cambiar el tipo de cuenta. Probá de nuevo."));
      setBusy(false);
    }
  }

  return { resetRole, busy, error, other };
}

/** Aviso en el inicio del panel para cuentas recién creadas y sin actividad. Se puede cerrar. */
export function WrongRoleBanner({ role }: { role: SignupRole }) {
  const preview = useMyAccountPreview();
  const { resetRole, busy, error, other } = useResetRole(role);
  const storageKey = "bbjobs_wrong_role_banner_closed";
  const [closed, setClosed] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem(storageKey) === "1");

  if (closed || !preview?.can_reset_role) return null;

  return (
    <div className="flex items-start gap-3 bg-[#FAFBFD] border border-[#DDE3EC] rounded-2xl px-4 py-3 mb-6">
      <ArrowsRightLeftIcon className="w-5 h-5 text-[#1E8EA3] shrink-0 mt-0.5" />
      <div className="flex-1 text-sm text-[#1C2230]">
        {role === "company"
          ? "¿Buscás trabajo? Esta es una cuenta de empresa. Si te registraste así por error, podés pasarla a postulante."
          : "¿Querés publicar búsquedas? Esta es una cuenta de postulante. Si te registraste así por error, podés pasarla a empresa."}
        {error && <p className="text-red-600 mt-1">{error}</p>}
        <div className="flex gap-4 mt-2">
          <button onClick={resetRole} disabled={busy} className="font-bold text-[#1E8EA3] hover:underline disabled:opacity-60">
            {busy ? "Cambiando..." : `Cambiar a ${ROLE_LABEL[other]}`}
          </button>
          <button
            onClick={() => { localStorage.setItem(storageKey, "1"); setClosed(true); }}
            className="text-[#64748B] hover:underline"
          >
            No, está bien así
          </button>
        </div>
      </div>
    </div>
  );
}

/** Sección "Mi cuenta" al pie del perfil: cambiar de tipo (si está vacía) y eliminar la cuenta. */
export default function MyAccountSection({ role }: { role: SignupRole }) {
  const { signOut } = useClerk();
  const preview = useMyAccountPreview();
  const { resetRole, busy: resetting, error: resetError, other } = useResetRole(role);
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setDeleting(true);
    setError("");
    try {
      await api.delete("/me/account", { data: { confirm: confirmText } });
      await signOut({ redirectUrl: "/" });
    } catch (err) {
      setError(errorMessage(err, "No se pudo eliminar la cuenta. Probá de nuevo."));
      setDeleting(false);
    }
  }

  return (
    <section className="bg-white border border-[#DDE3EC] rounded-2xl p-6 mt-8">
      <h2 className="font-display font-bold text-lg text-[#1C2230] mb-4">Mi cuenta</h2>

      {preview?.can_reset_role && (
        <div className="pb-5 mb-5 border-b border-[#DDE3EC]">
          <p className="text-sm font-bold text-[#1C2230]">¿Te equivocaste de tipo de cuenta?</p>
          <p className="text-sm text-[#64748B] mb-3">
            Te registraste como {ROLE_LABEL[role]}. Podés pasar a {ROLE_LABEL[other]} sin volver a registrarte.
          </p>
          {resetError && <p className="text-sm text-red-600 mb-2">{resetError}</p>}
          <button
            onClick={resetRole}
            disabled={resetting}
            className="flex items-center gap-1.5 text-sm font-bold border border-[#9ED4DF] bg-[#E6F4F7] text-[#1E8EA3] px-4 py-2 rounded-xl hover:bg-[#D5EBF1] disabled:opacity-60"
          >
            <ArrowsRightLeftIcon className="w-4 h-4" />
            {resetting ? "Cambiando..." : `Cambiar a ${ROLE_LABEL[other]}`}
          </button>
        </div>
      )}

      <p className="text-sm font-bold text-[#1C2230]">Eliminar mi cuenta</p>
      <p className="text-sm text-[#64748B] mb-3">
        {role === "company"
          ? "Se borran los datos de tu empresa y se dan de baja tus búsquedas. Vas a poder registrarte de nuevo con el mismo mail."
          : "Se borran tu perfil, tu CV y tus datos. Vas a poder registrarte de nuevo con el mismo mail."}
      </p>

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-sm font-bold border border-red-200 text-red-600 px-4 py-2 rounded-xl hover:bg-red-50"
        >
          <TrashIcon className="w-4 h-4" />
          Eliminar mi cuenta
        </button>
      ) : (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <label className="block text-sm text-[#1C2230] mb-2">
            Esto no se puede deshacer. Para confirmar, escribí <strong>ELIMINAR</strong>:
          </label>
          <input
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            className="w-full border border-[#DDE3EC] rounded-xl px-4 py-2.5 text-sm mb-3 bg-white focus:outline-none focus:border-red-400"
            autoFocus
          />
          {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
          <div className="flex gap-3">
            <button
              onClick={() => { setOpen(false); setConfirmText(""); }}
              className="text-sm font-bold border border-[#DDE3EC] bg-white text-[#1C2230] px-4 py-2 rounded-xl"
            >
              Cancelar
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting || confirmText.trim().toUpperCase() !== "ELIMINAR"}
              className="text-sm font-bold bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl disabled:opacity-50"
            >
              {deleting ? "Eliminando..." : "Eliminar definitivamente"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
