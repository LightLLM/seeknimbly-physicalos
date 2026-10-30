import type { Metadata } from "next";
import { OrchestrationPage } from "@/components/pages/orchestration-page";

export const metadata: Metadata = { title: "Orchestration" };

export default function Page() {
  return <OrchestrationPage />;
}
