"use client";

import { useState } from "react";

function hsvToHex(hue: number, saturation: number, value: number) {
  const chroma = value * saturation;
  const segment = hue / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
  const [red, green, blue] = segment < 1 ? [chroma, secondary, 0]
    : segment < 2 ? [secondary, chroma, 0]
      : segment < 3 ? [0, chroma, secondary]
        : segment < 4 ? [0, secondary, chroma]
          : segment < 5 ? [secondary, 0, chroma]
            : [chroma, 0, secondary];
  const match = value - chroma;
  return `#${[red, green, blue].map((channel) => Math.round((channel + match) * 255).toString(16).padStart(2, "0")).join("")}`;
}

function hexToHsv(hex: string) {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#252827";
  const red = Number.parseInt(normalized.slice(1, 3), 16) / 255;
  const green = Number.parseInt(normalized.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(normalized.slice(5, 7), 16) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  const hue = delta === 0 ? 0
    : maximum === red ? 60 * (((green - blue) / delta) % 6)
      : maximum === green ? 60 * ((blue - red) / delta + 2)
        : 60 * ((red - green) / delta + 4);
  return { hue: (hue + 360) % 360, saturation: maximum === 0 ? 0 : delta / maximum, value: maximum };
}

export function CustomColorPicker({ group, title, color, onChange, onClose }: {
  group: "color" | "background" | "accent";
  title: string;
  color: string;
  onChange: (color: string) => void;
  onClose: () => void;
}) {
  const initial = hexToHsv(color);
  const [hue, setHue] = useState(initial.hue);
  const [saturation, setSaturation] = useState(initial.saturation);
  const [value, setValue] = useState(initial.value);
  const [hex, setHex] = useState(color.toUpperCase());

  const choose = (nextHue: number, nextSaturation: number, nextValue: number) => {
    setHue(nextHue);
    setSaturation(nextSaturation);
    setValue(nextValue);
    const nextHex = hsvToHex(nextHue, nextSaturation, nextValue).toUpperCase();
    setHex(nextHex);
    onChange(nextHex);
  };

  const chooseFromBoard = (event: React.PointerEvent<HTMLDivElement>) => {
    const board = event.currentTarget;
    const rect = board.getBoundingClientRect();
    const nextSaturation = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const nextValue = Math.max(0, Math.min(1, 1 - (event.clientY - rect.top) / rect.height));
    choose(hue, nextSaturation, nextValue);
  };

  return <div className="custom-color-picker" data-tab-group={group} role="group" aria-label={title}>
    <div className="custom-color-picker-head"><strong>{title}</strong><button type="button" onClick={onClose} aria-label="Закрыть выбор цвета">×</button></div>
    <div
      className="custom-color-board"
      style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hue} 100% 50%))` }}
      onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); chooseFromBoard(event); }}
      onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) chooseFromBoard(event); }}
    >
      <i style={{ left: `${saturation * 100}%`, top: `${(1 - value) * 100}%` }} />
    </div>
    <label className="custom-hue"><span>ТОН</span><input type="range" min="0" max="359" value={Math.round(hue)} onChange={(event) => choose(Number(event.target.value), saturation, value)} /></label>
    <div className="custom-color-value">
      <i style={{ backgroundColor: hex }} />
      <label><span>HEX</span><input value={hex} maxLength={7} onChange={(event) => {
        const nextHex = event.target.value.toUpperCase();
        setHex(nextHex);
        if (/^#[0-9A-F]{6}$/.test(nextHex)) {
          const next = hexToHsv(nextHex);
          setHue(next.hue);
          setSaturation(next.saturation);
          setValue(next.value);
          onChange(nextHex);
        }
      }} /></label>
    </div>
  </div>;
}
