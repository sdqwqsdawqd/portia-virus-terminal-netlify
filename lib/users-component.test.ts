import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const componentPath = join(repoRoot, "components", "portia-users-tab.tsx");
const component = readFileSync(new URL("../components/portia-users-tab.tsx", import.meta.url), "utf8");
const proxy = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/portia.css", import.meta.url), "utf8").replace(/\r\n/gu, "\n");

// Phase 26 (UI-03): the users block is read from its start marker to its end marker; the ui-unify block that follows it is not part of it.
function usersBlock() {
  const start = css.lastIndexOf("/* users-tab:start");
  return css.slice(start, css.indexOf("/* users-tab:end */", start) + "/* users-tab:end */".length);
}

function dependencyClosure(path: string, seen = new Set<string>()): Set<string> {
  const resolved = normalize(path);
  if (seen.has(resolved)) return seen;
  seen.add(resolved);
  const source = readFileSync(resolved, "utf8");
  for (const match of source.matchAll(/from\s+["']([^"']+)["']/gu)) {
    const specifier = match[1];
    let child: string | null = null;
    if (specifier.startsWith("@/lib/")) child = join(repoRoot, "lib", `${specifier.slice(6).replace(/\.ts$/u, "")}.ts`);
    if (specifier.startsWith("./")) child = join(dirname(resolved), specifier.replace(/\.ts$/u, "") + ".ts");
    if (child && existsSync(child)) dependencyClosure(child, seen);
  }
  return seen;
}

test("users component exposes the accessible live badge contract", () => {
  assert.equal(component.split(/\r?\n/u)[0], '"use client";');
  assert.match(component, /pendingBadgeText/u);
  assert.match(component, /className="tab-count" aria-hidden="true"/u);
  assert.match(component, /className="sr-only"/u);
  assert.match(component, /role="status" aria-live="polite"/u);
  assert.match(component, /30_000/u);
  assert.match(component, /10_000/u);
  assert.match(component, /document\.visibilityState/u);
  assert.doesNotMatch(component, /(?:\p{Script=Cyrillic}+[\s,.:;—-]+){6}\p{Script=Cyrillic}+/u);
});

