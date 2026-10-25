"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { PRODUCT_FEATURES } from "@/lib/product-content";

export function Hero({ onStart }: { onStart: (command?: string) => void }) {
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  useEffect(() => {
    if (showHowItWorks) document.getElementById("how-it-works")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "center" });
  }, [showHowItWorks]);

  return (
    <main className="hero-shell">
      <div className="hero-noise" />
      <section className="hero-content">
        <div className="wordmark"><Icon name="jury" /><span>QUORUM</span></div>
        <p className="eyebrow">INDEPENDENT SIGNAL, BEFORE SPEND</p>
        <h1>Make the next product decision with evidence.</h1>
        <p className="hero-copy">Describe an idea. Challenge the offer. Run a small test and keep the evidence behind your next step.</p>
        <div className="hero-actions">
          <button className="button-primary" type="button" onClick={() => onStart()}>Start your Quorum <Icon name="arrow" /></button>
          <button className="text-link hero-link-button" type="button" aria-expanded={showHowItWorks} aria-controls="how-it-works" onClick={() => setShowHowItWorks((visible) => !visible)}>See how it works</button>
        </div>
        <div className="hero-terminal" aria-label="A Quorum terminal example">
          <div className="terminal-bar"><span className="window-dots"><i /><i /><i /></span><span>quorum · example workflow</span><Icon name="terminal" /></div>
          <div className="terminal-demo">
            <p><b>QUORUM &gt;</b> describe a tool for teams that need to test a new idea</p>
            <p><b>QUORUM &gt;</b> <span className="bright">/skeptic</span> · challenge the offer with an AI perspective</p>
            <p><b>QUORUM &gt;</b> <span className="bright">/knowledge</span> · inspect source excerpts and citations</p>
            <p><b>QUORUM &gt;</b> <span className="bright">/experiments</span> · plan a real test before recording results<span className="blink">_</span></p>
          </div>
        </div>
        {showHowItWorks && <section id="how-it-works" className="how-it-works" aria-label="How Quorum works">
          <div><span>01</span><h2>Describe or discover the bet</h2><p>Start with your idea or a sourced opportunity. Make the customer, problem and current alternative explicit.</p></div>
          <div><span>02</span><h2>Challenge the offer</h2><p>Generate an offer, then choose AI reviewers. Inspect their objections and assumptions at your own pace.</p></div>
          <div><span>03</span><h2>Collect real evidence</h2><p>Prepare interviews or prespecify an experiment. Record what happened, including contradictions and limitations.</p></div>
          <div><span>04</span><h2>Revisit the decision</h2><p>Inspect the evidence rule and save a dated decision. Return to earlier outputs without generating them again.</p></div>
        </section>}
        <p className="research-note">AI perspectives reveal questions to test. Customer behavior supplies the evidence.</p>
        <section className="hero-features" aria-labelledby="hero-features-title"><header><p className="eyebrow">A WORKSPACE YOU EXPLORE ONE COMMAND AT A TIME</p><h2 id="hero-features-title">From the first question to the next real test.</h2><p>Choose the tool you need. Keep the source behind the result.</p></header><div className="hero-feature-grid">{PRODUCT_FEATURES.map(feature => <article key={feature.id} data-feature={feature.id}><Icon name={feature.icon} /><h3>{feature.title}</h3><p>{feature.description}</p><p className="feature-boundary">{feature.detail}</p><button onClick={() => onStart(feature.command)}>{feature.command}<Icon name="arrow" /></button></article>)}</div></section>
        <section className="hero-continuity"><div><p className="eyebrow">RETURN WITH SOMETHING NEW</p><h2>Your project keeps its context.</h2><p>Reopen saved outputs, follow decision history and keep evidence in the same project. Private exports preserve an archive; reviewed briefs can be shared through a separate revocable link.</p></div><div className="hero-privacy-note"><h3>Know what leaves your workspace.</h3><p>Relevant passages are sent to your configured AI provider when you use AI features. Legal task notes and public-form contacts are excluded from retrieval. Sharing is explicit; generated text still needs your review.</p><p>Access uses a private browser-held key, with 14-day server inactivity expiry. An export does not restore a deleted or expired server project.</p><button onClick={() => onStart("/history")}>Explore the workspace <Icon name="arrow" /></button></div></section>
      </section>
    </main>
  );
}
