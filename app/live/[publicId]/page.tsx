import { getLiveDocument } from "@/lib/context-store";
import { ArtifactView } from "@/components/artifact-view";
import { LiveOffer } from "@/components/live-offer";
export const dynamic = "force-dynamic";
export const metadata = { title: "Quorum · Early concept experiment", robots: { index: false, follow: false } };
export default async function LivePage({ params }: { params: Promise<{ publicId: string }> }) {
  const document = await getLiveDocument((await params).publicId).catch(() => null);
  if (!document?.active) return <main className="brief-page"><section className="brief-shell public-page-shell"><h1>This experiment is closed or unavailable.</h1><p>The owner may have closed it, or its retention period has ended.</p></section></main>;
  return <main className="brief-page"><div className="brief-shell workspace-content public-page-shell"><header className="workspace-heading"><p className="section-label">EARLY CONCEPT EXPERIMENT · POWERED BY QUORUM</p><h1>{document.title}</h1><p>A static concept preview. Use the real interest form below the preview to contact the project owner.</p></header><ArtifactView artifact={document.artifact} /><LiveOffer publicId={document.publicId} objective={document.objective} disclosure={document.disclosure} demo={document.title.includes("[DEMO]")} /></div></main>;
}
