import { Icon } from "@/components/icon";
import { BootPlanet, BootRocket } from "@/components/loading-screen";

export type GenerationState = { step: number; total: number; label: string; detail: string };

export function GenerationProgress({ progress }: { progress: GenerationState }) {
  const filledCells = Math.ceil((progress.step / progress.total) * 18);
  return (
    <section className="generation-progress build-boot" aria-live="polite" aria-label="Landing artifact is being generated">
      <div className="build-boot-stars" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
      <p className="generation-eyebrow">QUORUM ARTIFACT ASSEMBLY</p>
      <div className="build-boot-mark"><Icon name="jury" /><span>QUORUM</span></div>
      <h1>{progress.label}</h1>
      <p>{progress.detail}</p>
      <div className="build-boot-row">
        <BootRocket />
        <div className="build-boot-meter" role="progressbar" aria-valuemin={1} aria-valuemax={progress.total} aria-valuenow={progress.step} aria-valuetext={`Stage ${progress.step} of ${progress.total}: ${progress.label}`}>
          <div>{Array.from({ length: 18 }, (_, index) => <i className={index < filledCells ? "active" : ""} key={index} />)}</div>
        </div>
        <BootPlanet />
      </div>
      <div className="generation-steps">{Array.from({ length: progress.total }, (_, index) => <span className={index < progress.step ? "active" : ""} key={index}>{String(index + 1).padStart(2, "0")}</span>)}</div>
    </section>
  );
}
