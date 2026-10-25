import type { CSSProperties } from "react";

export function BootRocket() {
  return <svg className="boot-rocket" viewBox="0 0 72 72" fill="none" aria-hidden="true"><path d="M43.2 8.8c10.8 2.2 16.2 10.2 17.3 21.4-6.3 9.4-15.9 14.5-27.5 15.3L25 37.3c.7-11.6 5.8-21.2 15.3-28.5Z" /><path d="m25 37.3-10.8 1.8L8.5 54.7l15.6-5.8L25 37.3ZM33 45.5l-1.8 10.8L16 62l5.8-15.6" /><circle cx="44.2" cy="26.1" r="5.4" /><path d="m22.7 49.5-6.6 6.6M18.3 43.9l-7.8 3.3M28.2 55l-3.3 7.8" /><path className="rocket-flame" d="M15.4 56.7c-4.3.9-7.9 3.8-10 8.5 4.8-2.1 7.6-5.7 8.5-10l1.5 1.5Z" /></svg>;
}

export function BootPlanet() {
  return <svg className="boot-planet" viewBox="0 0 88 72" fill="none" aria-hidden="true"><circle cx="44" cy="34" r="19" /><path d="M5 40.8c4-10.3 31.7-20 56.6-20.4 12-.2 19.5 1.6 20.8 5.4 1.9 5.6-10.8 14.7-28.2 20.2C36.8 51.5 9.4 51.2 5.7 44.3c-.5-1-.7-2.2-.7-3.5Z" /><path d="M29 20.2c4.9-3.1 11-4.3 16.9-3.4M52.7 50.5c-5.4 2-11.5 1.6-16.6-1.1" /></svg>;
}

const INTRO_SIGNALS = [
  { label: "Analyst", number: "01", x: 17.5, y: 15.22, path: "M140 70H226L330 174L352 194" },
  { label: "Skeptic", number: "02", x: 82.5, y: 15.22, path: "M660 70H574L470 174L448 194" },
  { label: "Advocate", number: "03", x: 9.25, y: 50, path: "M74 230H320" },
  { label: "First-time buyer", number: "04", x: 90.75, y: 50, path: "M726 230H480" },
  { label: "Competitor user", number: "05", x: 17.5, y: 84.78, path: "M140 390H226L330 286L352 266" },
  { label: "Budget-conscious", number: "06", x: 82.5, y: 84.78, path: "M660 390H574L470 286L448 266" },
] as const;

