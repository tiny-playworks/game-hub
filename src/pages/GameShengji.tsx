import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
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

const SUIT_NAMES = ['黑桃', '红桃', '梅花', '方片'];

const GameShengji = () => {
  const { t } = useLocale();
  const [state, setState] = useState<ShengjiState>(createInitialState);

  useEffect(() => {
    if (state.roundOver || state.currentPlayer === 0) return;
    setState((s) => runAIUntilMyTurn(s));
  }, [state.currentPlayer, state.roundOver]);

  const myHand = state.hands[0];
  const validPlays = getValidPlays(state, 0);
  const statusText = state.roundOver
    ? state.defenderUpgrade
      ? `闲家得分 ${state.teamScores[1]}，升级`
      : `庄家守庄，闲家 ${state.teamScores[1]} 分`
    : isMyTurn(state)
      ? '轮到你出牌'
      : '对方出牌中…';

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
          升级入门：四人两对（你与对家一队），单副牌单张跟牌。庄家扣底，主牌可毙副牌，闲家得分≥40
          升级。主花色：
          {state.trumpSuit >= 0 ? SUIT_NAMES[state.trumpSuit] : '—'}
        </p>

        <div className="mb-2 flex justify-around text-sm">
          <span>
            庄家队: {state.teamScores[0]} 分
            {state.dealer === 0 || state.dealer === 2 ? '（你方）' : ''}
          </span>
          <span>
            闲家队: {state.teamScores[1]} 分
            {state.dealer === 1 || state.dealer === 3 ? '（你方）' : ''}
          </span>
        </div>

        {state.currentTrick.length > 0 && (
          <div className="mb-2 rounded border border-border bg-muted/30 p-2 text-sm">
            当前墩: {state.currentTrick.map(cardLabel).join(' ')}
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
                {cardLabel(card)}
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
