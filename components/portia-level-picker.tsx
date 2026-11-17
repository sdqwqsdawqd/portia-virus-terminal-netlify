"use client";

import { useId, useState, type FocusEvent, type ReactNode } from "react";
import { ACCESS_LEVELS, requiredLevelOf, type AccessLevel } from "@/lib/access-levels";
import { levelCopy } from "@/lib/level-copy";

// Phase 24, D-16 / LVL-02: the one control that sets a needed access level (1..5) in every editor form. Native radios under a
// fieldset: Tab enters the group, the arrows change the value, no key handler of our own. The shown value is the effective
// one: max(own level, parent level); WR-02: the legend is the first child of the fieldset, so it names the group, and the caption follows it; an empty or damaged value is shown by requiredLevelOf (no field at all is level 1).
// UAT 2026-11-16 gap 6: closed, the control is one small button that says who sees the record; the plates 1..5 open in the same row
// on a press; a pointer choice or leaving the group closes them again, an arrow choice keeps them open.
export function LevelPicker({ name, value, min = 1, caption, notice, action, onChange }: {
  name: string;
  value: unknown;
  min?: AccessLevel;
  caption?: string;
  notice?: string;
  // Phase 25, D-14: an optional control drawn last, inside the group (the «change the address of a picture» offer).
  action?: ReactNode;
  onChange: (level: AccessLevel) => void;
}) {
  const hintId = useId();
  const optionsId = useId();
  const [open, setOpen] = useState(false);
  const shown = Math.max(requiredLevelOf(value), min);
  const closeOnLeave = (event: FocusEvent<HTMLFieldSetElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  };
  return (
    <fieldset className="access-level-picker" aria-describedby={min > 1 ? hintId : undefined} onBlur={closeOnLeave}>
      <legend>{levelCopy.pickerLegend}</legend>
      {caption ? <strong className="access-level-caption">{caption}</strong> : null}
      <button type="button" className="access-level-toggle" aria-expanded={open} aria-controls={optionsId} onClick={() => setOpen((current) => !current)}>
        {levelCopy.pickerSummary(shown)} <span aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>
      <div className="access-level-options" id={optionsId} hidden={!open}>
        {ACCESS_LEVELS.map((level) => (
          <label key={level} className="access-level-option" title={level < min ? levelCopy.parentTitle(min) : undefined}>
            <input
              type="radio"
              name={name}
              value={level}
              checked={shown === level}
              disabled={level < min}
              aria-label={levelCopy.pickerOption(level)}
              onChange={() => onChange(level)}
              onClick={(event) => {
                if (event.detail > 0) setOpen(false);
              }}
            />
            <span className="access-level-digit" aria-hidden="true">{level}</span>
          </label>
        ))}
      </div>
      {min > 1 ? <p className="access-level-hint" id={hintId}>{levelCopy.parentHint(min)}</p> : null}
      {notice ? <p className="access-level-notice" role="status">{notice}</p> : null}
      {action}
    </fieldset>
  );
}
