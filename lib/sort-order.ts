export type Box = { left: number; top: number; width: number; height: number };

/** A row swaps with its target only once the pointer has crossed the target's middle in reading order (sideways within a row, downwards between rows), so rows of unequal height do not jump back and forth. */
export function passesTarget(own: Box, target: Box, pointer: { x: number; y: number }, forward: boolean): boolean {
  const sameRow = Math.abs(own.top - target.top) < 1;
  const middle = sameRow ? target.left + target.width / 2 : target.top + target.height / 2;
  const at = sameRow ? pointer.x : pointer.y;
  return forward ? at >= middle : at <= middle;
}
