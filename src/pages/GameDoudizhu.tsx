import { Crown, Lightbulb } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameResultOverlay } from '@/components/game/GameResultOverlay';
import { GameShell, StatPill } from '@/components/game/GameShell';
import { CardBack, CardFan } from '@/components/game/PlayingCard';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import {
  applyAITurn,
  type Card,
  canPass,
  canPlay,
  createInitialState,
  type DoudizhuState,
  findHint,
  handTypeLabel,
  isMyTurn,
  parseHand,
  passTurn,
  playHand,
  sortHandForDisplay,
} from '@/lib/doudizhu';
import { cn } from '@/lib/utils';

/** 座位：0=上家（左），1=你，2=下家（右） */
const SEAT_LEFT = 0;
const SEAT_ME = 1;
const SEAT_RIGHT = 2;

const AI_PLAY_MS = 780;

type SeatAction = { kind: 'play'; cards: Card[] } | { kind: 'pass' } | null;

const GameDoudizhu = () => {
  const { t } = useLocale();
  const [state, setState] = useState<DoudizhuState>(() => createInitialState());
  const [selected, setSelected] = useState<Card[]>([]);
  const [actions, setActions] = useState<Record<number, SeatAction>>({
    0: null,
    1: null,
    2: null,
  });
  const [noHint, setNoHint] = useState(false);
  const triedHints = useRef<Card[][]>([]);

  const myHand = useMemo(
    () => sortHandForDisplay(state.hands[SEAT_ME]),
    [state.hands],
  );
  const myTurn = isMyTurn(state);
  const selectedHand = useMemo(() => parseHand(selected), [selected]);
  const playable = selected.length > 0 && canPlay(state, selected);

  // AI 一次只走一步，让玩家看清每一家出了什么
  useEffect(() => {
    if (state.gameOver || state.currentPlayer === SEAT_ME) return;
    const who = state.currentPlayer;
    const id = setTimeout(() => {
      const next = applyAITurn(state);
      const played =
        next.lastPlay !== state.lastPlay && next.lastPlay?.player === who;
      setActions((prev) => ({
        ...prev,
        [who]: played
          ? { kind: 'play', cards: next.lastPlay?.hand.cards ?? [] }
          : { kind: 'pass' },
      }));
      setState(next);
    }, AI_PLAY_MS);
    return () => clearTimeout(id);
  }, [state]);

  // 新一轮开始（无人压制）时清掉桌面上的旧牌
  useEffect(() => {
    if (state.lastPlay === null) {
      setActions({ 0: null, 1: null, 2: null });
    }
    triedHints.current = [];
  }, [state.lastPlay]);

  const toggleCard = (card: Card) => {
    if (!myTurn) return;
    setNoHint(false);
    setSelected((prev) =>
      prev.includes(card) ? prev.filter((c) => c !== card) : [...prev, card],
    );
  };

  const handlePlay = () => {
    if (!playable) return;
    setActions((prev) => ({
      ...prev,
      [SEAT_ME]: { kind: 'play', cards: [...selected] },
    }));
    setState(playHand(state, selected));
    setSelected([]);
    triedHints.current = [];
  };

  const handlePass = () => {
    if (!canPass(state)) return;
    setActions((prev) => ({ ...prev, [SEAT_ME]: { kind: 'pass' } }));
    setState(passTurn(state));
    setSelected([]);
  };

  /** 反复点提示会依次给出不同的可行组合；一手都压不过时明确告诉玩家 */
  const handleHint = () => {
    if (!myTurn) return;
    const hint = findHint(state, triedHints.current);
    if (!hint) {
      const firstPass = triedHints.current.length === 0;
      triedHints.current = [];
      setSelected([]);
      setNoHint(firstPass);
      return;
    }
    setNoHint(false);
    triedHints.current = [...triedHints.current, hint];
    setSelected(hint);
  };

  const restart = useCallback(() => {
    setState(createInitialState());
    setSelected([]);
    setActions({ 0: null, 1: null, 2: null });
    triedHints.current = [];
  }, []);

  const iAmLandlord = state.landlord === SEAT_ME;
  const iWon =
    state.winner === null
      ? false
      : iAmLandlord
        ? state.winner === 0
        : state.winner === 1;

  const statusText = state.gameOver
    ? state.winner === 0
      ? t('game.doudizhu.status.landlordWin')
      : t('game.doudizhu.status.peasantWin')
    : myTurn
      ? t('game.doudizhu.status.yourTurn')
      : t('game.doudizhu.status.otherTurn');

  return (
    <GameShell
      title={t('game.doudizhu.name')}
      subtitle={t('game.doudizhu.rules')}
      status={
        <>
          <StatPill
            label={t('game.doudizhu.role')}
            value={
              iAmLandlord
                ? t('game.doudizhu.landlord')
                : t('game.doudizhu.peasant')
            }
            tone={iAmLandlord ? 'danger' : 'default'}
          />
          <StatPill
            label={t('game.doudizhu.remaining')}
            value={myHand.length}
          />
        </>
      }
      toolbar={
        <>
          <span
            className={cn(
              'game-pill',
              myTurn && !state.gameOver
                ? 'border-emerald-500/50 bg-emerald-50/90 text-emerald-700'
                : '',
            )}
          >
            {statusText}
          </span>
          <div className="ml-auto">
            <Button variant="outline" size="sm" onClick={restart}>
              {t('common.restart')}
            </Button>
          </div>
        </>
      }
      footer={t('game.doudizhu.tip')}
    >
      <div className="relative w-full max-w-2xl">
        <div className="table-felt rounded-2xl p-3 sm:p-5">
          {/* 两位对手 */}
          <div className="flex items-start justify-between gap-2">
            <OpponentSeat
              name={t('game.doudizhu.seatPrev')}
              count={state.hands[SEAT_LEFT].length}
              isLandlord={state.landlord === SEAT_LEFT}
              active={state.currentPlayer === SEAT_LEFT && !state.gameOver}
              action={actions[SEAT_LEFT]}
              passLabel={t('game.doudizhu.pass')}
            />
            <OpponentSeat
              name={t('game.doudizhu.seatNext')}
              count={state.hands[SEAT_RIGHT].length}
              isLandlord={state.landlord === SEAT_RIGHT}
              active={state.currentPlayer === SEAT_RIGHT && !state.gameOver}
              action={actions[SEAT_RIGHT]}
              passLabel={t('game.doudizhu.pass')}
              alignRight
            />
          </div>

          {/* 我方上一手 */}
          <div className="mt-3 flex min-h-[4.25rem] items-center justify-center">
            {actions[SEAT_ME]?.kind === 'play' ? (
              <CardFan cards={actions[SEAT_ME].cards} size="sm" animate />
            ) : actions[SEAT_ME]?.kind === 'pass' ? (
              <span className="rounded-full bg-black/30 px-3 py-1 text-xs text-white/85">
                {t('game.doudizhu.pass')}
              </span>
            ) : (
              <span className="text-xs text-white/40">
                {t('game.doudizhu.playArea')}
              </span>
            )}
          </div>
        </div>

        {/* 手牌：一行叠放，牌多时自动收窄，避免换行成一团 */}
        <div className="mt-4 flex min-h-[5.75rem] justify-center px-2 pt-3">
          <CardFan
            cards={myHand}
            selected={selected}
            disabledCards={!myTurn}
            onCardClick={toggleCard}
            reveal={myHand.length > 14 ? 1.1 : 1.5}
            animate
          />
        </div>

        {/* 出牌操作 */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleHint}
            disabled={!myTurn}
          >
            <Lightbulb className="size-3.5" />
            {t('common.hint')}
          </Button>
          <Button
            size="sm"
            onClick={handlePlay}
            disabled={!playable}
            className="min-w-24"
          >
            {t('game.doudizhu.play')}
            {selectedHand && playable && (
              <span className="ml-1 opacity-80">
                · {handTypeLabel(selectedHand.type)}
              </span>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePass}
            disabled={!canPass(state)}
          >
            {t('game.doudizhu.pass')}
          </Button>
          {selected.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
              {t('game.doudizhu.clear')}
            </Button>
          )}
        </div>

        {/* 出牌按钮为什么点不动，必须说清楚，否则玩家只会觉得界面卡了 */}
        {myTurn && selected.length > 0 && !playable && (
          <p className="mt-2 text-center text-xs text-rose-600">
            {selectedHand
              ? t('game.doudizhu.cannotBeat')
              : t('game.doudizhu.invalidHand')}
          </p>
        )}
        {myTurn && noHint && selected.length === 0 && (
          <p className="mt-2 text-center text-xs text-amber-700">
            {t('game.doudizhu.noPlayable')}
          </p>
        )}

        <GameResultOverlay
          open={state.gameOver}
          tone={iWon ? 'win' : 'lose'}
          title={iWon ? t('common.youWin') : t('common.youLose')}
          description={statusText}
          onRestart={restart}
        />
      </div>
    </GameShell>
  );
};

