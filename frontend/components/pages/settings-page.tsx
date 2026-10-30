"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, FlaskConical, KeyRound, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Json, Mono } from "@/components/ui/mono";
import { PageHeader } from "@/components/ui/page-header";
import { useDemoFlow } from "@/components/demo/demo-flow";
import { describeError } from "@/lib/api/client";
import { useFactoryState, useHealth, useInferenceTest, useResetDemo } from "@/lib/api/hooks";
import { API_BASE_URL, APP_ENV, DEMO_TOKEN_STORAGE_KEY } from "@/lib/config";
import { resolveNebius } from "@/lib/normalize";
import { useLocalStorage } from "@/lib/use-local-storage";

const tokenSchema = z.object({ token: z.string().trim().min(1, "Paste the token provided by your backend operator") });
type TokenForm = z.infer<typeof tokenSchema>;

function mask(token: string) {
  return token.length <= 4 ? "••••" : `••••${token.slice(-4)}`;
}

export function SettingsPage() {
  const [token, setToken] = useLocalStorage(DEMO_TOKEN_STORAGE_KEY, "");
  const [reveal, setReveal] = React.useState(false);
  const form = useForm<TokenForm>({ resolver: zodResolver(tokenSchema), defaultValues: { token: "" } });
  const { theme, setTheme } = useTheme();
  const health = useHealth();
  const state = useFactoryState();
  const nebius = resolveNebius(health.data, state.data, health.isError);
  const inference = useInferenceTest();
  const reset = useResetDemo();
  const flow = useDemoFlow();
  const [confirmReset, setConfirmReset] = React.useState(false);

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" description="Connection, credentials and appearance for this browser. Nothing here is sent to any host other than your configured API." />

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Demo Admin Token" description="Sent as X-Demo-Admin-Token on mutating requests" action={token ? <Badge tone="green" dot>Saved {mask(token)}</Badge> : <Badge tone="amber" dot>Not set</Badge>} />
          <CardBody>
            <form
              className="space-y-3"
              noValidate
              onSubmit={form.handleSubmit((v) => {
                setToken(v.token.trim());
                form.reset({ token: "" });
                toast.success("Demo token saved in this browser");
              })}
            >
              <div>
                <Label htmlFor="token">Token</Label>
                <div className="relative">
                  <Input id="token" type={reveal ? "text" : "password"} autoComplete="off" spellCheck={false} placeholder="Paste DEMO_ADMIN_TOKEN" className="pr-10" aria-invalid={!!form.formState.errors.token} {...form.register("token")} />
                  <button type="button" aria-label={reveal ? "Hide token" : "Show token"} onClick={() => setReveal((r) => !r)} className="absolute right-2.5 top-2.5 text-muted hover:text-fg">
                    {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {form.formState.errors.token ? <p className="mt-1 text-xs text-red">{form.formState.errors.token.message}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="primary">
                  <KeyRound className="h-4 w-4" /> Save token
                </Button>
                <Button
                  disabled={!token}
                  onClick={() => {
                    setToken(null);
                    toast.message("Demo token removed");
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Clear
                </Button>
              </div>
              <p className="text-xs leading-5 text-muted">
                Stored in <Mono>localStorage</Mono> only — it is never bundled into the app or exposed via <Mono>NEXT_PUBLIC_*</Mono> variables. Clear it on shared machines.
              </p>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Connection" description="Where this console sends requests" />
          <CardBody className="space-y-3 text-sm">
            <dl className="divide-y divide-line/60">
              <div className="flex justify-between py-2"><dt className="text-muted">API base URL</dt><dd><Mono className="text-sm">{API_BASE_URL}</Mono></dd></div>
              <div className="flex justify-between py-2"><dt className="text-muted">Environment</dt><dd><Mono className="text-sm">{APP_ENV}</Mono></dd></div>
              <div className="flex justify-between py-2">
                <dt className="text-muted">Backend health</dt>
                <dd>{health.isLoading ? <Badge>checking</Badge> : health.isError ? <Badge tone="red" dot>unreachable</Badge> : <Badge tone="green" dot>{health.data?.status ?? "ok"}</Badge>}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-muted">Nebius</dt>
                <dd><Badge tone={nebius.tone} dot>{nebius.label}</Badge></dd>
              </div>
            </dl>
            <p className="text-xs leading-5 text-muted">{nebius.detail}</p>
            <Button size="sm" onClick={() => { void health.refetch(); void state.refetch(); }}>
              Re-check connection
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Inference check" description="Calls the backend, which calls Nebius. Only a verified response is reported as success." />
          <CardBody className="space-y-3">
            <Button loading={inference.isPending} onClick={() => inference.mutate(undefined, { onError: (e) => toast.error("Inference check failed", { description: describeError(e) }) })}>
              <FlaskConical className="h-4 w-4" /> Run inference test
            </Button>
            {inference.isSuccess ? (
              inference.data.verified === true ? (
                <div className="space-y-2">
                  <Badge tone="green" dot>Verified by backend</Badge>
                  <Json value={inference.data} />
                </div>
              ) : (
                <div className="space-y-2">
                  <Badge tone="amber" dot>Backend did not confirm verification</Badge>
                  <Json value={inference.data} />
                </div>
              )
            ) : null}
            {inference.isError ? <p className="text-sm text-red" role="alert">{describeError(inference.error)}</p> : null}
            {!inference.isSuccess && !inference.isError ? <p className="text-xs text-muted">Not run in this session.</p> : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Appearance" description="Applies to this browser" />
          <CardBody className="flex gap-2">
            {(["dark", "light"] as const).map((t) => (
              <Button key={t} variant={theme === t ? "primary" : "secondary"} onClick={() => setTheme(t)} aria-pressed={theme === t} className="capitalize">
                {t}
              </Button>
            ))}
          </CardBody>
        </Card>

        <Card className="xl:col-span-2 border-red/30">
          <CardHeader title="Reset demo data" description="Clears proposals, audit entries, executions and events on the backend (requires the Demo Admin Token)." />
          <CardBody className="flex flex-wrap items-center gap-3">
            {confirmReset ? (
              <>
                <span className="text-sm">This cannot be undone. Continue?</span>
                <Button
                  variant="danger"
                  loading={reset.isPending}
                  onClick={() =>
                    reset.mutate(undefined, {
                      onSuccess: () => {
                        flow.resetFlow();
                        setConfirmReset(false);
                        toast.success("Demo data reset");
                      },
                      onError: (e) => toast.error("Reset failed", { description: describeError(e) }),
                    })
                  }
                >
                  <RotateCcw className="h-4 w-4" /> Yes, reset
                </Button>
                <Button variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</Button>
              </>
            ) : (
              <Button variant="danger" onClick={() => setConfirmReset(true)}>
                <RotateCcw className="h-4 w-4" /> Reset demo…
              </Button>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
