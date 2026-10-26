import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useHousehold } from '@/contexts/HouseholdContext';
import { useLocale } from '@/contexts/LocaleContext';
import { formatMessage } from '@/lib/i18n';
import {
  readLocalResume,
  resumeOwner,
  writeLocalResume,
} from '@/lib/localResume';
import {
  parseChallengeCode,
  replay2048,
  replayTetris,
  replayXiangqi,
  validShortActions,
  type ShortAction,
} from '@/lib/shortChallenges';
import { getGhostY, getPieceCells } from '@/lib/tetris';
import { getPieceLabel, getSafeMoves } from '@/lib/xiangqi';

const SLOT = 'short-challenge';
export default function ShortChallenges() {
  const { currentMember, isLoading } = useHousehold();
  const owner = resumeOwner(currentMember?.id);
  const [params, setParams] = useSearchParams();
  if (isLoading) return null;
  const saved = readLocalResume<{ code: string }>(owner, SLOT)?.data;
  const code = params.get('code') ?? saved?.code ?? 'GH1-2048-1';
  return (
    <ShortChallenge
      key={`${owner}:${code}`}
      owner={owner}
      code={code}
      choose={(value) => setParams({ code: value })}
    />
  );
}
function ShortChallenge({
  owner,
  code,
  choose,
}: {
  owner: string;
  code: string;
  choose: (code: string) => void;
}) {
  const { t, locale } = useLocale();
  const parsed = parseChallengeCode(code);
  const [input, setInput] = useState(code);
  const [invalid, setInvalid] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [actions, setActions] = useState<ShortAction[]>(() => {
    const saved = readLocalResume<{ code: string; actions: ShortAction[] }>(
      owner,
      SLOT,
    )?.data;
    return parsed &&
      saved?.code === parsed.code &&
      validShortActions(parsed.game, saved.actions)
      ? saved.actions
      : [];
  });
  const g = parsed?.game ?? '2048';
  const seed = parsed?.seed ?? 1;
  const puzzle = useMemo(
    () => ({
      numbers: replay2048(seed, g === '2048' ? actions : []),
      blocks: replayTetris(seed, g === 'tetris' ? actions : []),
      chess: replayXiangqi(seed, g === 'xiangqi' ? actions : []),
    }),
    [g, seed, actions],
  );
  const result =
    g === '2048'
      ? puzzle.numbers
      : g === 'tetris'
        ? puzzle.blocks
        : puzzle.chess;
  const save = () => {
    if (parsed)
      setFailed(!writeLocalResume(owner, SLOT, { code: parsed.code, actions }));
  };
  useEffect(() => {
    if (parsed)
      setFailed(!writeLocalResume(owner, SLOT, { code: parsed.code, actions }));
  }, [owner, parsed?.code, actions]);
  const act = (action: ShortAction) => {
    if (!result.over && parsed)
      setActions((previous) => [...previous, action].slice(0, 500));
  };
  const cells = Array(16).fill(0) as number[];
  Object.values(puzzle.numbers.state.tiles)
    .filter((tile) => !tile.mergedInto)
    .forEach((tile) => {
      cells[tile.r * 4 + tile.c] = tile.value;
    });
  const blocks = puzzle.blocks.state;
  const active = new Set(
    getPieceCells(blocks.piece, blocks.rot, blocks.px, blocks.py).map(
      (cell) => `${cell.y}:${cell.x}`,
    ),
  );
  const ghost = new Set(
    getPieceCells(blocks.piece, blocks.rot, blocks.px, getGhostY(blocks)).map(
      (cell) => `${cell.y}:${cell.x}`,
    ),
  );
  const targets = selected ? getSafeMoves(puzzle.chess.board, ...selected) : [];
  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-8">
      <Link to="/" className="text-sm text-primary">
        ← {t('common.backToList')}
      </Link>
      <h1 className="text-2xl font-semibold">{t('short.title')}</h1>
      <p className="text-sm text-muted-foreground">{t('short.scope')}</p>
      <div className="flex flex-wrap gap-2">
        {(['2048', 'xiangqi', 'tetris'] as const).map((game) => (
          <Button
            key={game}
            variant={g === game ? 'default' : 'outline'}
            onClick={() => choose(`GH1-${game.toUpperCase()}-1`)}
          >
            {t(`game.${game}.name`)}
          </Button>
        ))}
      </div>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const next = parseChallengeCode(input);
          setInvalid(!next);
          if (next) choose(next.code);
        }}
      >
        <label htmlFor="challenge-code" className="text-sm">
          {t('short.code')}
        </label>
        <input
          id="challenge-code"
          className="min-w-0 flex-1 rounded-md border bg-background p-2 font-mono text-sm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={24}
        />
        <Button type="submit" variant="outline">
          {t('short.open')}
        </Button>
      </form>
      {invalid || !parsed ? (
        <p role="alert" className="text-sm text-destructive">
          {t('short.invalid')}
        </p>
      ) : (
        <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-6">
          <h2 className="font-semibold">{t(`short.${g}.goal`)}</h2>
          <p className="text-sm text-muted-foreground">
            {t(`short.${g}.help`)}
          </p>
          {g === '2048' && (
            <>
              <p className="text-sm">
                {puzzle.numbers.moves} / 8 {t('short.moves')}
              </p>
              <div className="mx-auto grid max-w-sm grid-cols-4 gap-2 rounded-xl bg-muted p-2">
                {cells.map((value, i) => (
                  <div
                    key={i}
                    className={`flex aspect-square items-center justify-center rounded-lg text-2xl font-bold ${value ? 'bg-primary text-primary-foreground' : 'bg-background/60'}`}
                  >
                    {value || ''}
                  </div>
                ))}
              </div>
            </>
          )}
          {g === 'tetris' && (
            <>
              <p className="text-sm">
                {formatMessage(locale, 'short.blocks', {
                  pieces: blocks.piecesLocked,
                  lines: blocks.lines,
                })}
              </p>
              <div className="mx-auto grid max-w-60 grid-cols-10 overflow-hidden rounded-md border bg-slate-950">
                {blocks.board.flatMap((row, r) =>
                  row.map((value, c) => (
                    <div
                      key={`${r}:${c}`}
                      className={`aspect-square border border-white/10 ${active.has(`${r}:${c}`) ? 'bg-cyan-400' : value ? 'bg-amber-500' : ghost.has(`${r}:${c}`) ? 'bg-cyan-950 ring-1 ring-inset ring-cyan-500' : ''}`}
                    />
                  )),
                )}
              </div>
            </>
          )}
          {g === 'xiangqi' && (
            <div className="mx-auto grid max-w-md grid-cols-9 rounded-lg border bg-amber-100 p-1">
              {puzzle.chess.board.flatMap((row, r) =>
                row.map((piece, c) => (
                  <button
                    key={`${r}:${c}`}
                    disabled={result.over}
                    aria-label={`${r + 1},${c + 1} ${piece ? getPieceLabel(piece) : ''}`}
                    aria-pressed={selected?.[0] === r && selected?.[1] === c}
                    className={`flex aspect-square items-center justify-center border border-amber-900/15 text-lg font-bold ${piece?.side === 'red' ? 'text-red-700' : 'text-slate-900'} ${selected?.[0] === r && selected?.[1] === c ? 'bg-amber-300' : ''} ${targets.some(([y, x]) => y === r && x === c) ? 'bg-green-300' : ''}`}
                    onClick={() => {
                      if (piece?.side === 'red') setSelected([r, c]);
                      else if (
                        selected &&
                        targets.some(([y, x]) => y === r && x === c)
                      ) {
                        act([...selected, r, c]);
                        setSelected(null);
                      }
                    }}
                  >
                    {piece ? getPieceLabel(piece) : '·'}
                  </button>
                )),
              )}
            </div>
          )}
          {g !== 'xiangqi' && (
            <div className="flex flex-wrap justify-center gap-2">
              {(g === '2048'
                ? ['up', 'left', 'down', 'right']
                : ['left', 'rotate', 'right', 'drop']
              ).map((action) => (
                <Button
                  key={action}
                  disabled={result.over}
                  variant="outline"
                  onClick={() => act(action as ShortAction)}
                >
                  {t(`short.${action}`)}
                </Button>
              ))}
            </div>
          )}
          {result.over && (
            <p className="rounded-xl bg-muted p-3 font-medium" role="status">
              {t(result.won ? 'short.won' : 'short.retry')}{' '}
              {g === 'xiangqi' && !result.won && t('short.xiangqi.hint')}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setActions([]);
                setSelected(null);
              }}
            >
              {t('short.restart')}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                choose(`GH1-${g.toUpperCase()}-${(seed % 9999) + 1}`)
              }
            >
              {t('short.variation')}
            </Button>
          </div>
          {failed && (
            <p role="alert" className="text-sm text-destructive">
              {t('notebook.failed')}{' '}
              <button className="underline" onClick={save}>
                {t('recovery.retry')}
              </button>
            </p>
          )}
        </section>
      )}
    </main>
  );
}
