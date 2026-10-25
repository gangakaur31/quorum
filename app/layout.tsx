import type { Metadata } from "next";
import "./globals.css";
import "./quorum-polish.css";
import "./loading-splash.css";
import "./workspace.css";
import "./knowledge.css";
import "./terminal-experience.css";
import "./demo-autofill.css";

export const metadata: Metadata = {
  title: "Quorum: Evidence Behind Your Next Product Decision",
  description: "Discover sourced opportunities, challenge an offer with AI perspectives, inspect knowledge, prepare legal questions, and run real tests before recording your next decision.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
