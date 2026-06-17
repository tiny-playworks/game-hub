import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { formatMessage } from '@/lib/i18n';
import {
  cardLabel,
  createInitialState,
  getValidPlays,
  isMyTurn,
  playCard,
  runAIUntilMyTurn,
  type ShengjiState,
} from '@/lib/shengji';
import { cn } from '@/lib/utils';

const GameShengji = () => {
  const { locale, t } = useLocale();
  const [state, setState] = useState<ShengjiState>(createInitialState);

  useEffect(() => {
    if (state.roundOver || state.currentPlayer === 0) return;
    setState((s) => runAIUntilMyTurn(s));
  }, [state.currentPlayer, state.roundOver]);

  const myHand = state.hands[0];
  const validPlays = getValidPlays(state, 0);

  const statusText = state.roundOver
    ? state.defenderUpgrade
      ? formatMessage(locale, 'game.shengji.status.upgrade', {
          score: state.teamScores[1],
        })
      : formatMessage(locale, 'game.shengji.status.defended', {
          score: state.teamScores[1],
        })
    : isMyTurn(state)
      ? t('game.shengji.status.yourTurn')
      : t('game.shengji.status.otherTurn');

  const sortedHand = [...myHand].sort((a, b) => {
    const sa = a >= 52 ? 4 : Math.floor(a / 13);
    const sb = b >= 52 ? 4 : Math.floor(b / 13);
    if (sa !== sb) return sa - sb;
    if (a >= 52 && b >= 52) return a - b;
    return (a % 13) - (b % 13);
  });

  const handlePlay = (card: number) => {
    if (!isMyTurn(state) || state.roundOver) return;
    if (!validPlays.includes(card)) return;
    const next = playCard(state, 0, card);
    setState(runAIUntilMyTurn(next));
  };

  const restart = () => {
    setState(createInitialState());
  };

  const getTrumpSuitLabel = () => {
    if (state.trumpSuit < 0) return '—';
    const suitKeys = [
      'game.shengji.spade',
      'game.shengji.heart',
      'game.shengji.club',
      'game.shengji.diamond',
    ];
    return t(suitKeys[state.trumpSuit]);
  };

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
          {t('game.shengji.rules')}
          {getTrumpSuitLabel()}
        </p>

        <div className="mb-2 flex justify-around text-sm">
          <span>
            {formatMessage(locale, 'game.shengji.landlordTeam', {
              score: state.teamScores[0],
            })}
            {state.dealer === 0 || state.dealer === 2
              ? t('game.shengji.yourTeam')
              : ''}
          </span>
          <span>
            {formatMessage(locale, 'game.shengji.peasantTeam', {
              score: state.teamScores[1],
            })}
            {state.dealer === 1 || state.dealer === 3
              ? t('game.shengji.yourTeam')
              : ''}
          </span>
        </div>

        {state.currentTrick.length > 0 && (
          <div className="mb-2 rounded border border-border bg-muted/30 p-2 text-sm">
            {formatMessage(locale, 'game.shengji.currentTrick', {
              cards: state.currentTrick
                .map((c) => cardLabel(c, locale))
                .join(' '),
            })}
          </div>
        )}

        <div className="flex-1" />

        <div className="flex flex-wrap justify-center gap-1 border-t border-border bg-muted/30 py-4">
          {sortedHand.map((card) => {
            const canPlayThis = validPlays.includes(card);
            return (
              <button
                key={card}
                type="button"
                onClick={() => handlePlay(card)}
                disabled={!isMyTurn(state) || state.roundOver || !canPlayThis}
                className={cn(
                  'rounded border px-2 py-1 text-sm transition',
                  canPlayThis && isMyTurn(state) && !state.roundOver
                    ? 'border-primary bg-primary/20 hover:bg-primary/30'
                    : 'border-border bg-card text-muted-foreground',
                )}
              >
                {cardLabel(card, locale)}
              </button>
            );
          })}
        </div>

        <div className="flex justify-center gap-2 py-2">
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

export default GameShengji;
