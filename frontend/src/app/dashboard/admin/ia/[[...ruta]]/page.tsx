"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import CentroIa, { type GrupoAgentes, type Pestana } from "../CentroIa";

const PESTANAS: Pestana[] = ["agentes", "recomendados", "actividad", "acciones"];
const GRUPOS: GrupoAgentes[] = ["recomendaciones", "prospeccion", "asistentes"];

/** /ia → Panorama; /ia/<pestaña>; /ia/agentes/<grupo>; /ia/recomendados?busqueda=<id>. */
function Ruta() {
  const { ruta } = useParams<{ ruta?: string[] }>();
  const busqueda = useSearchParams().get("busqueda");
  const [p, g] = ruta ?? [];
  const pestana: Pestana = PESTANAS.includes(p as Pestana) ? (p as Pestana) : "panorama";
  const grupo = pestana === "agentes" && GRUPOS.includes(g as GrupoAgentes) ? (g as GrupoAgentes) : null;
  // La clave hace que entrar a otra dirección desde el menú arranque la pantalla de cero.
  return <CentroIa key={(ruta ?? []).join("/")} inicial={pestana} grupo={grupo} job={busqueda} />;
}

export default function CentroIaPage() {
  return <Suspense><Ruta /></Suspense>;
}
