import type { Metadata } from "next";
import { FactoryPage } from "@/components/pages/factory-page";

export const metadata: Metadata = { title: "Factory Floor" };

export default function Page() {
  return <FactoryPage />;
}
