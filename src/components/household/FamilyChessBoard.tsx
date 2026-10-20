import { useEffect, useMemo, useState } from 'react';
import { IntersectionBoard } from '@/components/game/IntersectionBoard';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { formatMessage } from '@/lib/i18n';
import { getPieceLabel, getSafeMoves } from '@/lib/xiangqi';
import { cn } from '@/lib/utils';
import type { GameAction, GameRoomView, GomokuRoomBoard, XiangqiRoomBoard } from '../../../shared/contracts/gameRoom';

export function FamilyChessBoard({ view, disabled, onAction }: {
  view: GameRoomView; disabled: boolean; onAction: (action: GameAction) => Promise<boolean>;
}) {
  const { t, locale } = useLocale();
  const board = view.board as GomokuRoomBoard | XiangqiRoomBoard;
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [move, setMove] = useState<GameAction | null>(null);
  const gomoku = board.gameId === 'gomoku';
  const flipped = !gomoku && view.viewerSeat !== null && view.viewerSeat !== view.room.firstSeat;
  const actual = (row: number, col: number): [number, number] => flipped ? [9 - row, 8 - col] : [row, col];
  const canMove = !disabled && board.currentSeat === view.viewerSeat && view.room.status === 'playing';
  useEffect(() => { setSelected(null); setMove(null); }, [board.ply, view.room.matchId]);
  const targets = useMemo(() => !gomoku && selected
    ? getSafeMoves((board as XiangqiRoomBoard).board, ...selected) : [], [board, selected, gomoku]);
  const point = (row: number, col: number) => {
    if (!canMove) return;
    const [r, c] = actual(row, col);
    if (gomoku) {
      if (!board.board[r * 15 + c]) setMove({ type: 'place', index: r * 15 + c });
      return;
    }
    const piece = board.board[r][c];
    const side = view.viewerSeat === view.room.firstSeat ? 'red' : 'black';
    if (piece?.side === side) { setSelected([r, c]); setMove(null); }
    else if (selected && targets.some(([tr, tc]) => tr === r && tc === c)) setMove({ type: 'move', from: selected, to: [r, c] });
  };
  return <div className="flex min-w-0 flex-col items-center gap-3">
    <IntersectionBoard cols={gomoku ? 15 : 9} rows={gomoku ? 15 : 10}
      cell={gomoku ? 'clamp(16px, calc((100vw - 86px) / 15.24), 34px)' : 'clamp(26px, calc((100vw - 86px) / 9.24), 48px)'}
      showGridLines={gomoku} onPointClick={point} isPointDisabled={() => !canMove}
      pointLabel={(row, col) => {
        const [r, c] = actual(row, col);
        const label = formatMessage(locale, 'gameRoom.point', { row: r + 1, col: c + 1 });
        return !gomoku && board.board[r][c] ? `${label} ${getPieceLabel(board.board[r][c]!)}` : label;
      }}
      underlay={!gomoku ? <g stroke="rgba(87,52,15,.7)" strokeWidth={0.03} fill="none">
        {Array.from({ length: 10 }, (_, r) => <path key={`h${r}`} d={`M0 ${r} H8`} />)}
        {Array.from({ length: 9 }, (_, c) => <path key={`v${c}`} d={c === 0 || c === 8 ? `M${c} 0 V9` : `M${c} 0 V4 M${c} 5 V9`} />)}
        {[0, 7].map((r) => <path key={r} d={`M3 ${r} L5 ${r + 2} M5 ${r} L3 ${r + 2}`} />)}
        <text x={2} y={4.65} stroke="none" fill="rgba(87,52,15,.7)" textAnchor="middle" fontSize={0.45}>楚河</text>
        <text x={6} y={4.65} stroke="none" fill="rgba(87,52,15,.7)" textAnchor="middle" fontSize={0.45}>漢界</text>
      </g> : undefined}
      renderPoint={(row, col) => {
        const [r, c] = actual(row, col);
        const pending = move?.type === 'place' ? move.index === r * 15 + c : move?.type === 'move' && move.to[0] === r && move.to[1] === c;
        if (gomoku) {
          const index = r * 15 + c;
          const stone = board.board[index];
          return stone ? <span className={cn('relative block size-[85%] rounded-full', stone === 'B' ? 'stone-black' : 'stone-white', board.winningLine.includes(index) && 'ring-2 ring-rose-500')}>
            {board.lastMove === index ? <span className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-500" /> : null}
          </span> : pending ? <span className="size-[75%] rounded-full border-2 border-rose-600 bg-rose-400/30" /> : null;
        }
        const piece = board.board[r][c];
        const picked = selected?.[0] === r && selected[1] === c;
        return piece ? <span className={cn('flex size-[88%] items-center justify-center rounded-full border-2 border-amber-800/60 bg-[#f4deb0] font-serif text-[clamp(17px,4.6vw,28px)] font-bold shadow-md', piece.side === 'red' ? 'text-red-700' : 'text-slate-900', (picked || pending) && 'ring-2 ring-sky-500')}>
          {getPieceLabel(piece)}
        </span> : <span className={cn('rounded-full', pending ? 'size-1/2 border-2 border-rose-600 bg-rose-400/30' : targets.some(([tr, tc]) => tr === r && tc === c) ? 'size-1/4 bg-sky-600/70' : '')} />;
      }} />
    <div className="flex min-h-11 flex-wrap items-center justify-center gap-2">
      <p className="text-xs text-muted-foreground">{t('gameRoom.moveHint')}</p>
      <Button className="min-h-11" disabled={!canMove || !move} onClick={() => { if (move) void onAction(move).then((ok) => { if (ok) setMove(null); }); }}>{t('gameRoom.confirmMove')}</Button>
      {move ? <Button variant="ghost" className="min-h-11" onClick={() => setMove(null)}>{t('gameRoom.cancel')}</Button> : null}
    </div>
  </div>;
}
