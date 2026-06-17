import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { cn } from '@/lib/utils';
import { useScreenShake } from '../hooks/useScreenShake';
import './tictactoe.css';

type Player = 'X' | 'O';

interface Move {
  player: Player;
  index: number;
}

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6]             // diagonals
];

// Helper to check winner
function getWinningLine(moves: Move[]): number[] | null {
  const board = Array(9).fill(null);
  moves.forEach(m => board[m.index] = m.player);

  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return line;
    }
  }
  return null;
}

const GameTictactoe = () => {
  const { t } = useLocale();
  const shake = useScreenShake();
  
  const [moves, setMoves] = useState<Move[]>([]);
  const [xNext, setXNext] = useState(true);
  const [vsAI, setVsAI] = useState(true); // Default to playing against AI

  const currentPlayer: Player = xNext ? 'X' : 'O';
  const winningLine = getWinningLine(moves);
  const winner = winningLine ? (xNext ? 'O' : 'X') : null; // Previous player won

  // Calculate board state
  const board = useMemo(() => {
    const b = Array(9).fill(null);
    moves.forEach(m => b[m.index] = m.player);
    return b;
  }, [moves]);

  // Identify the oldest move of the current player if they have 3 pieces
  const currentPlayerMoves = moves.filter(m => m.player === currentPlayer);
  const fadingMoveIndex = (!winner && currentPlayerMoves.length === 3) 
    ? currentPlayerMoves[0].index 
    : null;

  const handlePlay = (i: number) => {
    if (board[i] || winner) return;

    let nextMoves = [...moves, { player: currentPlayer, index: i }];
    
    // Remove oldest if more than 3
    if (nextMoves.filter(m => m.player === currentPlayer).length > 3) {
      const oldestIndex = nextMoves.findIndex(m => m.player === currentPlayer);
      if (oldestIndex !== -1) {
        nextMoves.splice(oldestIndex, 1);
      }
    }

    setMoves(nextMoves);
    
    // Check if this move wins
    const won = getWinningLine(nextMoves) !== null;
    if (won) {
      shake();
    }
    
    setXNext(!xNext);
  };

  // Basic AI logic
  useEffect(() => {
    if (vsAI && !xNext && !winner) {
      const timer = setTimeout(() => {
        // AI's turn (O)
        // 1. Can O win?
        // 2. Can X win? (block)
        // 3. Random empty cell
        let bestMove = -1;
        const emptyCells = board.map((c, i) => c === null ? i : -1).filter(i => i !== -1);
        
        // Helper to simulate
        const testWin = (player: Player) => {
          for (let i of emptyCells) {
            let tempMoves = [...moves, { player, index: i }];
            if (tempMoves.filter(m => m.player === player).length > 3) {
              const old = tempMoves.findIndex(m => m.player === player);
              tempMoves.splice(old, 1);
            }
            if (getWinningLine(tempMoves)) return i;
          }
          return -1;
        };

        const winMove = testWin('O');
        if (winMove !== -1) bestMove = winMove;
        else {
          const blockMove = testWin('X');
          if (blockMove !== -1) bestMove = blockMove;
          else if (emptyCells.length > 0) {
            bestMove = emptyCells[Math.floor(Math.random() * emptyCells.length)];
          }
        }

        if (bestMove !== -1) {
          handlePlay(bestMove);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [xNext, vsAI, winner, board, moves]);

  const restart = () => {
    setMoves([]);
    setXNext(true);
  };

  // SVG Line overlay
  const renderWinningLine = () => {
    if (!winningLine) return null;
    const [a, b, c] = winningLine;
    // Maps index 0-8 to x,y coordinates (0-2)
    const getCoord = (idx: number) => ({
      x: (idx % 3) * 100 + 50,
      y: Math.floor(idx / 3) * 100 + 50
    });
    
    const start = getCoord(a);
    const end = getCoord(c);

    // Calculate angle and length for styling (or just use raw SVG coords)
    // We can just draw an SVG over the board. The board is 300x300 roughly in relative units.
    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 drop-shadow-[0_0_10px_#fff]" viewBox="0 0 300 300">
        <line 
          x1={start.x} y1={start.y} 
          x2={end.x} y2={end.y} 
          stroke={winner === 'X' ? '#0ff' : '#f0f'} 
          strokeWidth="10" 
          strokeLinecap="round"
          className="animate-laser drop-shadow-[0_0_15px_currentColor]"
        />
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-purple-900/50">
      <header className="flex items-center justify-between border-b border-purple-900/30 bg-black/50 backdrop-blur px-4 py-3 sticky top-0 z-20">
        <Link to="/" className="text-zinc-500 hover:text-purple-400 transition-colors">
          ← {t('common.backToList')}
        </Link>
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => { setVsAI(!vsAI); restart(); }}
            className="bg-transparent border-purple-900/50 hover:bg-purple-900/20 text-purple-400"
          >
            {vsAI ? 'PvE (AI)' : 'PvP (Local)'}
          </Button>
        </div>
      </header>

      <main className="flex flex-col items-center justify-center p-4 min-h-[calc(100vh-64px)] pb-20">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black tracking-[0.2em] mb-2 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
            INFINITE TAC
          </h1>
          <p className="text-sm text-zinc-400">
            {winner 
              ? <span className={winner === 'X' ? 'neon-x font-bold' : 'neon-o font-bold'}>{winner} WINS!</span>
              : <span>NEXT TURN: <span className={xNext ? 'neon-x font-bold' : 'neon-o font-bold'}>{currentPlayer}</span></span>
            }
          </p>
        </div>

        <div className="relative p-3 rounded-2xl bg-[#0a0a0a] neon-grid border-4">
          <div className="grid grid-cols-3 gap-3 relative w-[300px] h-[300px] sm:w-[360px] sm:h-[360px]">
            {board.map((cell, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handlePlay(i)}
                disabled={!!winner || !!cell}
                className={cn(
                  'relative flex items-center justify-center rounded-xl bg-black border-2 text-6xl font-black font-sans transition-all neon-cell disabled:opacity-100',
                  cell === 'X' && 'neon-x animate-pop-in',
                  cell === 'O' && 'neon-o animate-pop-in',
                  fadingMoveIndex === i && 'animate-fading'
                )}
              >
                {cell ?? ''}
              </button>
            ))}
            {renderWinningLine()}
          </div>
        </div>

        <div className="mt-12 flex gap-4">
          <Button 
            size="lg" 
            onClick={restart}
            className="bg-transparent border-2 border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white font-bold tracking-widest shadow-[0_0_15px_rgba(168,85,247,0.4)]"
          >
            {t('common.restart')}
          </Button>
        </div>
      </main>
    </div>
  );
};

export default GameTictactoe;
