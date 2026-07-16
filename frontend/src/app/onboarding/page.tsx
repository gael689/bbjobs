"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import { api } from "@/lib/api";
import {
  EnvelopeIcon, UserIcon,
  BuildingOfficeIcon, PhoneIcon, IdentificationIcon,
  MapPinIcon, BriefcaseIcon, UsersIcon, ArrowLeftIcon,
} from "@heroicons/react/24/outline";
import Image from "next/image";
import Link from "next/link";

interface Industry { id: string; name: string; }

const ARGENTINA_PROVINCES = [
  "Buenos Aires", "Ciudad Autónoma de Buenos Aires", "Catamarca", "Chaco",
  "Chubut", "Córdoba", "Corrientes", "Entre Ríos", "Formosa", "Jujuy",
  "La Pampa", "La Rioja", "Mendoza", "Misiones", "Neuquén", "Río Negro",
  "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe",
  "Santiago del Estero", "Tierra del Fuego", "Tucumán",
];

function Input({ icon: Icon, ...props }: { icon: React.ElementType } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#1E8EA3] pointer-events-none" />
      <input
        {...props}
        className="w-full pl-11 pr-4 py-3 border border-[#DDE3EC] rounded-xl bg-[#FAFBFD] text-[#1C2230] focus:outline-none focus:ring-2 focus:ring-[#1E8EA3]/20 focus:border-[#1E8EA3] transition-all text-sm placeholder:text-[#94a3b8]"
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-bold text-[#1C2230] mb-1.5">{label}</label>
      {children}
    </div>
  );
}

interface ErrorDetail {
  code?: string;
  message: string;
}

