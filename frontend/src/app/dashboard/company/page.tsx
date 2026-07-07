"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CompanyDashboardIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/company/perfil");
  }, [router]);
  return null;
}
