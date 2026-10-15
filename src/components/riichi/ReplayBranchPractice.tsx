import { useState } from 'react';
import { ArrowLeft, Eye, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLocale } from '@/contexts/LocaleContext';
import { formatMessage } from '@/lib/i18n';
import { getTileLabel } from '@/lib/mahjongRiichi';
import { RiichiPracticeTable } from './RiichiPracticeTable';
import {
  createReplayBranch,
  replayBranchOutcomeKey,
  replayBranchScoreDelta,
  type ReplayBranchChoice,
  type ReplayBranchRun,
} from '@/lib/riichiReplayBranch';
import { RiichiTile } from '@/pages/mahjong/japanese/components/Tile';
import type { RiichiMatchState } from '@/pages/mahjong/japanese/engine/match';

interface Props {
  run: ReplayBranchRun;
  onExit: () => void;
  onViewOriginal: () => void;
}

export function ReplayBranchPractice({ run: initialRun, onExit, onViewOriginal }: Props) {
  const { t, locale } = useLocale();
  const [run, setRun] = useState(initialRun);
  const [roundEnd, setRoundEnd] = useState<RiichiMatchState | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState(false);
  const { node } = run;

  const retry = () => {
    try {
      const next = createReplayBranch(node, run.choice);
      if (!next) {
        setError(true);
        return;
      }
      setRun(next);
      setRoundEnd(null);
      setAttempt((value) => value + 1);
      setError(false);
    } catch {
      setError(true);
    }
  };

  if (!roundEnd) {
    return (
      <RiichiPracticeTable
        key={attempt}
        initialMatch={run.initialMatch}
        viewerSeat={node.viewerSeat}
        title={t('riichi.branch.title')}
        objective={t('riichi.branch.objective')}
        onRoundEnd={setRoundEnd}
        onExit={onExit}
      />
    );
  }

  const formatDelta = (match: RiichiMatchState) => {
    const delta = replayBranchScoreDelta(node, match);
    if (delta === null) return '—';
    return `${delta > 0 ? '+' : ''}${delta.toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US')}`;
  };
  const choices: Array<{ label: string; choice: ReplayBranchChoice; end: RiichiMatchState }> = [
    { label: t('riichi.branch.original'), choice: node.originalChoice, end: node.originalEnd },
    { label: t('riichi.branch.practice'), choice: run.choice, end: roundEnd },
  ];

  return (
    <div className="container max-w-4xl space-y-5 px-4 py-8">
      <Button variant="ghost" size="sm" onClick={onExit}>
        <ArrowLeft className="mr-1.5 h-4 w-4" />{t('riichi.branch.backQuestion')}
      </Button>
      <Card>
        <CardHeader className="space-y-2">
          <p className="text-xs font-semibold text-primary">{t('riichi.branch.noReward')}</p>
          <CardTitle>{t('riichi.branch.results')}</CardTitle>
          <p className="text-sm leading-relaxed text-muted-foreground">{t('riichi.branch.onceOnly')}</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {choices.map(({ label, choice, end }) => (
              <section key={label} className="space-y-3 rounded-xl border bg-muted/20 p-4">
                <h3 className="font-semibold">{label}</h3>
                <div className="flex items-center gap-3">
                  <RiichiTile tile={choice.tile} variant="river" />
                  <div className="text-sm">
                    <p className="text-xs text-muted-foreground">{t('riichi.branch.action')}</p>
                    <p>{t(choice.riichi ? 'riichi.branch.riichi' : 'riichi.branch.discard')}</p>
                  </div>
                </div>
                <p className="text-sm font-medium">{t(replayBranchOutcomeKey(end, node.viewerSeat))}</p>
                <div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{t('riichi.branch.scoreChange')}</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">{formatDelta(end)}</p>
                </div>
              </section>
            ))}
          </div>
          <section className="space-y-2 rounded-xl border p-4 text-sm">
            <h3 className="font-semibold">{t('riichi.branch.advice')}</h3>
            <p>{formatMessage(locale, node.problem.reasonTextKey, {
              tile: getTileLabel(node.problem.recommendedTile, locale),
              shanten: Math.abs(node.problem.explanation.shantenDiff),
              count: Math.abs(node.problem.explanation.ukeireDiff),
            })}</p>
            <dl className="grid gap-2 text-xs sm:grid-cols-2">
              <div><dt className="text-muted-foreground">{t('riichi.branch.shanten')}</dt><dd className="mt-1 font-semibold tabular-nums">{node.problem.explanation.shantenDiff}</dd></div>
              <div><dt className="text-muted-foreground">{t('riichi.branch.ukeire')}</dt><dd className="mt-1 font-semibold tabular-nums">{node.problem.explanation.ukeireDiff}</dd></div>
            </dl>
            <p className="text-xs leading-relaxed text-muted-foreground">{t('riichi.branch.adviceNote')}</p>
          </section>
          {error && <p role="alert" className="text-sm text-destructive">{t('riichi.branch.startError')}</p>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={onExit}>{t('riichi.branch.changeChoice')}</Button>
            <Button variant="outline" onClick={retry}><RefreshCw className="mr-1.5 h-4 w-4" />{t('riichi.branch.retry')}</Button>
            <Button variant="outline" onClick={onViewOriginal}><Eye className="mr-1.5 h-4 w-4" />{t('riichi.branch.backReplay')}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