function parseErrorDetail(err: unknown): ErrorDetail {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (Array.isArray(detail)) return { message: detail.map((e: { msg: string }) => e.msg).join(", ") };
  if (typeof detail === "string") return { message: detail };
  if (detail && typeof detail === "object" && "message" in detail) {
    const d = detail as { code?: string; message: string };
    return { code: d.code, message: d.message };
  }
  return { message: "Error al completar el registro." };
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  // El rol elegido en /register viaja como unsafeMetadata; el backend igual decide
  // el rol real al crear el User (ver plan §8) — esto sólo determina qué form mostrar.
  // Con Google (OAuth) el redirect de página completa a veces no reenvía unsafeMetadata,
  // así que si no vino, caemos al respaldo que /register guardó en localStorage antes
  // de salir hacia el proveedor — evita que todos los alta por Google terminen en candidato.
  const metaRole = user?.unsafeMetadata?.role;
  const [storedRole] = useState(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("bbjobs_signup_role");
  });
  const detectedRole: "candidate" | "company" =
    metaRole === "company" || metaRole === "candidate"
      ? metaRole
      : storedRole === "company"
      ? "company"
      : "candidate";
  // Red de seguridad manual: por si el detectado no coincide con lo que la persona
  // realmente quiso (ej. cambió de opinión, o ningún respaldo llegó bien).
  const [manualRole, setManualRole] = useState<"candidate" | "company" | null>(null);
  const role = manualRole ?? detectedRole;
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [industries, setIndustries] = useState<Industry[]>([]);

  // Si venimos de /register?next=... (ej. alguien nuevo quiso postularse sin cuenta),
  // volvemos ahí al terminar en vez de mandar siempre al dashboard.
  const [nextPath] = useState(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("next");
  });

  // Candidate fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  // Company fields
  const [legalName, setLegalName] = useState("");
  const [cuit, setCuit] = useState("");
  const [industryId, setIndustryId] = useState("");
  const [otherIndustry, setOtherIndustry] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");
  const [responsibleFirstName, setResponsibleFirstName] = useState("");
  const [responsibleLastName, setResponsibleLastName] = useState("");
  const [responsiblePosition, setResponsiblePosition] = useState("");
  const [responsiblePhone, setResponsiblePhone] = useState("");
  const [responsibleEmail, setResponsibleEmail] = useState("");

  // Si el onboarding ya se completó (ej. el usuario volvió a esta URL a mano), redirigir al panel.
  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    api.get("/me")
      .then(r => {
        if (r.data.onboarding_complete) {
          router.replace(nextPath || `/dashboard/${r.data.role}`);
        } else {
          setCheckingStatus(false);
        }
      })
      .catch(() => setCheckingStatus(false));
  }, [isLoaded, user, router, nextPath]);

  useEffect(() => {
    if (role === "company") {
      api.get("/catalogs/industries").then(r => setIndustries(r.data)).catch(() => {});
    }
  }, [role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    localStorage.removeItem("bbjobs_signup_role");
    try {
      if (role === "candidate") {
        const res = await api.post("/me/onboarding/candidate", {
          first_name: firstName,
          last_name: lastName,
          phone,
        });
        router.push(nextPath || `/dashboard/${res.data.role}`);
      } else {
        const selectedIndustry = industries.find(i => i.id === industryId);
        const isOtro = selectedIndustry?.name === "Otro";
        const res = await api.post("/me/onboarding/company", {
          legal_name: legalName,
          cuit: cuit.replace(/-/g, ""),
          industry_id: industryId,
          province: province || undefined,
          city: city || undefined,
          employee_count: employeeCount || undefined,
          responsible_full_name: `${responsibleFirstName} ${responsibleLastName}`.trim(),
          responsible_phone: responsiblePhone,
          responsible_email: responsibleEmail,
          responsible_position: responsiblePosition || undefined,
          ...(isOtro && otherIndustry ? { description: `Industria: ${otherIndustry}` } : {}),
        });
        router.push(nextPath || `/dashboard/${res.data.role}`);
      }
    } catch (err: unknown) {
      const { code, message } = parseErrorDetail(err);
      if (code === "email_collision") {
        // Identidad de Clerk huérfana (mismo email, método de login distinto al original).
        // No tiene sentido dejarla trabada en el form — cerramos la sesión y mandamos
        // a un login limpio con el motivo, en vez de mostrar un 409 crudo.
        await signOut({ redirectUrl: "/login?reason=email_collision" });
        return;
      }
      setError(message);
      setLoading(false);
    }
  };

  if (!isLoaded || checkingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#64748B] bg-mesh">
        Cargando...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-12 pb-12 bg-mesh relative">
      <Link
        href="/"
        className="fixed top-6 left-6 flex items-center justify-center w-11 h-11 rounded-full bg-white border border-[#DDE3EC] text-[#1C2230] hover:text-[#1E8EA3] shadow-sm transition-colors"
        aria-label="Volver al inicio"
        title="Volver al inicio"
      >
        <ArrowLeftIcon className="w-5 h-5" />
      </Link>
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-5">
            <Image src="/logo.png" alt="BBJobs" width={36} height={36} className="object-contain" />
            <span className="font-display font-extrabold italic text-2xl tracking-tight">
              <span className="text-[#1E8EA3]">BB</span><span className="text-[#1C2230]">JOBS</span>
            </span>
          </div>
          <h1 className="font-display font-bold text-3xl text-[#1C2230] mb-2">Un último paso</h1>
          <p className="text-[#64748B] text-sm">Completá tus datos para terminar de crear tu cuenta</p>
        </div>

        <div className="bg-white border border-[#DDE3EC] rounded-2xl p-8 shadow-sm">
          <div className="bg-[#E6F4F7] border border-[#9ED4DF] rounded-xl p-3.5 mb-3 text-sm text-[#1C2230] font-medium">
            {role === "candidate"
              ? "✓ Subí tu CV  ·  ✓ Postulate con un click  ·  ✓ Tu perfil es privado"
              : "✓ Publicá búsquedas  ·  ✓ Recibí postulaciones  ·  ✓ Empresa verificada por Talency"}
          </div>

          <button
            type="button"
            onClick={() => setManualRole(role === "candidate" ? "company" : "candidate")}
            className="text-xs font-bold text-[#1E8EA3] hover:underline mb-6 block"
          >
            {role === "candidate" ? "¿Sos una empresa? Cambiar a registro de empresa" : "¿Buscás trabajo? Cambiar a registro de candidato"}
          </button>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl mb-5 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* ── Candidato ── */}
            {role === "candidate" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nombre">
                    <Input icon={UserIcon} required placeholder="Juan" value={firstName} onChange={e => setFirstName(e.target.value)} />
                  </Field>
                  <Field label="Apellido">
                    <Input icon={UserIcon} required placeholder="Pérez" value={lastName} onChange={e => setLastName(e.target.value)} />
                  </Field>
                </div>
                <Field label="Teléfono">
                  <Input icon={PhoneIcon} required placeholder="2914 000000" value={phone} onChange={e => setPhone(e.target.value)} />
                </Field>
              </>
            )}

            {/* ── Empresa ── */}
            {role === "company" && (
              <>
                <Field label="Razón social">
                  <Input icon={BuildingOfficeIcon} required placeholder="Mi Empresa S.A." value={legalName} onChange={e => setLegalName(e.target.value)} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="CUIT / DNI">
                    <Input
                      icon={IdentificationIcon}
                      required
                      placeholder="20123456789"
                      value={cuit}
                      onChange={e => setCuit(e.target.value.replace(/[^\d-]/g, ""))}
                      title="CUIT o DNI, con o sin guiones"
                    />
                  </Field>
                  <Field label="Industria">
                    <select
                      required
                      value={industryId}
                      onChange={e => { setIndustryId(e.target.value); setOtherIndustry(""); }}
                      className="w-full px-4 py-3 border border-[#DDE3EC] rounded-xl bg-[#FAFBFD] text-sm text-[#1C2230] focus:outline-none focus:ring-2 focus:ring-[#1E8EA3]/20 focus:border-[#1E8EA3] transition-all"
                    >
                      <option value="">Seleccioná</option>
                      {industries.filter(i => i.name !== "Otro").map(i => (
                        <option key={i.id} value={i.id}>{i.name}</option>
                      ))}
                      {industries.find(i => i.name === "Otro") && (
                        <option value={industries.find(i => i.name === "Otro")!.id}>Otro</option>
                      )}
                    </select>
                  </Field>
                </div>
                {industries.find(i => i.id === industryId)?.name === "Otro" && (
                  <Field label="¿Cuál es tu rubro?">
                    <Input
                      icon={BuildingOfficeIcon}
                      required
                      placeholder="Ej: Estudio jurídico, Asociación civil..."
                      value={otherIndustry}
                      onChange={e => setOtherIndustry(e.target.value)}
                    />
                  </Field>
                )}

                {/* ── Ubicación ── */}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Provincia">
                    <div className="relative">
                      <MapPinIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#1E8EA3] pointer-events-none" />
                      <select
                        value={province}
                        onChange={e => setProvince(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 border border-[#DDE3EC] rounded-xl bg-[#FAFBFD] text-sm text-[#1C2230] focus:outline-none focus:ring-2 focus:ring-[#1E8EA3]/20 focus:border-[#1E8EA3] transition-all appearance-none"
                      >
                        <option value="">Seleccioná</option>
                        {ARGENTINA_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </Field>
                  <Field label="Localidad">
                    <Input icon={MapPinIcon} placeholder="Ej: Bahía Blanca" value={city} onChange={e => setCity(e.target.value)} />
                  </Field>
                </div>

                {/* ── Cantidad de empleados ── */}
                <Field label="Cantidad de empleados">
                  <div className="relative">
                    <UsersIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-[#1E8EA3] pointer-events-none" />
                    <select
                      value={employeeCount}
                      onChange={e => setEmployeeCount(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 border border-[#DDE3EC] rounded-xl bg-[#FAFBFD] text-sm text-[#1C2230] focus:outline-none focus:ring-2 focus:ring-[#1E8EA3]/20 focus:border-[#1E8EA3] transition-all appearance-none"
                    >
                      <option value="">Seleccioná</option>
                      <option value="0-10">De 0 a 10</option>
                      <option value="11-50">De 11 a 50</option>
                      <option value="51-100">De 51 a 100</option>
                      <option value="100+">Más de 100</option>
                    </select>
                  </div>
                </Field>

                {/* ── Responsable ── */}
                <div className="pt-1 border-t border-[#DDE3EC]" />
                <p className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Datos del responsable</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nombre">
                    <Input icon={UserIcon} required placeholder="María" value={responsibleFirstName} onChange={e => setResponsibleFirstName(e.target.value)} />
                  </Field>
                  <Field label="Apellido">
                    <Input icon={UserIcon} required placeholder="González" value={responsibleLastName} onChange={e => setResponsibleLastName(e.target.value)} />
                  </Field>
                </div>
                <Field label="Cargo en la empresa">
                  <Input icon={BriefcaseIcon} placeholder="Ej: Gerente, Dueño, Supervisor..." value={responsiblePosition} onChange={e => setResponsiblePosition(e.target.value)} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Teléfono de contacto">
                    <Input icon={PhoneIcon} required placeholder="2914 000000" value={responsiblePhone} onChange={e => setResponsiblePhone(e.target.value)} />
                  </Field>
                  <Field label="Email de contacto">
                    <Input icon={EnvelopeIcon} type="email" required placeholder="contacto@empresa.com" value={responsibleEmail} onChange={e => setResponsibleEmail(e.target.value)} />
                  </Field>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1E8EA3] hover:bg-[#187B8E] text-white font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50 mt-1"
            >
              {loading
                ? "Guardando..."
                : role === "company" ? "Crear cuenta de empresa" : "Terminar mi registro"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
