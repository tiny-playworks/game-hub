import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const COLS = 10;
const ROWS = 20;
const CELL = 26;
const W = COLS * CELL;
const H = ROWS * CELL;

type ShapeGrid = number[][];

const SHAPES: ShapeGrid[][] = [
  [
    [
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 1, 0],
    ],
    [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
    ],
  ],
  [
    [
      [1, 1, 0, 0],
      [1, 1, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [1, 1, 0, 0],
      [1, 1, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [1, 1, 0, 0],
      [1, 1, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [1, 1, 0, 0],
      [1, 1, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  ],
  [
    [
      [0, 1, 0, 0],
      [1, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 0, 0],
      [1, 1, 1, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [1, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
    ],
  ],
  [
    [
      [0, 1, 1, 0],
      [1, 1, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 0, 0],
      [0, 1, 1, 0],
      [1, 1, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [1, 0, 0, 0],
      [1, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
    ],
  ],
  [
    [
      [1, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 1, 0],
      [0, 1, 1, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 0, 0],
      [1, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [1, 1, 0, 0],
      [1, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  ],
  [
    [
      [1, 0, 0, 0],
      [1, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 1, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 0, 0],
      [1, 1, 1, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
    ],
  ],
  [
    [
      [0, 0, 1, 0],
      [1, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 0, 0, 0],
      [1, 1, 1, 0],
      [1, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    [
      [0, 1, 1, 0],
      [0, 1, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 0, 0],
    ],
  ],
];

const COLORS = [
  '',
  '#22d3ee',
  '#fbbf24',
  '#a78bfa',
  '#4ade80',
  '#f87171',
  '#38bdf8',
  '#fb923c',
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const GameTetris = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lines, setLines] = useState(0);
  const [status, setStatus] = useState<'idle' | 'playing' | 'over'>('idle');

  const linesRef = useRef(0);
  const stateRef = useRef<{
    board: number[][];
    piece: number;
    rot: number;
    px: number;
    py: number;
    nextPiece: number;
    dropCounter: number;
    dropInterval: number;
  }>({
    board: Array.from({ length: ROWS }, () => Array(COLS).fill(0)),
    piece: 0,
    rot: 0,
    px: 0,
    py: 0,
    nextPiece: 0,
    dropCounter: 0,
    dropInterval: 48,
  });

  const reset = useCallback(() => {
    linesRef.current = 0;
    stateRef.current = {
      board: Array.from({ length: ROWS }, () => Array(COLS).fill(0)),
      piece: Math.floor(Math.random() * 7),
      rot: 0,
      px: Math.floor((COLS - 4) / 2),
      py: 0,
      nextPiece: Math.floor(Math.random() * 7),
      dropCounter: 0,
      dropInterval: 48,
    };
    setScore(0);
    setLevel(1);
    setLines(0);
    setStatus('idle');
  }, []);

  const collide = useCallback(
    (
      board: number[][],
      piece: number,
      rot: number,
      px: number,
      py: number,
    ): boolean => {
      const shape = SHAPES[piece][rot];
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          if (!shape[r][c]) continue;
          const ny = py + r;
          const nx = px + c;
          if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
          if (ny >= 0 && board[ny][nx]) return true;
        }
      }
      return false;
    },
    [],
  );

  const merge = useCallback(
    (
      board: number[][],
      piece: number,
      rot: number,
      px: number,
      py: number,
      color: number,
    ): number[][] => {
      const next = board.map((row) => [...row]);
      const shape = SHAPES[piece][rot];
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          if (!shape[r][c]) continue;
          const ny = py + r;
          const nx = px + c;
          if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS)
            next[ny][nx] = color;
        }
      }
      return next;
    },
    [],
  );

  const clearLines = useCallback(
    (board: number[][]): { board: number[][]; cleared: number } => {
      let cleared = 0;
      let next = board.map((row) => [...row]);
      for (let r = ROWS - 1; r >= 0; r--) {
        if (next[r].every((c) => c !== 0)) {
          cleared++;
          next = [
            Array(COLS).fill(0),
            ...next.slice(0, r),
            ...next.slice(r + 1),
          ];
          r++;
        }
      }
      return { board: next, cleared };
    },
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;

    const loop = () => {
      const state = stateRef.current;
      const { board, piece, rot, px, py, nextPiece } = state;

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, W, H);

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const v = board[r][c];
          if (v) {
            ctx.fillStyle = COLORS[v];
            ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.strokeRect(c * CELL, r * CELL, CELL, CELL);
          }
        }
      }

      if (status === 'playing' || status === 'idle') {
        const color = piece + 1;
        const shape = SHAPES[piece][rot];
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 4; c++) {
            if (!shape[r][c]) continue;
            const x = (px + c) * CELL;
            const y = (py + r) * CELL;
            if (py + r >= 0) {
              ctx.fillStyle = COLORS[color];
              ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
              ctx.strokeStyle = 'rgba(255,255,255,0.3)';
              ctx.strokeRect(x, y, CELL, CELL);
            }
          }
        }
      }

      if (status === 'idle') {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff';
        ctx.font = '18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('按 空格 开始', W / 2, H / 2 - 12);
        ctx.fillText(
          '方向键移动/旋转 · 下键加速 · 空格落地',
          W / 2,
          H / 2 + 12,
        );
      }

      if (status === 'over') {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ef4444';
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('游戏结束', W / 2, H / 2 - 12);
        ctx.fillText(`得分: ${score}`, W / 2, H / 2 + 20);
      }

      if (status === 'playing') {
        state.dropCounter++;
        if (state.dropCounter >= state.dropInterval) {
          state.dropCounter = 0;
          if (!collide(board, piece, rot, px, py + 1)) {
            state.py++;
          } else {
            const color = piece + 1;
            const newBoard = merge(board, piece, rot, px, py, color);
            const { board: afterClear, cleared } = clearLines(newBoard);
            state.board = afterClear;
            if (cleared > 0) {
              linesRef.current += cleared;
              const lvl = 1 + Math.floor(linesRef.current / 10);
              setScore((s) => s + LINE_SCORES[cleared] * Math.min(10, lvl));
              setLines(linesRef.current);
              const newLevel = Math.min(
                10,
                1 + Math.floor(linesRef.current / 10),
              );
              setLevel(newLevel);
              state.dropInterval = Math.max(8, 48 - newLevel * 4);
            } else {
              state.dropInterval = Math.max(
                8,
                48 - (1 + Math.floor(linesRef.current / 10)) * 4,
              );
            }
            state.piece = nextPiece;
            state.rot = 0;
            state.px = Math.floor((COLS - 4) / 2);
            state.py = 0;
            state.nextPiece = Math.floor(Math.random() * 7);
            if (
              collide(state.board, state.piece, state.rot, state.px, state.py)
            ) {
              setStatus('over');
            }
          }
        }
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [status, score, collide, merge, clearLines]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = stateRef.current;
      if (e.code === 'Space') {
        e.preventDefault();
        if (status === 'idle') {
          setStatus('playing');
          return;
        }
        if (status === 'over') return;
        while (
          !collide(state.board, state.piece, state.rot, state.px, state.py + 1)
        ) {
          state.py++;
          setScore((s) => s + 2);
        }
        const color = state.piece + 1;
        const newBoard = merge(
          state.board,
          state.piece,
          state.rot,
          state.px,
          state.py,
          color,
        );
        const { board: afterClear, cleared } = clearLines(newBoard);
        state.board = afterClear;
        if (cleared > 0) {
          linesRef.current += cleared;
          const lvl = 1 + Math.floor(linesRef.current / 10);
          setScore((s) => s + LINE_SCORES[cleared] * Math.min(10, lvl));
          setLines(linesRef.current);
          const newLevel = Math.min(10, 1 + Math.floor(linesRef.current / 10));
          setLevel(newLevel);
          state.dropInterval = Math.max(8, 48 - newLevel * 4);
        } else {
          state.dropInterval = Math.max(
            8,
            48 - (1 + Math.floor(linesRef.current / 10)) * 4,
          );
        }
        state.piece = state.nextPiece;
        state.rot = 0;
        state.px = Math.floor((COLS - 4) / 2);
        state.py = 0;
        state.nextPiece = Math.floor(Math.random() * 7);
        if (collide(state.board, state.piece, state.rot, state.px, state.py)) {
          setStatus('over');
        }
        return;
      }
      if (status !== 'playing') return;
      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        if (
          !collide(state.board, state.piece, state.rot, state.px - 1, state.py)
        ) {
          state.px--;
        }
      }
      if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (
          !collide(state.board, state.piece, state.rot, state.px + 1, state.py)
        ) {
          state.px++;
        }
      }
      if (e.code === 'ArrowDown') {
        e.preventDefault();
        if (
          !collide(state.board, state.piece, state.rot, state.px, state.py + 1)
        ) {
          state.py++;
          setScore((s) => s + 1);
        }
      }
      if (e.code === 'ArrowUp' || e.code === 'KeyX') {
        e.preventDefault();
        const nextRot = (state.rot + 1) % 4;
        if (!collide(state.board, state.piece, nextRot, state.px, state.py)) {
          state.rot = nextRot;
        }
      }
      if (e.code === 'KeyZ') {
        e.preventDefault();
        const nextRot = (state.rot + 3) % 4;
        if (!collide(state.board, state.piece, nextRot, state.px, state.py)) {
          state.rot = nextRot;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, collide, merge, clearLines]);

  const start = () => {
    if (status === 'idle') setStatus('playing');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          ← 返回游戏列表
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">得分: {score}</span>
          <span className="text-sm text-muted-foreground">等级: {level}</span>
          <span className="text-sm text-muted-foreground">消行: {lines}</span>
          <Button variant="outline" size="sm" onClick={reset}>
            重开
          </Button>
        </div>
      </header>

      <main className="flex min-h-[calc(100vh-56px)] flex-col items-center justify-center p-4">
        <button
          type="button"
          className="rounded-lg border-2 border-border bg-black block"
          onClick={start}
        >
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            className="block cursor-pointer"
            style={{ width: W, height: H }}
          />
        </button>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          方向键 左右下 · 上/X 顺时针旋转 · Z 逆时针 · 空格 一键落地
        </p>
      </main>
    </div>
  );
};

export default GameTetris;
