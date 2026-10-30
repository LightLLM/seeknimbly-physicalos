import type { Metadata } from "next";
import { CommandCenter } from "@/components/demo/command-center";

export const metadata: Metadata = { title: "Factory Operations" };

export default function Page() {
  return <CommandCenter />;
}
