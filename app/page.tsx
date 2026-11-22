import { PortiaAccessGate } from "@/components/portia-access-gate";

export default function Home() {
  return <>
    <PortiaAccessGate />
    {/* Owner 2026-11-22: the Google Cloud app verification needs the home page to link the privacy policy and the terms and to say what the app is for.
        Plain markup in the static shell, outside the desktop and the gate: quiet links in the system bar, and a short note under the desktop. */}
    <nav className="legal-links" aria-label="Правовая информация">
      <a href="/privacy">Конфиденциальность</a>
      <a href="/terms">Условия</a>
    </nav>
    <footer className="site-about">
      <p><b>PORTIA</b> — некоммерческое веб-приложение игрового сообщества: вымышленный архив вирусов, справочник и инструменты, через которые участники подают заявки на доступ, а редакторы ведут архив. Вход через Google используется только для входа в аккаунт (почта, имя, фото профиля).</p>
      <p lang="en"><b>PORTIA</b> is a non-commercial web app for a gaming community: a fictional virus archive, a reference guide, and tools for members to request access and for editors to maintain the archive. Sign in with Google is used only to sign users in (email, name, profile picture); the app does not use Google APIs to generate images or any AI content.</p>
      <p><a href="/privacy">Privacy Policy / Конфиденциальность</a> · <a href="/terms">Terms of Service / Условия</a> · <a href="mailto:anuargovni@gmail.com">anuargovni@gmail.com</a></p>
    </footer>
  </>;
}
