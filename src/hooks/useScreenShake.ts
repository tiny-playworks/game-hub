import { useCallback } from 'react';

export function useScreenShake() {
  const shake = useCallback(() => {
    // Prevent adding multiple classes if already shaking
    if (document.body.classList.contains('animate-game-shake')) {
      document.body.classList.remove('animate-game-shake');
      // Trigger reflow
      void document.body.offsetWidth;
    }
    document.body.classList.add('animate-game-shake');

    setTimeout(() => {
      document.body.classList.remove('animate-game-shake');
    }, 300);
  }, []);

  return shake;
}
