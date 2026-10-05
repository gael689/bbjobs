import type { Metadata } from "next";

// Página privada para Eugenia: ni buscadores ni previews.
export const metadata: Metadata = {
  title: "Vista previa · BBJobs",
  robots: { index: false, follow: false, nocache: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
