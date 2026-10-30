"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const CanvasLoading = () => <Skeleton className="h-full min-h-[320px] w-full" />;

// React Flow measures the DOM, so it is client-only.
export const FactoryFlow = dynamic(() => import("./factory-flow"), { ssr: false, loading: CanvasLoading });
export const WorkflowFlow = dynamic(() => import("./workflow-flow"), { ssr: false, loading: CanvasLoading });
