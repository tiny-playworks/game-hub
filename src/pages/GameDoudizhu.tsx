import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import {
  canPass,
  canPlay,
  cardLabel,
  createInitialState,
  type DoudizhuState,
  isLandlord,
  isMyTurn,
  passTurn,
  playHand,
  runAIUntilMyTurn,
} from '@/lib/doudizhu';
import { formatMessage } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const GameDoudizhu = () => {
  const { locale, t } = useLocale();
  const [state, setState] = useState<DoudizhuState>(createInitialState);
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    if (state.gameOver || state.currentPlayer === 1) return;
    setState((s) => runAIUntilMyTurn(s));
  }, [state.currentPlayer, state.gameOver]);

  const myHand = state.hands[1];
  const rank = (c: number) => (c === 52 ? 13 : c === 53 ? 14 : c % 13);
  const sortedForDisplay = [...Array(myHand.length).keys()].sort(
    (a, b) => rank(myHand[a]) - rank(myHand[b]),
  );

  const toggleCard = (idx: number) => {
    if (!isMyTurn(state) || state.gameOver) return;
    setSelected((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx],
    );
  };

  const handlePlay = () => {
    if (!isMyTurn(state) || state.gameOver) return;
    const cards = selected.map((i) => myHand[i]);
    if (cards.length === 0) return;
    if (!canPlay(state, cards)) return;
    const next = playHand(state, cards);
    setState(runAIUntilMyTurn(next));
    setSelected([]);
  };

  const handlePass = () => {
    if (!canPass(state)) return;
    const next = passTurn(state);
    setState(runAIUntilMyTurn(next));
  };

  const restart = () => {
    setState(createInitialState());
    setSelected([]);
  };

  const statusText = state.gameOver
    ? state.winner === 0
      ? t('game.doudizhu.status.landlordWin')
      : t('game.doudizhu.status.peasantWin')
    : isMyTurn(state)
      ? t('game.doudizhu.status.yourTurn')
      : t('game.doudizhu.status.otherTurn');

  const selectedCards = selected.map((i) => myHand[i]);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          ← {t('common.backToList')}
        </Link>
        <span className="text-sm text-muted-foreground">{statusText}</span>
      </header>

      <main className="flex flex-col p-4">
        <p className="mb-2 text-sm text-muted-foreground">
          {t('game.doudizhu.rules')}
          {isLandlord(state) && ` (${t('game.doudizhu.isLandlord')})`}
        </p>

        <div className="mb-4 flex justify-around text-sm">
          <span>
            {formatMessage(locale, 'game.doudizhu.nextPlayer', {
              count: state.hands[0].length,
            })}
          </span>
          <span>
            {formatMessage(locale, 'game.doudizhu.prevPlayer', {
              count: state.hands[2].length,
            })}
          </span>
        </div>

        {state.lastPlay && (
          <div className="mb-2 text-center text-sm">
            {formatMessage(locale, 'game.doudizhu.lastPlay', {
              cards: state.lastPlay.hand.cards
                .map((c) => cardLabel(c, locale))
                .join(' '),
            })}
          </div>
        )}

        <div className="flex-1" />

        <div className="flex flex-wrap justify-center gap-1 border-t border-border bg-muted/30 py-4">
          {sortedForDisplay.map((idx) => {
            const card = myHand[idx];
            const isSelected = selected.includes(idx);
            return (
              <button
                key={idx}
                type="button"
                onClick={() => toggleCard(idx)}
                disabled={!isMyTurn(state) || state.gameOver}
                className={cn(
                  'rounded border px-2 py-1 text-sm transition',
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card hover:bg-muted',
                )}
              >
                {cardLabel(card, locale)}
              </button>
            );
          })}
        </div>

        <div className="flex justify-center gap-2 py-2">
          <Button
            variant="default"
            size="sm"
            onClick={handlePlay}
            disabled={
              !isMyTurn(state) ||
              state.gameOver ||
              selected.length === 0 ||
              !canPlay(state, selectedCards)
            }
          >
            {t('game.doudizhu.play')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePass}
            disabled={!canPass(state)}
          >
            {t('game.doudizhu.pass')}
          </Button>
          <Button variant="outline" size="sm" onClick={restart}>
            {t('common.restart')}
          </Button>
          <Link to="/">
            <Button variant="ghost" size="sm">
              {t('common.backList')}
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
};

export default GameDoudizhu;
