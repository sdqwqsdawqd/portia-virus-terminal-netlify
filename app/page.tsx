import { PortiaAccessGate } from "@/components/portia-access-gate";

export default function Home() {
  return <>
    <PortiaAccessGate />
    {/* Owner 2026-11-22: the Google Cloud app verification needs the home page to link the privacy policy and the terms.
        Plain links in the static shell, small and quiet, outside the desktop and the gate. */}
    <nav className="legal-links" aria-label="Правовая информация">
      <a href="/privacy">Конфиденциальность</a>
      <a href="/terms">Условия</a>
    </nav>
  </>;
}
