"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CandidateDashboardIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/candidate/empleos");
  }, [router]);
  return null;
}
