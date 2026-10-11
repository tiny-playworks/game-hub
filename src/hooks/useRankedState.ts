import { useEffect, useState } from 'react';
import { getRankedState, RANKED_CHANGED_EVENT } from '@/lib/ranked';
export function useRankedState() {
  const [state, setState] = useState(getRankedState);
  useEffect(() => {
    const refresh = () => setState(getRankedState());
    window.addEventListener(RANKED_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    refresh();
    return () => { window.removeEventListener(RANKED_CHANGED_EVENT, refresh); window.removeEventListener('storage', refresh); };
  }, []);
  return state;
}
