"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { agentHeaders } from "@/lib/agents/client";
import { RunView, type RunRecord } from "@/components/agents/run-view";

export default function AgentRunPage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const email = user?.email;
  const [state, setState] = useState<{ run: RunRecord; mine: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    fetch(`/api/agents/runs/${encodeURIComponent(params.id)}`, { headers: agentHeaders(email), cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !data.run) setError(data.error ?? `Could not load this run (HTTP ${res.status}).`);
        else setState({ run: data.run, mine: !!data.mine });
      })
      .catch(() => !cancelled && setError("Could not reach the server."));
    return () => {
      cancelled = true;
    };
  }, [email, params.id]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <Link href="/services" className="text-sm text-primary hover:underline">
        ← Add-on Service
      </Link>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {!error && !state && <p className="text-sm text-muted-foreground">Loading run record…</p>}
      {state && <RunView run={state.run} mine={state.mine} />}
    </div>
  );
}
