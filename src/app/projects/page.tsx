import Link from "next/link";
import "@/styles/vault.css";
import { DemoDataNotice } from "@/components/data-provenance";
import { Badge } from "@/components/projects/vault-ui";
import { DEMO_PROJECTS } from "@/data/projects-demo";

export const metadata = { title: "Projects · SmartDrugDiscovery" };

export default function ProjectsPage() {
  return (
    <div className="vault">
      <div className="vx-topbar">
        <span className="vx-topbar-title">Projects</span>
        <span className="vx-divider" aria-hidden />
        <span className="vx-topbar-sub">Campaign workspaces backed by each team&apos;s Box folder</span>
      </div>
      <div className="vx-wrap space-y-5">
        <DemoDataNotice />
        <div>
          <h1 className="vx-h1">Campaigns</h1>
          <p className="vx-lede">
            Each project keeps its files in its Box folder. Developers and their agents push each iteration here; the team
            reviews decision sheets, rounds and property reports, and releases chosen artifacts to smartdrugdiscovery.org.
            The two campaigns below are invented examples that show the layout.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {DEMO_PROJECTS.map((p) => {
            const go = p.compounds.filter((c) => c.flag === "GO").length;
            return (
              <Link key={p.slug} href={`/projects/${p.slug}`} className="vx-card">
                <div className="vx-card-stripe" style={{ background: p.color }} />
                <div style={{ padding: "14px 16px" }} className="space-y-2">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                    <strong style={{ fontSize: 14.5 }}>{p.title}</strong>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    <Badge>{p.modality}</Badge>
                    <Badge>{p.target}</Badge>
                    <Badge tone={p.visibility === "team" ? "accent" : "plain"}>{p.visibility}</Badge>
                  </div>
                  <p className="vx-muted" style={{ fontSize: 12.5 }}>{p.description}</p>
                  <p className="vx-faint" style={{ fontSize: 11.5 }}>Updated {p.updated} · {p.members.length} members</p>
                </div>
                <div className="vx-mini">
                  <div><strong>{p.iterations.length}</strong><span>iterations</span></div>
                  <div><strong>{p.artifacts.length}</strong><span>artifacts</span></div>
                  <div><strong>{p.rounds.length || "—"}</strong><span>rounds</span></div>
                  <div><strong>{p.compounds.length ? go : "—"}</strong><span>GO</span></div>
                </div>
              </Link>
            );
          })}
        </div>

        <section className="vx-panel">
          <div className="vx-panel-h"><span>For developers</span></div>
          <div className="vx-panel-b space-y-2" style={{ fontSize: 12.5 }}>
            <p>
              Agents that produce project results follow the{" "}
              <a href="https://github.com/aimed-lab/sdd-studio/blob/main/skills/sdd-studio-push/SKILL.md" target="_blank" rel="noreferrer">
                sdd-studio-push skill
              </a>
              : lay out the iteration folder, write <span className="vx-mono">iteration.md</span>, run{" "}
              <span className="vx-mono">sdd push</span>. Agents draft; only people release.
            </p>
            <p className="vx-faint">
              The upload API, CLI and real project data arrive in later stages of the{" "}
              <a href="https://github.com/aimed-lab/sdd-studio/blob/main/docs/redesign-plan.md" target="_blank" rel="noreferrer">
                Projects plan
              </a>
              . The earlier demo directory is under <Link href="/projects/demo">Demo directory</Link>.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
