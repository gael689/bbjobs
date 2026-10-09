import Link from "next/link";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import JsonLd from "./JsonLd";
import { breadcrumbSchema, type Miga } from "@/lib/seo/schema";

// Migas visibles + su BreadcrumbList. La última miga es la página actual (sin link).
export default function Migas({ migas, className = "" }: { migas: Miga[]; className?: string }) {
  return (
    <>
      <JsonLd data={breadcrumbSchema(migas)} />
      <nav aria-label="Migas de pan" className={`text-sm text-[#64748B] ${className}`}>
        <ol className="flex flex-wrap items-center gap-1">
          {migas.map((m, i) => {
            const ultima = i === migas.length - 1;
            return (
              <li key={m.path} className="flex items-center gap-1 min-w-0">
                {ultima ? (
                  <span aria-current="page" className="font-medium text-[#1C2230] truncate max-w-[16rem] sm:max-w-md">
                    {m.nombre}
                  </span>
                ) : (
                  <>
                    <Link href={m.path} className="font-medium hover:text-[#1E8EA3] transition-colors">
                      {m.nombre}
                    </Link>
                    <ChevronRightIcon className="w-3.5 h-3.5 shrink-0" aria-hidden />
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
