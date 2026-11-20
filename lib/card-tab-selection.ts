// OWN-10 (owner 2026-11-20): the cards of a section are tabs; one card is selected. This is the pure rule of that choice, so a tab strip
// needs no state beyond "which id is selected and which ids were there at the last look".
export type CardTabGroup = { selected: string; known: readonly string[] };

/**
 * The selected id for the current ids of a group.
 * - first look: the first id (a stored choice is not needed yet);
 * - an id that was not there before: the new one (a card just added, restored by undo or moved in from another section becomes the selected one);
 * - the selected id is still there: it stays;
 * - the selected id is gone (deleted): the neighbour at its old place, or the last one.
 */
export function resolveCardTab(group: CardTabGroup | undefined, ids: readonly string[]): { active: string; group: CardTabGroup } {
  if (ids.length === 0) return { active: "", group: { selected: "", known: [] } };
  let active: string;
  if (!group || group.known.length === 0) {
    active = group && ids.includes(group.selected) ? group.selected : ids[0];
  } else {
    const grown = ids.filter((id) => !group.known.includes(id));
    if (grown.length > 0) active = grown[grown.length - 1];
    else if (ids.includes(group.selected)) active = group.selected;
    else {
      const was = group.known.indexOf(group.selected);
      active = ids[Math.min(Math.max(was, 0), ids.length - 1)];
    }
  }
  return { active, group: { selected: active, known: ids } };
}
