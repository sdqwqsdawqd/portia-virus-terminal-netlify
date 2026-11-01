"use client";

import { classificationOptions, type Virus } from "@/lib/portia-content";

export function ClassificationField({ label, classificationKey, value, onChange }: {
  label: string;
  classificationKey: keyof Virus["classification"];
  value: string;
  onChange: (value: string) => void;
}) {
  const options = classificationOptions[classificationKey] as readonly { value: string; level?: number }[];
  const selected = options.find((option) => option.value === value);
  const level = selected?.level;

  return <label className="editor-field classification-editor-field">
    <span>{label}</span>
    <div className={`classification-select-wrap${level ? ` level-${level}` : ""}`}>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => {
          const optionLevel = option.level;
          return <option key={option.value} value={option.value}>{optionLevel ? `${optionLevel} уровень — ` : ""}{option.value}</option>;
        })}
      </select>
      {level ? <strong>УРОВЕНЬ {level}</strong> : <strong className="neutral">МЕТОД</strong>}
    </div>
  </label>;
}
