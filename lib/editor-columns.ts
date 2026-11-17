// D-40: editor section cards run top to bottom in columns of five; the sixth card starts a new column on the right.
// Pure layout arithmetic, no DOM. Every entry keeps its index in the source list, which is the stored order.

export const EDITOR_COLUMN_SIZE = 5;

export type ColumnEntry<T> = { item: T; index: number };

export function columnMajor<T>(items: readonly T[], perColumn: number = EDITOR_COLUMN_SIZE): ColumnEntry<T>[][] {
  const size = Number.isFinite(perColumn) ? Math.max(1, Math.floor(perColumn)) : 1;
  const columns: ColumnEntry<T>[][] = [];
  items.forEach((item, index) => {
    const column = Math.floor(index / size);
    (columns[column] ??= []).push({ item, index });
  });
  return columns;
}
