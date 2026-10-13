import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLocale } from '@/contexts/LocaleContext';
import { getRankedState } from '@/lib/ranked';
import { useRiichiStore } from '@/pages/mahjong/japanese/store/riichiMatchStore';
import { confirmRankedExit } from './RankedStartButton';

/** BrowserRouter 的 SPA 返回/链接导航也必须处理弃赛。刷新/关闭不触发，保留续玩。 */
export function RankedNavigationGuard() {
  const { pathname } = useLocation();
  const previous = useRef(pathname);
  const navigate = useNavigate();
  const { t } = useLocale();
  useLayoutEffect(() => {
    const leftTable =
      previous.current === '/game/mahjong-japanese' &&
      pathname !== previous.current;
    previous.current = pathname;
    const store = useRiichiStore.getState();
    if (
      !leftTable ||
      store.view !== 'game' ||
      !store.match?.ranked ||
      !getRankedState().activeMatchId
    )
      return;
    if (!confirmRankedExit(t))
      navigate('/game/mahjong-japanese', { replace: true });
  }, [pathname, navigate, t]);
  return null;
}
