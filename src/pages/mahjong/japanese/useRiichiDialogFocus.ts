import { useRef } from 'react';

/** 自动出现的对话框没有 Radix Trigger；关闭时恢复可用的原焦点。 */
export function useRiichiDialogFocus() {
  const previous = useRef<HTMLElement | null>(
    typeof document === 'undefined'
      ? null
      : (document.activeElement as HTMLElement),
  );
  return (event: Event) => {
    event.preventDefault();
    if (document.querySelector('[role="dialog"][data-state="open"]')) return;
    const target = previous.current;
    if (
      target?.isConnected &&
      target !== document.body &&
      !target.closest('[role="dialog"]') &&
      !target.matches(':disabled')
    ) {
      target.focus();
    } else {
      document
        .querySelector<HTMLElement>(
          '.riichi-header-menu, .riichi-lobby-import input',
        )
        ?.focus();
    }
  };
}
