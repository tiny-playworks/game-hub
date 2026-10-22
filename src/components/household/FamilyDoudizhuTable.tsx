import { useEffect, useMemo, useState } from 'react';
import { CardFan, PlayingCard } from '@/components/game/PlayingCard';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import {
  findPlayableHands,
  handBeats,
  parseHand,
  sortHandForDisplay,
} from '@/lib/doudizhu';
import { formatMessage } from '@/lib/i18n';
import type {
  DoudizhuRoomBoard,
  GameAction,
  GameRoomView,
} from '../../../shared/contracts/gameRoom';

export function FamilyDoudizhuTable({
  view,
  disabled,
  onAction,
}: {
  view: GameRoomView;
  disabled: boolean;
  onAction: (action: GameAction) => Promise<boolean>;
}) {
  const { t, locale } = useLocale();
  const board = view.board as DoudizhuRoomBoard;
  const [selected, setSelected] = useState<number[]>([]);
  useEffect(() => setSelected([]), [board.ply, view.room.matchId]);
  const cards = useMemo(() => sortHandForDisplay(board.hand), [board.hand]);
  const myTurn =
    !disabled &&
    board.currentSeat === view.viewerSeat &&
    view.room.status === 'playing';
  const parsed = parseHand(selected);
  const canPlay =
    parsed && (!board.lastPlay || handBeats(parsed, board.lastPlay.hand));
  const play = (action: GameAction) => {
    void onAction(action).then((ok) => {
      if (ok) setSelected([]);
    });
  };
  return (
    <div className="table-felt min-w-0 space-y-5 rounded-2xl p-3 text-stone-100 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-100">
        <span>
          {formatMessage(locale, 'gameRoom.deal', { count: board.dealNumber })}
        </span>
        <span>
          {board.spring ? `${t('gameRoom.spring')} · ` : ''}
          {formatMessage(locale, 'gameRoom.multiplier', {
            count: board.multiplier,
          })}
        </span>
      </div>
      <div className="flex min-h-20 items-center justify-center gap-2">
        <span className="text-xs">{t('gameRoom.bottom')}</span>
        {board.bottomCards.length ? (
          board.bottomCards.map((card) => (
            <PlayingCard key={card} card={card} locale={locale} size="sm" />
          ))
        ) : (
          <span className="tracking-[1em] text-2xl">▧▧▧</span>
        )}
      </div>
      {board.bids.length ? (
        <div className="flex flex-wrap justify-center gap-2 text-xs">
          {board.bids.map((bid) => {
            const bidder = view.room.seats[bid.seat];
            return (
              <span
                key={bid.seat}
                className="rounded-full bg-white/10 px-3 py-2"
              >
                {bidder.type === 'human' ? bidder.nickname : t('gameRoom.ai')} ·{' '}
                {bid.score
                  ? formatMessage(locale, 'gameRoom.bid', { score: bid.score })
                  : t('gameRoom.noBid')}
              </span>
            );
          })}
        </div>
      ) : null}
      <div className="flex min-h-24 items-center justify-center overflow-x-auto py-2">
        {board.lastPlay ? (
          <CardFan
            cards={board.lastPlay.hand.cards}
            locale={locale}
            size="sm"
            reveal={0.95}
          />
        ) : (
          <span className="text-sm text-emerald-200">
            {t(
              board.phase === 'bidding'
                ? 'gameRoom.bidding'
                : 'gameRoom.thinking',
            )}
          </span>
        )}
      </div>
      {board.phase === 'bidding' ? (
        <div className="flex flex-wrap justify-center gap-2">
          {[0, 1, 2, 3].map((score) => (
            <Button
              key={score}
              variant="secondary"
              className="min-h-11"
              disabled={!myTurn || (score > 0 && score <= board.highestBid)}
              onClick={() => play({ type: 'bid', score })}
            >
              {score
                ? formatMessage(locale, 'gameRoom.bid', { score })
                : t('gameRoom.noBid')}
            </Button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            className="min-h-11"
            disabled={!myTurn || !canPlay}
            onClick={() => play({ type: 'play', cards: selected })}
          >
            {t('gameRoom.play')}
          </Button>
          <Button
            variant="secondary"
            className="min-h-11"
            disabled={!myTurn || !board.canPass}
            onClick={() => play({ type: 'pass' })}
          >
            {t('gameRoom.pass')}
          </Button>
          <Button
            variant="secondary"
            className="min-h-11"
            disabled={!myTurn}
            onClick={() =>
              setSelected(
                findPlayableHands(cards, board.lastPlay?.hand ?? null)[0] ?? [],
              )
            }
          >
            {t('gameRoom.hint')}
          </Button>
          <Button
            variant="secondary"
            className="min-h-11"
            disabled={!selected.length}
            onClick={() => setSelected([])}
          >
            {t('gameRoom.clear')}
          </Button>
        </div>
      )}
      <div className="overflow-x-auto px-1 pb-3 pt-5">
        <div className="flex min-w-fit flex-wrap justify-center gap-1.5">
          {cards.map((card) => (
            <PlayingCard
              key={card}
              card={card}
              locale={locale}
              selected={selected.includes(card)}
              disabled={!myTurn || board.phase === 'bidding'}
              onClick={() =>
                setSelected((previous) =>
                  previous.includes(card)
                    ? previous.filter((item) => item !== card)
                    : [...previous, card],
                )
              }
              className="!h-16 !w-11 sm:!h-20 sm:!w-14"
            />
          ))}
        </div>
      </div>
      <p className="text-center text-xs text-emerald-200">
        {t('gameRoom.selectCards')}
      </p>
    </div>
  );
}
