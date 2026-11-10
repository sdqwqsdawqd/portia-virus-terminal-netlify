const MOSCOW_ZONE = "Europe/Moscow";
const MONTHS = ["янв.", "февр.", "мар.", "апр.", "мая", "июн.", "июл.", "авг.", "сент.", "окт.", "нояб.", "дек."] as const;

function numericParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: MOSCOW_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

export function formatMoscow(iso: string, now: Date): string | null {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime()) || !Number.isFinite(now.getTime())) return null;
  const value = numericParts(date);
  const current = numericParts(now);
  const month = MONTHS[Number(value.month) - 1];
  if (!month || !value.day || !value.year || !value.hour || !value.minute || !current.year) return null;
  const year = value.year === current.year ? "" : ` ${value.year} г.`;
  return `${Number(value.day)} ${month}${year}, ${value.hour}:${value.minute}`;
}

export function pluralZayavka(value: number): "заявку" | "заявки" | "заявок" {
  const n = Math.abs(Math.trunc(value));
  const hundred = n % 100;
  const ten = n % 10;
  if (ten === 1 && hundred !== 11) return "заявку";
  if (ten >= 2 && ten <= 4 && (hundred < 12 || hundred > 14)) return "заявки";
  return "заявок";
}
