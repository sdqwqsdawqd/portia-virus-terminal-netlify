// /owner-login used to answer most failures with one general line, so a person whose email is already in the editor list
// could not tell "wrong password" from "account already exists" from "too many attempts". Each Supabase Auth error code now
// maps to its own ?error= value and its own Russian line. The codes are the documented Supabase Auth error codes.

export function signInErrorParam(code: string | undefined): "unconfirmed" | "invalid" | "rate-limit" {
  if (code === "email_not_confirmed") return "unconfirmed";
  if (code === "over_request_rate_limit") return "rate-limit";
  return "invalid";
}

export function signUpErrorParam(code: string | undefined): "exists" | "weak-password" | "rate-limit" | "signup-disabled" | "bad-email" | "signup" {
  if (code === "user_already_exists" || code === "email_exists") return "exists";
  if (code === "weak_password") return "weak-password";
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit") return "rate-limit";
  if (code === "signup_disabled") return "signup-disabled";
  if (code === "email_address_invalid") return "bad-email";
  return "signup";
}

// With email confirmation on, Supabase answers a sign-up for an already registered email without an error and with a user
// whose identities list is empty (it hides that the account exists). That is the same case as "exists".
export function signUpReturnedExistingAccount(user: { identities?: readonly unknown[] | null } | null | undefined): boolean {
  return Array.isArray(user?.identities) && user.identities.length === 0;
}

const texts: Record<string, string> = {
  missing: "Введите email и пароль.",
  invalid: "Неверный email или пароль. Если аккаунт уже создан, войдите тем паролем, который задали при создании; если пароль забыт, попросите владельца сбросить его.",
  exists: "Аккаунт с этим email уже создан. Нажмите «ВОЙТИ» и введите его пароль.",
  "weak-password": "Пароль слишком простой. Задайте пароль длиннее 8 символов из букв и цифр.",
  "rate-limit": "Слишком много попыток подряд. Подождите несколько минут и попробуйте снова.",
  "signup-disabled": "Создание аккаунтов отключено в настройках Supabase. Обратитесь к владельцу.",
  "bad-email": "Email указан с ошибкой. Проверьте адрес.",
  signup: "Не удалось создать аккаунт. Пароль должен быть не короче 8 символов; попробуйте ещё раз позже.",
};

/** The Russian line for an ?error= value, or null for a value this module does not know (the page keeps its general line). */
export function ownerLoginErrorText(code: string): string | null {
  return Object.hasOwn(texts, code) ? texts[code] : null;
}