test("users component keeps access internals behind its API route", () => {
  for (const literal of component.matchAll(/["'`](\/api\/[^"'`]*)["'`]/gu)) {
    assert.ok(literal[1].startsWith("/api/users"), literal[1]);
  }
  assert.doesNotMatch(component, /portia_access_|access-store|access-session|users-api|users-roster/u);
  assert.match(component, /AppDeniedPanel/u);
  assert.match(component, /AppSkeleton shape="employees"/u);
  const forbidden = /access-store\.ts$|access-session\.ts$|users-api\.ts$|users-roster\.ts$|portia-promotion-sheet\.ts$/u;
  for (const path of dependencyClosure(componentPath)) {
    assert.doesNotMatch(path.replaceAll("\\", "/"), forbidden, path);
    assert.doesNotMatch(readFileSync(path, "utf8"), /from\s+["']node:/u, path);
  }
});

test("proxy refreshes the editor session for users polling", () => {
  assert.match(proxy, /"\/api\/users"/u);
});

test("full users component has search, closed details, accessible phone dialog and stale refresh", () => {
  assert.match(component, /type="search"/u);
  assert.match(component, /maxLength=\{20\}/u);
  assert.match(component, /autoComplete="off"/u);
  assert.match(component, /autoCapitalize="off"/u);
  assert.match(component, /spellCheck=\{false\}/u);
  assert.match(component, /300/u);
  assert.match(component, /<details/u);
  assert.doesNotMatch(component, /<details[^>]*\sopen/u);
  assert.match(component, /aria-haspopup="dialog"/u);
  assert.match(component, /<dialog[\s\S]*className="portia-dialog"/u);
  assert.match(component, /target="_blank"/u);
  assert.match(component, /rel="noopener noreferrer"/u);
  assert.match(component, /<time dateTime=/u);
  assert.match(component, /AppStaleBanner/u);
  assert.doesNotMatch(component, /toLocaleString|Intl\./u);
});

// Phase 26 (UI-03): the users block is sharp (no radius of its own) and sits right before the ui-unify block, which ends the file;
// the radii of its plaques, rows and count pill come from the ui-unify selector lists.
test("users CSS is one sharp marked block right before the ui-unify block", () => {
  const start = css.lastIndexOf("/* users-tab:start");
  assert.ok(start > 0, "users-tab CSS block must exist");
  const end = css.indexOf("/* users-tab:end */", start);
  assert.ok(end > start, "users-tab CSS block must be closed");
  const block = css.slice(start, end + "/* users-tab:end */".length);
  const unify = css.indexOf("/* ui-unify:start");
  assert.ok(unify > end, "the ui-unify block follows the users-tab block");
  assert.equal(css.slice(end + "/* users-tab:end */".length, unify).trim(), "", "nothing sits between users-tab and ui-unify");
  assert.ok(css.trimEnd().endsWith("/* ui-unify:end */"));
  assert.match(block, /\.tab-count/u);
  assert.match(block, /padding:\s*0 8px/u);
  assert.match(block, /min-width:\s*24px/u);
  assert.match(block, /margin-left:\s*8px/u);
  assert.match(block, /var\(--mono\)/u);
  assert.match(block, /var\(--warning\)/u);
  assert.doesNotMatch(block, /border-radius|@keyframes|(?:^|[;\s])(animation|transition)\s*:|--muted|oklch\(\.559/u);
});

test("request decisions use the shared confirmation dialog and honest busy states", () => {
  assert.match(component, /ConfirmDialog/u);
  assert.match(component, /usersCopy\.approveAria/u);
  assert.match(component, /aria-busy=/u);
  assert.match(component, /role="status"/u);
  assert.match(component, /method:\s*"POST"/u);
  assert.match(component, /"content-type":\s*"application\/json"/u);
  assert.match(component, /cache:\s*"no-store"/u);
  assert.doesNotMatch(component, /window\.confirm/u);
  assert.match(component, /usersCopy\.approving/u);
  assert.match(component, /usersCopy\.rejecting/u);
  assert.match(component, /tone:\s*"danger"/u);
  assert.match(component, /tone:\s*"secondary"[\s\S]*autoFocus:\s*true/u);
});

test("person and cooldown actions are available on PC and in the phone action window", () => {
  assert.match(component, /usersCopy\.setLevel/u);
  assert.match(component, /usersCopy\.revoke/u);
  assert.match(component, /usersCopy\.clearCooldown/u);
  assert.match(component, /usersCopy\.saving/u);
  assert.match(component, /usersCopy\.revoking/u);
  assert.match(component, /expectedLevel/u);
  assert.match(component, /callerIsOwner/u);
  assert.match(component, /disabled=\{[^}]*level[^}]*===/u);
  assert.match(component, /usersCopy\.revokeDialog/u);
  const block = usersBlock();
  assert.match(block, /\.users-row-actions[^}]*gap:\s*8px/u);
  assert.match(block, /\.users-action-note/u);
  assert.match(block, /@media \(max-width: 900px\)[\s\S]*\.users-action-dialog-body \.users-row-actions[\s\S]*min-height:\s*44px/u);
});

test("history stays open across list refresh and reloads by nicknameKey", () => {
  assert.match(component, /parseUsersHistory/u);
  assert.match(component, /view=history&key=/u);
  assert.match(component, /openHistoryKeys/u);
  assert.match(component, /setOpenHistoryKeys/u);
  assert.match(component, /\[\.\.\.openHistoryKeys(?:Ref\.current)?\][\s\S]*loadHistory/u);
  assert.match(component, /row\.source\.nicknameKey/u);
  assert.doesNotMatch(component, /setOpenHistoryKeys\(new Set\(\)\)/u, "list refresh must not close history panels");
});

test("history is accessible inline on PC and always present in the phone action window", () => {
  assert.match(component, /aria-expanded=/u);
  assert.match(component, /aria-controls=/u);
  assert.match(component, /<ol/u);
  assert.match(component, /usersCopy\.historyHeading/u);
  assert.match(component, /usersCopy\.historyEmpty/u);
  assert.match(component, /usersCopy\.hideHistory/u);
  assert.match(component, /phoneHistory/u);
  assert.doesNotMatch(component, /Показать ещё/iu);
  const block = usersBlock();
  assert.match(block, /\.users-history-list[^}]*gap:\s*4px/u);
  assert.match(block, /\.users-history-list[^}]*font:\s*400 11px/u);
  assert.doesNotMatch(block, /border-radius|@keyframes|(?:^|[;\s])(animation|transition)\s*:/u);
});

test("owner bulk approval is sequential, safe by default and keeps the three-number result", () => {
  assert.match(component, /usersCopy\.bulkButton/u);
  assert.match(component, /view=bulk/u);
  assert.match(component, /level:\s*2[\s\S]*bulk:\s*true/u);
  assert.match(component, /for \(const candidate of bulkDialog\.eligible\)[\s\S]*await fetch/u);
  assert.match(component, /role="alertdialog"/u);
  assert.match(component, /data-autofocus[\s\S]*autoFocus/u);
  assert.match(component, /bulkRunning[\s\S]*event\.preventDefault/u);
  assert.match(component, /aria-live="polite"/u);
  const singleApprove = component.slice(component.indexOf("const approve ="), component.indexOf("const requestReject"));
  assert.doesNotMatch(singleApprove, /nicknameKey/u, "single approve must not send a client-selected roster key");
  const bulkRun = component.slice(component.indexOf("const approveBulk"), component.indexOf("if (denied)"));
  assert.doesNotMatch(bulkRun, /Promise\.all/u);
});

test("roster marks are visible on PC and phone with bounded sharp lists", () => {
  assert.match(component, /users-table-mark/u);
  assert.match(component, /usersCopy\.tableLabel/u);
  const block = usersBlock();
  assert.match(block, /\.users-bulk-list[^}]*max-height:\s*min\(40svh,\s*320px\)/u);
  assert.match(block, /\.users-bulk-list[^}]*overflow-y:\s*auto/u);
  assert.match(block, /overflow-wrap:\s*anywhere/u);
  assert.match(block, /\.users-table-mark\.accent/u);
  assert.match(block, /\.users-table-mark\.warning/u);
  assert.match(block, /\.users-table-mark\.neutral/u);
  assert.doesNotMatch(block, /border-radius|@keyframes|(?:^|[;\s])(animation|transition)\s*:/u);
});

test("single approval keeps the POST decision-time mark through a cached list refresh", () => {
  const postAction = component.slice(component.indexOf("const postAction ="), component.indexOf("const approve ="));
  const load = component.slice(component.indexOf("const load = useCallback"), component.indexOf("const openDialog ="));
  assert.match(postAction, /responseJson\.tableMark[\s\S]*recentDecisionMarks\.current\.set/u);
  assert.match(load, /recentDecisionMarks\.current\.get\(row\.id\)[\s\S]*tableMark: recent\.mark/u);
  assert.match(load, /value\.until <= now/u, "the override must expire after the roster cache window");
});

// Phase 26 (UI-04, D-12, T-26-18): on a PC the picked row opens in the detail pane, which renders the same body as the phone action
// window; the actions of both come only from visibleControls (the server's flags), the component computes no rights of its own.
test("the PC detail pane and the phone action window share one UsersActionBody with server-driven controls", () => {
  assert.match(component, /function UsersActionBody\(/u);
  const dialog = component.slice(component.indexOf("function UsersActionDialog("), component.indexOf("function UsersBulkDialog("));
  assert.match(dialog, /<UsersActionBody /u, "the phone window renders the shared body");
  assert.match(component, /detail=\{selectedContext \? <UsersActionBody /u, "the PC detail renders the shared body");
  const body = component.slice(component.indexOf("function UsersActionBody("), component.indexOf("function UsersActionDialog("));
  for (const part of ["<h2 id={titleId}>{row.nickname}</h2>", "usersCopy.typeLabel", "usersCopy.tableLabel", "usersCopy.profileLabel", "<RowCaption row={row} />", "<HistoryPanel", "<RowActions"]) {
    assert.ok(body.includes(part), part);
  }
  assert.equal(component.split("visibleControls(").length - 1, 1, "the controls are read in one place, from the server's row flags");
  assert.doesNotMatch(body, /canDecide|canSetLevel|canRevoke|retryAt/u, "the body computes no rights");
  assert.match(component, /aria-current=\{selectedKey === row\.key \? "true" : undefined\}/u, "the picked row is the current one");
  assert.match(component, /usersCopy\.detailEmptyTitle/u);
  assert.match(component, /usersCopy\.detailEmptyHint/u);
});

test("the empty detail and the section labels are short texts in users-copy", async () => {
  const { usersCopy } = await import("./users-copy.ts");
  assert.equal(usersCopy.detailEmptyTitle, "Выберите заявку или человека");
  assert.equal(usersCopy.detailEmptyHint, "Действия появятся справа.");
  assert.equal(usersCopy.sectionTab("Заявки", 3), "Заявки · 3");
  assert.deepEqual(usersCopy.sectionTitles, { pending: "Заявки", people: "Люди", closed: "Отклонённые и отозванные" });
  assert.equal(usersCopy.pendingStatus(12), "Ожидают: 12");
  for (const text of [usersCopy.detailEmptyTitle, usersCopy.detailEmptyHint, usersCopy.sectionsLabel, ...Object.values(usersCopy.sectionTitles)]) {
    assert.ok(text.split(/\s+/u).length < 7, `${text}: shorter than 7 words`);
  }
});
