// Bloque de las páginas legales (/terminos, /privacidad, /arrepentimiento).
export default function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display font-bold text-lg text-[#1C2230] mb-3 pb-2 border-b border-[#DDE3EC]">{title}</h2>
      <div className="text-sm text-[#64748B] leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export const linkClass = "text-[#1E8EA3] hover:underline";
