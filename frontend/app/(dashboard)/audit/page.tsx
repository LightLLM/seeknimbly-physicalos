import type { Metadata } from "next";
import { AuditPage } from "@/components/pages/audit-page";

export const metadata: Metadata = { title: "Audit Trail" };

export default function Page() {
  return <AuditPage />;
}
