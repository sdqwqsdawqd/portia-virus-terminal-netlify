import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ownerLogin, ownerLogout } from "./actions";

export const dynamic = "force-dynamic";

export default async function OwnerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  let configured = true;
  let signedIn = false;

  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.getUser();
    signedIn = Boolean(
      data.user?.email &&
      data.user.email.toLocaleLowerCase("en-US") === process.env.PORTIA_OWNER_EMAIL?.trim().toLocaleLowerCase("en-US"),
    );
  } catch {
    configured = false;
  }

  const { error } = await searchParams;

  return (
    <main className="owner-login-page">
      <section className="owner-login-card">
        <span className="eyebrow">PORTIA // ЗАЩИЩЁННЫЙ КОНТУР</span>
        <h1>Вход владельца</h1>
        <p>Посетители видят базу данных, но изменение записей доступно только владельцу.</p>

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
              <span>Пароль владельца</span>
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
            {error && <div className="owner-login-alert">Не удалось войти. Проверьте пароль.</div>}
            <button type="submit">ПОДТВЕРДИТЬ ДОСТУП</button>
          </form>
        )}

        <Link href="/">← ВЕРНУТЬСЯ В PORTIA OS</Link>
      </section>
    </main>
  );
}
