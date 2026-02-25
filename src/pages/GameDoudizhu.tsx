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
import { cn } from '@/lib/utils';

const GameDoudizhu = () => {
  const { t } = useLocale();
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
      ? '地主胜'
      : '农民胜'
    : isMyTurn(state)
      ? '轮到你出牌'
      : '对方出牌中…';

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
          三人斗地主简化版：单牌、对子、三张、三带一、炸弹、火箭。地主先出，轮到你时选牌后点「出牌」或「要不起」。
          {isLandlord(state) && ' （你是地主）'}
        </p>

        <div className="mb-4 flex justify-around text-sm">
          <span>下家: {state.hands[0].length} 张</span>
          <span>上家: {state.hands[2].length} 张</span>
        </div>

        {state.lastPlay && (
          <div className="mb-2 text-center text-sm">
            上一手: {state.lastPlay.hand.cards.map(cardLabel).join(' ')}
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
                {cardLabel(card)}
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
            出牌
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePass}
            disabled={!canPass(state)}
          >
            要不起
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
