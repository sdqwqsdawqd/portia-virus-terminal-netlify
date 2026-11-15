import { PortiaIcon } from "@/components/portia-icons";
import { levelCopy } from "@/lib/level-copy";

// Phase 24, D-01/D-08/D-09: the place of a closed record. Static: no button, no link, no focus, no handler. It carries only the
// level it needs and the row number; nothing of the record itself ever reaches it. `level` is a plain number so this file does
// not import the access-level module (lib/access-foundation.test.ts keeps those imports out of components).
// Plan 24-01 draws the row form; plan 24-02 widens `variant` to "row" | "index" | "tile" | "bar" | "block".
export type RedactedVariant = "row";

export function RedactedPlaceholder({ level, variant, index, listItem, className }: {
  level: number;
  variant: RedactedVariant;
  // The row number as text ("01"); only the row forms show one.
  index?: string;
  // Inside a role="listbox" the placeholder is an option that can be neither chosen nor focused.
  listItem?: boolean;
  className?: string;
}) {
  const listProps = listItem ? { role: "option" as const, "aria-disabled": true as const, "aria-selected": false as const } : {};
  return (
    <div className={`access-redacted access-redacted-${variant}${className ? ` ${className}` : ""}`} {...listProps}>
      {index !== undefined && <span className="access-redacted-index">{index}</span>}
      <PortiaIcon name="lock-closed" aria-hidden="true" />
      <span className="access-redacted-word">{levelCopy.redactedWord}</span>
      {" · "}
      <span className="access-redacted-need">{levelCopy.redactedNeed(level)}</span>
    </div>
  );
}
