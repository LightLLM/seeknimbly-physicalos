"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { SIDEBAR_STORAGE_KEY } from "@/lib/config";
import { useLocalStorage } from "@/lib/use-local-storage";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsedValue, setCollapsed] = useLocalStorage(SIDEBAR_STORAGE_KEY, "0");
  const collapsed = collapsedValue === "1";
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();
  return (
    <div className="flex h-screen overflow-hidden">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-1.5 focus:text-primary-fg">
        Skip to content
      </a>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(collapsed ? "0" : "1")} className="hidden lg:flex" />

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <Sidebar collapsed={false} mobile onNavigate={() => setMobileOpen(false)} className="relative z-10 shadow-2xl" />
          <button type="button" aria-label="Close navigation" className="flex-1 bg-black/50" onClick={() => setMobileOpen(false)} />
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenMobileNav={() => setMobileOpen(true)} />
        <main id="main" className="flex-1 overflow-y-auto">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="mx-auto w-full max-w-[1500px] p-4 md:p-6"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
