"use client";

import { useId } from "react";
import { ACCESS_LEVELS, requiredLevelOf, type AccessLevel } from "@/lib/access-levels";
import { levelCopy } from "@/lib/level-copy";

// Phase 24, D-16 / LVL-02: the one control that sets a needed access level (1..5) in every editor form. Native radios under a
// fieldset: Tab enters the group, the arrows change the value, no key handler of our own. The shown value is the effective
// one: max(own level, parent level); an empty or damaged value is shown by requiredLevelOf (no field at all is level 1).
export function LevelPicker({ name, value, min = 1, caption, notice, onChange }: {
  name: string;
  value: unknown;
  min?: AccessLevel;
  caption?: string;
  notice?: string;
  onChange: (level: AccessLevel) => void;
}) {
  const hintId = useId();
  const shown = Math.max(requiredLevelOf(value), min);
  return (
    <fieldset className="access-level-picker" aria-describedby={min > 1 ? hintId : undefined}>
      {caption ? <strong className="access-level-caption">{caption}</strong> : null}
      <legend>{levelCopy.pickerLegend}</legend>
      <div className="access-level-options">
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
            />
            <span className="access-level-digit" aria-hidden="true">{level}</span>
          </label>
        ))}
      </div>
      {min > 1 ? <p className="access-level-hint" id={hintId}>{levelCopy.parentHint(min)}</p> : null}
      {notice ? <p className="access-level-notice" role="status">{notice}</p> : null}
    </fieldset>
  );
}