export function LoadingScreen() {
  return (
    <main className="signal-intro" aria-label="Quorum introduction">
      <div className="intro-atmosphere" aria-hidden="true" />
      <div className="intro-grid" aria-hidden="true" />
      <div className="intro-horizon" aria-hidden="true" />
      <header className="intro-hud"><span className="intro-brand"><span className="intro-brand-mark" aria-hidden="true">Q</span> QUORUM</span><span>THE FOUNDER WORKSPACE <span className="intro-hud-cross" aria-hidden="true">+</span></span></header>

      <section className="intro-center">
        <div className="intro-signal" aria-hidden="true">
          <div className="intro-core-glow" />
          <div className="intro-shockwave intro-shockwave-one" />
          <div className="intro-shockwave intro-shockwave-two" />
          <svg className="intro-signal-map" viewBox="0 0 800 460" fill="none">
            <defs>
              <linearGradient id="quorum-intro-metal" x1="335" y1="148" x2="466" y2="320" gradientUnits="userSpaceOnUse"><stop stopColor="#c9ffc3" /><stop offset=".45" stopColor="#6c9782" /><stop offset="1" stopColor="#274738" /></linearGradient>
              <linearGradient id="quorum-intro-glass" x1="350" y1="160" x2="458" y2="310" gradientUnits="userSpaceOnUse"><stop stopColor="#1b352b" /><stop offset="1" stopColor="#081410" /></linearGradient>
              <radialGradient id="quorum-intro-halo"><stop stopColor="#c9ff83" stopOpacity=".2" /><stop offset="1" stopColor="#a7ff63" stopOpacity="0" /></radialGradient>
            </defs>
            <circle cx="400" cy="230" r="208" fill="url(#quorum-intro-halo)" />
            <g className="intro-crosshairs"><path d="M400 20V42M400 418V440M190 230H212M588 230H610" /><path d="M255 85L267 97M533 363L545 375M255 375L267 363M533 97L545 85" /></g>
            <g className="intro-orbit-frame"><circle className="intro-orbit-track" cx="400" cy="230" r="184" /><circle className="intro-orbit-fine" cx="400" cy="230" r="157" /><circle className="intro-orbit-arc" cx="400" cy="230" r="172" /><circle className="intro-orbit-arc intro-orbit-arc-reverse" cx="400" cy="230" r="143" /></g>
            <g className="intro-gyroscope"><ellipse cx="400" cy="230" rx="161" ry="55" transform="rotate(-32 400 230)" /><ellipse cx="400" cy="230" rx="161" ry="55" transform="rotate(32 400 230)" /></g>
            <g className="intro-paths">{INTRO_SIGNALS.map(signal => <path key={signal.number} d={signal.path} pathLength="1" />)}</g>
            <g className="intro-travel-signals">{INTRO_SIGNALS.map((signal, index) => <path key={signal.number} d={signal.path} pathLength="1" style={{ animationDelay: `${.65 + index * .13}s` }} />)}</g>
            <g className="intro-nodes">{INTRO_SIGNALS.map((signal, index) => <circle key={signal.number} cx={signal.x * 8} cy={signal.y * 4.6} r="3" style={{ animationDelay: `${index * .3}s` }} />)}</g>
            <g className="intro-mark"><path className="intro-core-shadow" d="M400 148L471 189V271L400 312L329 271V189Z" /><path className="intro-core-face" d="M400 143L475 186V274L400 317L325 274V186Z" /><path className="intro-core-facet" d="M325 186L400 230L475 186M400 230V317" /><circle className="intro-q-outline" cx="400" cy="225" r="36" pathLength="1" /><path className="intro-q-tail" d="M416 243L444 271" pathLength="1" /><path className="intro-core-edge" d="M326 186L400 143L474 186" /></g>
            <g className="intro-scene-labels"><text x="400" y="19" textAnchor="middle">INDEPENDENT PERSPECTIVES</text></g>
          </svg>
          {INTRO_SIGNALS.map((signal, index) => <div className={`intro-perspective intro-perspective-${index + 1}`} key={signal.number} style={{ "--node-x": `${signal.x}%`, "--node-y": `${signal.y}%`, "--node-delay": `${.15 + index * .1}s`, "--node-direction": signal.x < 50 ? "-35px" : "35px" } as CSSProperties}><span className="intro-perspective-number">{signal.number}</span><span className="intro-perspective-name">{signal.label}</span><span className="intro-perspective-light" /></div>)}
          <div className="intro-lens-line" />
        </div>

        <div className="intro-title-block">
          <p className="intro-eyebrow">ONE IDEA. SIX PERSPECTIVES.</p>
          <h1 className="intro-wordmark" aria-label="Quorum"><span aria-hidden="true">{"QUORUM".split("").map((letter, index) => <span className="intro-letter-mask" key={index}><span className="intro-letter" style={{ "--letter-delay": `${1.65 + index * .075}s` } as CSSProperties}>{letter}</span></span>)}</span><span className="intro-wordmark-line" aria-hidden="true" /></h1>
          <p className="intro-tagline">A better question.<span> A clearer next step.</span></p>
          <div className="intro-sequence" aria-hidden="true"><span>IDEA</span><i /><span>CHALLENGE</span><i /><span>EVIDENCE</span></div>
        </div>
      </section>

      <footer className="intro-footer"><span>BUILT FOR THE QUESTIONS THAT COME BEFORE BUILDING.</span><span className="intro-decoration" aria-hidden="true"><i /><i /><i /> MAKE THE NEXT MOVE COUNT.</span></footer>
    </main>
  );
}
