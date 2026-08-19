"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";

/**
 * El CTA de una tarjeta de /planes.
 *
 * /planes es una página pública que leen dos personas distintas: alguien que todavía no tiene
 * cuenta (va a registrarse) y una empresa que ya la tiene (quiere ir a la pantalla). Mandar a
 * las dos al mismo lado deja a una de ellas dando vueltas — una empresa logueada que aprieta
 * "Acceder a la base" y cae en el registro no entiende qué pasó.
 *
 * Mientras Clerk carga se muestra el destino de visitante: es el caso más común en una página
 * pública, y si resulta que hay sesión el link se corrige antes de que nadie alcance a hacer clic.
 */
export default function CtaPlan({
  href,
  hrefLogueado,
  children,
  className,
}: {
  href: string;
  hrefLogueado?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const destino = hrefLogueado && isLoaded && isSignedIn ? hrefLogueado : href;

  return (
    <Link href={destino} className={className}>
      {children}
    </Link>
  );
}
