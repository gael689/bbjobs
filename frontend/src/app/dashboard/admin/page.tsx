"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminDashboardIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/admin/empresas");
  }, [router]);
  return null;
}
