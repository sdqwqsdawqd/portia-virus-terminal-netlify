import { PortiaAccessGate } from "@/components/portia-access-gate";

export default function Home() {
  return <>
    <PortiaAccessGate />
    {/* Owner 2026-11-22: the Google Cloud app verification needs the home page to say what the app is for and to link the privacy policy and the terms.
        One quiet line in the empty middle of the system bar, in the static shell; nothing is added to the page flow, so the desktop keeps its height. */}
    <nav className="legal-links" aria-label="О приложении" title="PORTIA is a non-commercial web app for a gaming community (a fictional virus archive and a guide). Sign in with Google is used only to sign in; no AI content is generated.">
      <span className="legal-about">Некоммерческий архив игрового сообщества · вход через Google только для входа в аккаунт</span>
      <a href="/privacy">Конфиденциальность</a>
      <a href="/terms">Условия</a>
    </nav>
  </>;
}
