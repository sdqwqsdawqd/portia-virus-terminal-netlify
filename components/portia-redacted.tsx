import { PortiaIcon } from "@/components/portia-icons";
import { levelCopy } from "@/lib/level-copy";

// Phase 24, D-01/D-08/D-09/D-10: the place of a closed record. Static: no button, no link, no focus, no handler. It carries only
// the level it needs and the row number; nothing of the record itself ever reaches it. `level` is a plain number so this file
// does not import the access-level module (lib/access-foundation.test.ts keeps those imports out of components).
// Forms (24-UI-SPEC section 1): row = a list row, index = a table-of-contents line, tile = a grid cell, bar = a section head,
// block = the content of a window or panel whose record became closed.
export type RedactedVariant = "row" | "index" | "tile" | "bar" | "block";

export function RedactedPlaceholder({ level, variant, index, listItem, className }: {
  level: number;
  variant: RedactedVariant;
  // The row number as text ("01" or "01.2"); only the row and index forms show one.
  index?: string;
  // Inside a role="listbox" the placeholder is an option that can be neither chosen nor focused.
  listItem?: boolean;
  className?: string;
}) {
  const classes = `access-redacted access-redacted-${variant}${className ? ` ${className}` : ""}`;
  if (variant === "block") {
    return (
      <div className={classes} role="status" tabIndex={-1}>
        <PortiaIcon name="lock-closed" aria-hidden="true" />
        <p className="access-redacted-title">{levelCopy.redacted(level)}</p>
      </div>
    );
  }
  const listProps = listItem ? { role: "option" as const, "aria-disabled": true as const, "aria-selected": false as const } : {};
  const showsIndex = (variant === "row" || variant === "index") && index !== undefined;
  return (
    <div className={classes} {...listProps}>
      {showsIndex && <span className="access-redacted-number">{index}</span>}
      <PortiaIcon name="lock-closed" aria-hidden="true" />
      <span className="access-redacted-text">
        <span className="access-redacted-word">{levelCopy.redactedWord}</span>
        {" · "}
        <span className="access-redacted-need">{levelCopy.redactedNeed(level)}</span>
      </span>
    </div>
  );
}
