import type { Metadata } from "next";
import { WorkforcePage } from "@/components/pages/workforce-page";

export const metadata: Metadata = { title: "Workforce" };

export default function Page() {
  return <WorkforcePage />;
}
