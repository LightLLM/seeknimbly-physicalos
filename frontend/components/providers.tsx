"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "sonner";
import { SearchProvider } from "@/components/shell/search-context";
import { DemoFlowProvider } from "@/components/demo/demo-flow";
import { ApiError } from "@/lib/api/client";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => !(error instanceof ApiError && (error.network || error.status < 500)) && failureCount < 1,
      },
    },
  });
}

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster theme={resolvedTheme === "light" ? "light" : "dark"} position="bottom-right" richColors closeButton />;
}

/** Data + UI providers shared by the app and by tests (minus theme/toaster). */
export function DataProviders({ client, children }: { client: QueryClient; children: React.ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <SearchProvider>
        <DemoFlowProvider>{children}</DemoFlowProvider>
      </SearchProvider>
    </QueryClientProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(makeQueryClient);
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <DataProviders client={client}>
        {children}
        <ThemedToaster />
      </DataProviders>
    </ThemeProvider>
  );
}
