import { DecisionBrief } from "@/components/decision-brief";
import { getSharedContext } from "@/lib/context-store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quorum · Shared decision brief", robots: { index: false, follow: false } };

export default async function BriefPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const context = await getSharedContext(sessionId).catch(() => null);
  if (!context) return <main className="brief-page"><section className="brief-shell brief-missing"><p>QUORUM DECISION BRIEF</p><h1>This link is unavailable.</h1><span>It may have expired, or durable session storage is not configured for this deployment.</span></section></main>;
  return <DecisionBrief context={context} shared />;
}