/** 对手席位：身份、剩余张数和他刚打出的牌 */
const OpponentSeat = ({
  name,
  count,
  isLandlord,
  active,
  action,
  passLabel,
  alignRight,
}: {
  name: string;
  count: number;
  isLandlord: boolean;
  active: boolean;
  action: SeatAction;
  passLabel: string;
  alignRight?: boolean;
}) => (
  <div
    className={cn(
      'flex min-w-0 flex-1 flex-col gap-1.5',
      alignRight ? 'items-end' : 'items-start',
    )}
  >
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors',
        active ? 'bg-amber-300/90 text-amber-950' : 'bg-black/25 text-white/85',
      )}
    >
      {isLandlord && <Crown className="size-3.5 text-amber-500" />}
      <span className="text-[11px] font-medium whitespace-nowrap">{name}</span>
      <CardBack className="!h-3.5 !w-2.5" />
      <span className="text-[11px] font-semibold tabular-nums">{count}</span>
    </div>

    <div className="flex min-h-[3.5rem] items-start">
      {action?.kind === 'play' ? (
        <CardFan
          cards={action.cards}
          size="sm"
          reveal={action.cards.length > 6 ? 0.95 : 1.3}
          animate
        />
      ) : action?.kind === 'pass' ? (
        <span className="rounded-full bg-black/30 px-2.5 py-1 text-[11px] text-white/80">
          {passLabel}
        </span>
      ) : null}
    </div>
  </div>
);

export default GameDoudizhu;
