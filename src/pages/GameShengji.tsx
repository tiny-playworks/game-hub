import { useCallback, useEffect, useMemo, useState } from 'react';
import { GameResultOverlay } from '@/components/game/GameResultOverlay';
import { GameShell, StatPill } from '@/components/game/GameShell';
import { CardBack, PlayingCard } from '@/components/game/PlayingCard';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { formatMessage } from '@/lib/i18n';
import {
  applyAITurn,
  type Card,
  cardPoints,
  createInitialState,
  getRank,
  getSuit,
  getValidPlays,
  isMyTurn,
  isTrump,
  partner,
  playCard,
  type ShengjiState,
  teamIndex,
  trumpOrder,
} from '@/lib/shengji';
import { cn } from '@/lib/utils';

const SUIT_KEYS = [
  'game.shengji.spade',
  'game.shengji.heart',
  'game.shengji.club',
  'game.shengji.diamond',
];
const SUIT_SYMBOLS = ['♠', '♥', '♣', '♦'];

/** 每一墩之间的停顿，让玩家看清四张牌和谁收走了 */
const TRICK_HOLD_MS = 1400;
const AI_PLAY_MS = 620;

const GameShengji = () => {
  const { locale, t } = useLocale();
  const [state, setState] = useState<ShengjiState>(createInitialState);
  const [holding, setHolding] = useState(false);

  const myHand = state.hands[0];
  const validPlays = useMemo(() => getValidPlays(state, 0), [state]);
  const validSet = useMemo(() => new Set(validPlays), [validPlays]);

  // 一墩打完后先停一下再继续，否则第四张牌一落地整墩就消失了
  useEffect(() => {
    if (!state.lastTrick || state.roundOver) return;
    setHolding(true);
    const id = setTimeout(() => setHolding(false), TRICK_HOLD_MS);
    return () => clearTimeout(id);
  }, [state.lastTrick, state.roundOver]);

  // AI 一次只出一张，让出牌过程可见
  useEffect(() => {
    if (state.roundOver || holding) return;
    if (state.currentPlayer === 0) return;
    const id = setTimeout(() => {
      setState((s) => applyAITurn(s));
    }, AI_PLAY_MS);
    return () => clearTimeout(id);
  }, [state, holding]);

  const restart = useCallback(() => {
    setState(createInitialState());
    setHolding(false);
  }, []);

  const handlePlay = (card: Card) => {
    if (!isMyTurn(state) || holding || !validSet.has(card)) return;
    setState(playCard(state, 0, card));
  };

  const sortedHand = useMemo(
    () =>
      [...myHand].sort((a, b) => {
        const aTrump = isTrump(a, state.trumpSuit, state.levelRank);
        const bTrump = isTrump(b, state.trumpSuit, state.levelRank);
        if (aTrump !== bTrump) return aTrump ? 1 : -1;
        if (aTrump && bTrump)
          return (
            trumpOrder(a, state.levelRank) - trumpOrder(b, state.levelRank)
          );
        const sa = getSuit(a);
        const sb = getSuit(b);
        if (sa !== sb) return sa - sb;
        return getRank(a) - getRank(b);
      }),
    [myHand, state.trumpSuit, state.levelRank],
  );

  /** 展示中的一墩：优先回放刚打完的那墩 */
  const shownTrick =
    holding && state.lastTrick
      ? { cards: state.lastTrick.cards, leader: state.lastTrick.leader }
      : { cards: state.currentTrick, leader: state.trickLeader };

  const cardBySeat = new Map<number, Card>();
  shownTrick.cards.forEach((card, index) => {
    cardBySeat.set((shownTrick.leader + index) % 4, card);
  });

  const trumpLabel =
    state.trumpSuit < 0
      ? '—'
      : `${SUIT_SYMBOLS[state.trumpSuit]} ${t(SUIT_KEYS[state.trumpSuit])}`;

  const myTeam = teamIndex(0);
  const dealerTeam = teamIndex(state.dealer);
  const iAmDealerTeam = myTeam === dealerTeam;
  /** 我方是庄家队时要守住 40 分，是闲家队时要攒到 40 分 */
  const iWon = iAmDealerTeam ? !state.defenderUpgrade : state.defenderUpgrade;

  const statusText = state.roundOver
    ? state.defenderUpgrade
      ? formatMessage(locale, 'game.shengji.status.upgrade', {
          score: state.teamScores[1],
        })
      : formatMessage(locale, 'game.shengji.status.defended', {
          score: state.teamScores[1],
        })
    : holding
      ? t('game.shengji.collecting')
      : isMyTurn(state)
        ? t('game.shengji.status.yourTurn')
        : t('game.shengji.status.otherTurn');

  const seatName = (seat: number) => {
    if (seat === 0) return t('game.shengji.seatYou');
    if (seat === partner(0)) return t('game.shengji.seatPartner');
    return seat === 1
      ? t('game.shengji.seatRight')
      : t('game.shengji.seatLeft');
  };

  return (
    <GameShell
      title={t('game.shengji.name')}
      subtitle={t('game.shengji.rules')}
      status={
        <>
          <StatPill label={t('game.shengji.trump')} value={trumpLabel} />
          <StatPill
            label={t('game.shengji.defenderPoints')}
            value={`${state.teamScores[1]} / 40`}
            tone={state.teamScores[1] >= 40 ? 'danger' : 'default'}
          />
          <StatPill
            label={t('game.shengji.trickNo')}
            value={`${state.tricksPlayed}/13`}
          />
        </>
      }
      toolbar={
        <>
          <span className="game-pill">
            {iAmDealerTeam
              ? t('game.shengji.youAreDealerTeam')
              : t('game.shengji.youAreDefenderTeam')}
          </span>
          <span
            className={cn(
              'game-pill',
              !state.roundOver && isMyTurn(state) && !holding
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
      footer={t('game.shengji.tip')}
    >
      <div className="relative w-full max-w-2xl">
        <div className="table-felt grid grid-cols-[auto_1fr_auto] grid-rows-[auto_1fr_auto] gap-2 rounded-2xl p-3 sm:p-5">
          {/* 对家 */}
          <div className="col-span-3 flex justify-center">
            <SeatBadge
              name={seatName(2)}
              count={state.hands[2].length}
              active={state.currentPlayer === 2 && !state.roundOver}
              teammate
            />
          </div>

          {/* 左手 */}
          <div className="flex items-center">
            <SeatBadge
              name={seatName(3)}
              count={state.hands[3].length}
              active={state.currentPlayer === 3 && !state.roundOver}
              vertical
            />
          </div>

          {/* 出牌区 */}
          <div className="relative grid min-h-[8.5rem] grid-cols-3 grid-rows-3 place-items-center gap-1 sm:min-h-[9.5rem]">
            <TrickSlot
              card={cardBySeat.get(2)}
              className="col-start-2 row-start-1"
            />
            <TrickSlot
              card={cardBySeat.get(3)}
              className="col-start-1 row-start-2"
            />
            <TrickSlot
              card={cardBySeat.get(1)}
              className="col-start-3 row-start-2"
            />
            <TrickSlot
              card={cardBySeat.get(0)}
              className="col-start-2 row-start-3"
            />
            {holding && state.lastTrick && (
              <div className="col-start-2 row-start-2 text-center text-[11px] font-medium text-white/90">
                <p>{seatName(state.lastTrick.winner)}</p>
                <p className="opacity-80">
                  {state.lastTrick.points > 0
                    ? `+${state.lastTrick.points}`
                    : t('game.shengji.noPoints')}
                </p>
              </div>
            )}
          </div>

          {/* 右手 */}
          <div className="flex items-center">
            <SeatBadge
              name={seatName(1)}
              count={state.hands[1].length}
              active={state.currentPlayer === 1 && !state.roundOver}
              vertical
            />
          </div>

          <div className="col-span-3 h-1" />
        </div>

        {/* 手牌：主牌金框、分牌绿框，本墩不能出的会变灰 */}
        <div className="mt-3 flex min-h-[5.5rem] justify-center px-1 pt-3">
          <div className="flex items-end">
            {sortedHand.map((card, index) => {
              const canPlayThis =
                isMyTurn(state) && !holding && validSet.has(card);
              return (
                <PlayingCard
                  key={card}
                  card={card}
                  onClick={() => handlePlay(card)}
                  disabled={!canPlayThis}
                  dimmed={isMyTurn(state) && !holding && !validSet.has(card)}
                  className={cn(
                    'animate-card-deal',
                    isTrump(card, state.trumpSuit, state.levelRank) &&
                      'ring-1 ring-amber-400/80',
                    cardPoints(card) > 0 &&
                      'shadow-[0_0_0_1.5px_rgba(5,150,105,0.65)]',
                  )}
                  style={{
                    marginLeft: index === 0 ? 0 : '-1.35rem',
                    animationDelay: `${Math.min(index, 12) * 18}ms`,
                  }}
                />
              );
            })}
          </div>
        </div>

        <GameResultOverlay
          open={state.roundOver}
          tone={iWon ? 'win' : 'lose'}
          title={iWon ? t('common.youWin') : t('common.youLose')}
          description={statusText}
          detail={
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs opacity-70">
                    {t('game.shengji.dealerTeamShort')}
                  </p>
                  <p className="text-lg font-semibold text-slate-900">
                    {state.teamScores[0]}
                  </p>
                </div>
                <div>
                  <p className="text-xs opacity-70">
                    {t('game.shengji.defenderTeamShort')}
                  </p>
                  <p className="text-lg font-semibold text-slate-900">
                    {state.teamScores[1]}
                  </p>
                </div>
              </div>
              {state.bottomBonus > 0 && (
                <p className="text-xs text-emerald-700">
                  {formatMessage(locale, 'game.shengji.bottomBonus', {
                    score: state.bottomBonus,
                  })}
                </p>
              )}
            </div>
          }
          onRestart={restart}
        />
      </div>
    </GameShell>
  );
};

/** 出牌区的一个位置，空位画一个虚框保持布局稳定 */
const TrickSlot = ({
  card,
  className,
}: {
  card: Card | undefined;
  className?: string;
}) =>
  card === undefined ? (
    <div
      className={cn(
        'h-[3.25rem] w-[2.25rem] rounded-md border border-dashed border-white/20',
        className,
      )}
    />
  ) : (
    <PlayingCard
      card={card}
      size="sm"
      className={cn('animate-card-deal', className)}
    />
  );

/** 对手席位：名字 + 剩余张数 + 当前是否轮到他 */
const SeatBadge = ({
  name,
  count,
  active,
  teammate,
  vertical,
}: {
  name: string;
  count: number;
  active: boolean;
  teammate?: boolean;
  vertical?: boolean;
}) => (
  <div
    className={cn(
      'flex items-center gap-2 rounded-full px-2.5 py-1 transition-colors',
      vertical && 'flex-col gap-1 rounded-2xl px-1.5 py-2',
      active ? 'bg-amber-300/90 text-amber-950' : 'bg-black/25 text-white/85',
    )}
  >
    <span className="text-[11px] font-medium whitespace-nowrap">
      {name}
      {teammate ? ' ★' : ''}
    </span>
    <span className="flex items-center gap-1">
      <CardBack className="!h-3.5 !w-2.5" />
      <span className="text-[11px] font-semibold tabular-nums">{count}</span>
    </span>
  </div>
);

export default GameShengji;
