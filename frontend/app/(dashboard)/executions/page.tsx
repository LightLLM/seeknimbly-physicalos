import type { Metadata } from "next";
import { ExecutionsPage } from "@/components/pages/executions-page";

export const metadata: Metadata = { title: "Executions" };

export default function Page() {
  return <ExecutionsPage />;
}
