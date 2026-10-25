import type { LandingArtifact } from "@/lib/types";
import { withoutEmDashes } from "@/lib/typography";

export function ArtifactView({ artifact }: { artifact: LandingArtifact }) {
  return (
    <section className="artifact-shell" aria-label="Generated landing artifact">
      <div className="artifact-bar">
        <span>ARTIFACT: {artifact.title.toUpperCase().replace(/\s+/g, "_").slice(0, 42)}.HTML</span>
        <span className="artifact-status">RENDERED ARTIFACT</span>
      </div>
      <iframe className="artifact-frame" title={`Generated landing page: ${withoutEmDashes(artifact.title)}`} sandbox="" srcDoc={withoutEmDashes(artifact.html)} />
    </section>
  );
}
