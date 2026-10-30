import type { Metadata } from "next";
import { WorkOrdersPage } from "@/components/pages/work-orders-page";

export const metadata: Metadata = { title: "Work Orders" };

export default function Page() {
  return <WorkOrdersPage />;
}
