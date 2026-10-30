import type { Metadata } from "next";
import { RobotsPage } from "@/components/pages/robots-page";

export const metadata: Metadata = { title: "Robots" };

export default function Page() {
  return <RobotsPage />;
}
