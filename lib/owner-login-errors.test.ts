import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ownerLoginErrorText, signInErrorParam, signUpErrorParam, signUpReturnedExistingAccount } from "./owner-login-errors.ts";

test("sign-in: a wrong password is told apart from an unconfirmed email and from a rate limit", () => {
  assert.equal(signInErrorParam("email_not_confirmed"), "unconfirmed");
  assert.equal(signInErrorParam("invalid_credentials"), "invalid");
  assert.equal(signInErrorParam("over_request_rate_limit"), "rate-limit");
  assert.equal(signInErrorParam(undefined), "invalid");
});

test("sign-up: an email that already has an account says to sign in instead", () => {
  assert.equal(signUpErrorParam("user_already_exists"), "exists");
  assert.equal(signUpErrorParam("email_exists"), "exists");
  assert.equal(signUpErrorParam("weak_password"), "weak-password");
  assert.equal(signUpErrorParam("over_email_send_rate_limit"), "rate-limit");
  assert.equal(signUpErrorParam("signup_disabled"), "signup-disabled");
  assert.equal(signUpErrorParam("email_address_invalid"), "bad-email");
  assert.equal(signUpErrorParam("something_else"), "signup");
});

test("sign-up: Supabase hides an existing confirmed account behind a user without identities", () => {
  assert.equal(signUpReturnedExistingAccount({ identities: [] }), true);
  assert.equal(signUpReturnedExistingAccount({ identities: [{ id: "x" }] }), false);
  assert.equal(signUpReturnedExistingAccount({}), false);
  assert.equal(signUpReturnedExistingAccount(null), false);
});

test("every new code has its own Russian text; unknown codes fall back to the page's general text", () => {
  for (const code of ["invalid", "exists", "weak-password", "rate-limit", "signup-disabled", "bad-email", "signup", "missing"]) {
    const text = ownerLoginErrorText(code);
    assert.ok(text && /[А-Яа-я]/.test(text), code);
  }
  assert.match(ownerLoginErrorText("exists") ?? "", /ВОЙТИ/);
  assert.match(ownerLoginErrorText("invalid") ?? "", /пароль/i);
  assert.equal(ownerLoginErrorText("whatever"), null);
});

test("the login actions and page use the mapping", () => {
  const actions = readFileSync(new URL("../app/owner-login/actions.ts", import.meta.url), "utf8");
  const page = readFileSync(new URL("../app/owner-login/page.tsx", import.meta.url), "utf8");
  assert.ok(actions.includes("signInErrorParam(") && actions.includes("signUpErrorParam(") && actions.includes("signUpReturnedExistingAccount("));
  assert.ok(page.includes("ownerLoginErrorText(error)"));
});
