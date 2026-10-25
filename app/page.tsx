"use client";

import { useEffect, useState } from "react";
import { Dashboard } from "@/components/dashboard";
import { Hero } from "@/components/hero";
import { LoadingScreen } from "@/components/loading-screen";

type Screen = "loading" | "hero" | "app";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [isHandingOff, setIsHandingOff] = useState(false);
  const [initialCommand, setInitialCommand] = useState<string | undefined>();
  function finishIntro() { setScreen("hero"); }
  function enterWorkspace(command?: string) { setInitialCommand(command); setScreen("app"); }

  useEffect(() => {
    if (screen !== "loading") return;
    // Every page load follows intro -> landing page -> explicit workspace entry.
    // Workspace entry is fresh; saved projects require an explicit menu selection.
    const handoffTimer = window.setTimeout(() => setIsHandingOff(true), 4650);
    const screenTimer = window.setTimeout(finishIntro, 5000);
    return () => {
      window.clearTimeout(handoffTimer);
      window.clearTimeout(screenTimer);
    };
  }, [screen]);

  if (screen === "loading") {
    return (
      <div className={`screen-handoff${isHandingOff ? " is-handing-off" : ""}`}>
        <div className="screen-handoff-loader"><LoadingScreen /></div>
      </div>
    );
  }
  if (screen === "hero") return <Hero onStart={enterWorkspace} />;
  return <Dashboard initialCommand={initialCommand} onExit={() => { setInitialCommand(undefined); setScreen("hero"); }} />;
}
