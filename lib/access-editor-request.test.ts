import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../app/api/access/editor-request/route.ts", import.meta.url), "utf8");
const sql = readFileSync(new URL("../supabase/migrations/20261113000000_portia_access_promotion.sql", import.meta.url), "utf8");

test("editor route verifies the session and fixes sheet origin on the server", () => {
  assert.match(route, /auth\.getUser\(\)/);
  assert.match(route, /getEditorAccess\(client, data\.user\)/);
  assert.match(route, /origin: "sheet"/);
  assert.doesNotMatch(route, /body\?\.requested_by|body\?\.origin/);
  assert.match(route, /editorRequestToken\(existing, ownStatus\)/);
});

test("own editor status requires both account id and current token digest", () => {
  const start = sql.indexOf("create or replace function public.portia_access_editor_request_status");
  const end = sql.indexOf("end; $$;", start);
  const body = sql.slice(start, end);
  assert.match(body, /r\.token_hash = p_token_hash and r\.requested_by = auth\.uid\(\) and r\.origin = 'sheet'/);
  assert.match(body, /auth\.uid\(\) is null or not public\.portia_can_edit\(\)/);
  assert.match(sql, /grant execute on function public\.portia_access_editor_request_status\(text\) to authenticated/);
  assert.doesNotMatch(sql, /grant execute on function public\.portia_access_editor_request_status\(text\) to anon/);
});
