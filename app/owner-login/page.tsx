import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEditorAccess } from "@/lib/editor-access";
import { editorSignUp, ownerLogin, ownerLogout } from "./actions";

export const dynamic = "force-dynamic";

export default async function OwnerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  let configured = true;
  let signedIn = false;

  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.getUser();
    signedIn = (await getEditorAccess(supabase, data.user)).canEdit;
  } catch {
    configured = false;
  }

  const { error, success } = await searchParams;

  return (
    <main className="owner-login-page">
      <section className="owner-login-card">
        <span className="eyebrow">PORTIA // РЕДАКТОР</span>
        <h1>Вход</h1>
        <p>Каждый редактор входит под своим email. Доступ выдаёт владелец сайта.</p>

        {!configured ? (
          <div className="owner-login-alert">Подключение к Supabase ещё не настроено.</div>
        ) : signedIn ? (
          <form action={ownerLogout}>
            <div className="owner-login-success">Доступ к редактору подтверждён.</div>
            <button type="submit">ВЫЙТИ ИЗ РЕДАКТОРА</button>
          </form>
        ) : (
          <form action={ownerLogin}>
            <label>
              <span>Email</span>
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              <span>Пароль</span>
              <input name="password" type="password" autoComplete="current-password" minLength={8} required />
            </label>
            {success && <div className="owner-login-success">Аккаунт создан. Если Supabase просит подтвердить email, откройте письмо, затем войдите.</div>}
            {error === "denied" && <div className="owner-login-alert">Этот аккаунт существует, но владелец не выдал ему доступ.</div>}
            {error === "not-approved" && <div className="owner-login-alert">Владелец ещё не добавил этот email в список редакторов.</div>}
            {error === "unconfirmed" && <div className="owner-login-alert">Почта не подтверждена. Откройте письмо от Supabase и войдите снова.</div>}
            {error === "setup" && <div className="owner-login-alert">Управление аккаунтами ещё не настроено в Supabase.</div>}
            {error && !["denied", "not-approved", "setup", "unconfirmed"].includes(error) && <div className="owner-login-alert">Не удалось выполнить действие. Проверьте email, пароль и подтверждение почты.</div>}
            <div className="owner-login-actions">
              <button type="submit">ВОЙТИ</button>
              <button type="submit" formAction={editorSignUp}>СОЗДАТЬ АККАУНТ</button>
            </div>
          </form>
        )}

        <Link href="/">← ВЕРНУТЬСЯ В PORTIA OS</Link>
      </section>
    </main>
  );
}
