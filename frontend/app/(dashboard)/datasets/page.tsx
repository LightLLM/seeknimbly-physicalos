import type { Metadata } from "next";
import { DatasetsPage } from "@/components/pages/datasets-page";

export const metadata: Metadata = { title: "Datasets" };

export default function Page() {
  return <DatasetsPage />;
}
