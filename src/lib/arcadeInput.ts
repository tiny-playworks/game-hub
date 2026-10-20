/** Keep typing and native button activation separate from gameplay shortcuts. */
export function blocksArcadeShortcut(event: KeyboardEvent): boolean {
  if (!(event.target instanceof Element)) return false;
  if (event.target.closest('input, textarea, select, [contenteditable="true"]'))
    return true;
  return (
    (event.code === 'Space' || event.code === 'Enter') &&
    Boolean(event.target.closest('button, a, [role="button"]'))
  );
}
