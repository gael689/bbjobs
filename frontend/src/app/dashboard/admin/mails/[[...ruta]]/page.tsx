"use client";

import { useParams } from "next/navigation";
import MailsAdmin, { type Pestana } from "../MailsAdmin";

const PESTANAS: Pestana[] = ["enviados", "casillas", "salud"];

/** /mails → Respuestas; /mails/enviados, /mails/casillas, /mails/salud. */
export default function MailsAdminPage() {
  const { ruta } = useParams<{ ruta?: string[] }>();
  const p = ruta?.[0];
  const pestana: Pestana = PESTANAS.includes(p as Pestana) ? (p as Pestana) : "respuestas";
  return <MailsAdmin key={pestana} inicial={pestana} />;
}
