import { useEffect, useRef, useState } from 'react';
import { getCharacterAsset } from '@/assets/characters';
import { getCharacterSheet } from '@/assets/characters/sheets';
import { useLocale } from '@/contexts/LocaleContext';
import { getTileLabel } from '@/lib/mahjongRiichi';
import { getCharacterById } from '@/lib/playerCharacters';
import {
  applyPracticeEvent,
  copyPracticeMatch,
  getPracticeAiEvent,
} from '@/lib/riichiPractice';
import { MeldTiles } from '@/pages/mahjong/japanese/components/MeldTiles';
import { RiichiTile } from '@/pages/mahjong/japanese/components/Tile';
import type {
  RiichiEvent,
  RiichiMatchState,
} from '@/pages/mahjong/japanese/engine/match';
import {
  getPendingSeats,
  getSeatClaimOptions,
  getSeatTurnOptions,
} from '@/pages/mahjong/japanese/engine/selectors';
import './riichi-practice.css';

export interface RiichiPracticeTableProps {
  initialMatch: RiichiMatchState;
  viewerSeat?: number;
  title: string;
  objective?: string;
  onRoundEnd: (match: RiichiMatchState) => void;
  onMatchChange?: (match: RiichiMatchState) => void;
  onExit: () => void;
}

const WIND_KEYS = ['practice.east', 'practice.south', 'practice.west', 'practice.north'];
const AI_DELAY_MS = 280;

/** Single-round sandbox. A parent key starts another attempt with a fresh snapshot. */
export function RiichiPracticeTable({
  initialMatch,
  viewerSeat = 0,
  title,
  objective,
  onRoundEnd,
  onMatchChange,
  onExit,
}: RiichiPracticeTableProps) {
  const { locale, t } = useLocale();
  const humanSeat = Number.isInteger(viewerSeat) && viewerSeat >= 0 && viewerSeat < 4
    ? viewerSeat : 0;
  const [match, setMatch] = useState(() => copyPracticeMatch(initialMatch));
  const latestRef = useRef(match);
  const endedRef = useRef(false);
  const stoppedRef = useRef(false);
  const [riichiSelecting, setRiichiSelecting] = useState(false);
  const [error, setError] = useState(false);
  const [paused, setPaused] = useState(false);
  const round = match.round;
  const ended = match.status !== 'playing' || round.phase === 'end';
  const pending = getPendingSeats(round);
  const aiPending = !ended && pending.some((seat) => seat !== humanSeat);
  const humanReady = !paused && !ended && !aiPending && pending.includes(humanSeat);
  const turn = getSeatTurnOptions(round, humanSeat);
  const claim = getSeatClaimOptions(round, humanSeat);
  const scores = round.result?.settlement.newScores ?? round.scores;

  const commitHuman = (event: RiichiEvent) => {
    const latest = latestRef.current;
    if (paused || stoppedRef.current || getPracticeAiEvent(latest, humanSeat)) return;
    const next = applyPracticeEvent(latest, event);
    if (!next) {
      setError(true);
      return;
    }
    latestRef.current = next;
    setMatch(next);
    setRiichiSelecting(false);
    setError(false);
  };

  useEffect(() => { onMatchChange?.(match); }, [match, onMatchChange]);
  useEffect(() => {
    if (!onMatchChange) return;
    const hide = () => { if (document.hidden) setPaused(true); };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, [onMatchChange]);

  useEffect(() => {
    if (ended && !endedRef.current && !stoppedRef.current) {
      endedRef.current = true;
      onRoundEnd(copyPracticeMatch(match));
    }
  }, [ended, match, onRoundEnd]);

  useEffect(() => {
    if (paused || ended || !aiPending) return;
    const token = match.turn;
    const timer = window.setTimeout(() => {
      const latest = latestRef.current;
      if (stoppedRef.current || latest.turn !== token) return;
      const event = getPracticeAiEvent(latest, humanSeat);
      if (!event) return;
      const next = applyPracticeEvent(latest, event);
      if (!next) return;
      latestRef.current = next;
      setMatch(next);
      setRiichiSelecting(false);
      setError(false);
    }, AI_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [aiPending, ended, humanSeat, match.turn, paused]);

  const seatName = (seat: number) => {
    if (seat === humanSeat) return t('practice.you');
    const id = match.seatCharacters[seat];
    return id ? t(getCharacterById(id).nameKey) : `${t('practice.opponent')} ${seat + 1}`;
  };
  const renderMelds = (seat: number) => (
    <div className="practice-melds" aria-label={t('practice.melds')}>
      {round.melds[seat].map((meld, index) => (
        <div className="practice-meld" key={`${meld.type}-${index}`}>
          <MeldTiles meld={meld} seat={seat} />
        </div>
      ))}
    </div>
  );
  const renderRiver = (seat: number) => (
    <div className="practice-river" aria-label={`${seatName(seat)} · ${t('practice.river')}`}>
      {round.discardPiles[seat].length === 0 ? (
        <span className="practice-empty-river">{t('practice.emptyRiver')}</span>
      ) : round.discardPiles[seat].map((tile, index) => (
        <RiichiTile
          key={`${index}-${tile}`}
          tile={tile}
          variant="river"
          rotation={round.riichiDiscardIndex[seat] === index ? 90 : 0}
          state={round.lastDiscardFrom === seat && index === round.discardPiles[seat].length - 1
            ? 'last-discard' : 'normal'}
        />
      ))}
    </div>
  );
  const turnStatus = ended ? t('practice.ended')
    : aiPending ? t('practice.waiting')
      : claim && humanReady ? t('practice.chooseClaim')
        : turn && humanReady ? t(riichiSelecting ? 'practice.chooseRiichi' : 'practice.chooseDiscard')
          : t('practice.waitingClaim');

  return (
    <section className="practice-table" aria-label={title}>
      <header className="practice-header">
        <div>
          <span className="practice-eyebrow">{t('practice.label')}</span>
          <h1>{title}</h1>
          <p>{t('practice.isolated')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
        {onMatchChange && !ended ? <button type="button" className="practice-button" onClick={() => setPaused((value) => !value)}>{t(paused ? 'arcade.resume' : 'arcade.pause')}</button> : null}
        <button type="button" className="practice-button practice-button-quiet" onClick={() => {
          stoppedRef.current = true;
          onMatchChange?.(latestRef.current);
          onExit();
        }}>{t('practice.exit')}</button>
        </div>
      </header>

      {paused ? <aside className="practice-objective" role="status"><strong>{t('arcade.paused')}</strong><span>{t('resume.saved')}</span></aside> : null}

      {objective && <aside className="practice-objective">
        <strong>{t('practice.objective')}</strong>
        <span>{objective}</span>
      </aside>}

      <div className="practice-arena">
        <div className="practice-opponents">
          {([3, 2, 1] as const).map((relative) => {
            const seat = (humanSeat + relative) % 4;
            const id = match.seatCharacters[seat];
            const character = id ? getCharacterById(id) : null;
            const sheet = character ? getCharacterSheet(character.id, 'normal', false) : null;
            const avatar = character ? getCharacterAsset(character.avatar) : null;
            return (
              <section className={`practice-seat ${round.currentPlayer === seat && round.phase === 'discard'
                ? 'practice-seat-active' : ''}`} key={seat}>
                <header className="practice-seat-header">
                  <div className="practice-avatar" aria-hidden="true">
                    {sheet ? <svg viewBox={sheet.viewBox}>
                      <image href={sheet.src} width={sheet.width} height={sheet.height} />
                    </svg> : avatar ? <img src={avatar} alt="" /> : seatName(seat).slice(0, 1)}
                  </div>
                  <div>
                    <small>{t(relative === 3 ? 'practice.left' : relative === 2 ? 'practice.across' : 'practice.right')}
                      {' · '}{t(WIND_KEYS[(seat - round.dealer + 4) % 4])}</small>
                    <h2>{seatName(seat)}</h2>
                    <strong className="practice-score">{scores[seat].toLocaleString(locale)}</strong>
                  </div>
                </header>
                <div className="practice-seat-status">
                  <span>{round.hands[seat].length} {t('practice.concealedCount')}</span>
                  {seat === round.dealer && <span>{t('practice.dealer')}</span>}
                  {round.riichiDeclared[seat] && <span className="practice-riichi-badge">{t('practice.riichi')}</span>}
                </div>
                {renderRiver(seat)}
                {renderMelds(seat)}
              </section>
            );
          })}
        </div>

        <div className="practice-round-strip">
          <strong>{t(WIND_KEYS[round.roundWind % 4])} {round.roundNumber} {t('practice.round')}
            {' · '}{round.honba} {t('practice.honba')}</strong>
          <span>{t('practice.wall')} <b>{round.wall.length}</b></span>
          <span>{t('practice.riichiPot')} <b>{round.riichiPot}</b></span>
          <div className="practice-dora" aria-label={t('practice.dora')}>
            <span>{t('practice.dora')}</span>
            {round.doraIndicators.map((tile, index) => (
              <RiichiTile key={`${tile}-${index}`} tile={tile} variant="indicator" />
            ))}
          </div>
        </div>

        <section className="practice-self">
          <header className="practice-self-header">
            <h2>{t('practice.you')} · {t(WIND_KEYS[(humanSeat - round.dealer + 4) % 4])}</h2>
            <strong className="practice-score">{scores[humanSeat].toLocaleString(locale)}</strong>
            {round.riichiDeclared[humanSeat] && <span className="practice-riichi-badge">{t('practice.riichi')}</span>}
          </header>
          {renderRiver(humanSeat)}
          {renderMelds(humanSeat)}

          <div className="practice-decision" aria-live="polite">
            <p>{turnStatus}</p>
            {error && <p className="practice-error" role="alert">{t('practice.illegal')}</p>}
          </div>

          <fieldset className="practice-controls" disabled={!humanReady}>
            <legend className="sr-only">{t('practice.hand')}</legend>
            <div className="practice-actions">
              {turn?.tsumo && <button type="button" className="practice-button practice-button-primary"
                onClick={() => commitHuman({ type: 'tsumo', seat: humanSeat, elapsed: 0 })}>{t('practice.tsumo')}</button>}
              {turn && turn.riichiDiscards.length > 0 && <button type="button"
                className={`practice-button ${riichiSelecting ? 'practice-button-primary' : ''}`}
                aria-pressed={riichiSelecting}
                onClick={() => setRiichiSelecting((value) => !value)}>
                {t(riichiSelecting ? 'practice.cancelRiichi' : 'practice.riichi')}
              </button>}
              {turn?.ankan.map((tiles, index) => <button type="button" className="practice-button" key={`ankan-${index}`}
                onClick={() => commitHuman({ type: 'ankan', seat: humanSeat, tiles, elapsed: 0 })}>
                {t('practice.ankan')} {getTileLabel(tiles[0], locale)}
              </button>)}
              {turn?.kakan.map((option) => <button type="button" className="practice-button" key={`kakan-${option.meldIndex}`}
                onClick={() => commitHuman({ type: 'kakan', seat: humanSeat, ...option, elapsed: 0 })}>
                {t('practice.kakan')} {getTileLabel(option.tile, locale)}
              </button>)}
              {turn?.kyuushu && <button type="button" className="practice-button"
                onClick={() => commitHuman({ type: 'kyuushu', seat: humanSeat, elapsed: 0 })}>{t('practice.kyuushu')}</button>}
              {claim?.ron && <button type="button" className="practice-button practice-button-primary"
                onClick={() => commitHuman({ type: 'claim', seat: humanSeat, response: { type: 'ron' }, elapsed: 0 })}>
                {t('practice.ron')}
              </button>}
              {claim?.pon && <button type="button" className="practice-button"
                onClick={() => commitHuman({ type: 'claim', seat: humanSeat, response: { type: 'pon' }, elapsed: 0 })}>
                {t('practice.pon')}
              </button>}
              {claim?.minkan && <button type="button" className="practice-button"
                onClick={() => commitHuman({ type: 'claim', seat: humanSeat, response: { type: 'minkan' }, elapsed: 0 })}>
                {t('practice.minkan')}
              </button>}
              {claim?.chi.map((tiles, index) => <button type="button" className="practice-button" key={`chi-${index}`}
                onClick={() => commitHuman({ type: 'claim', seat: humanSeat, response: { type: 'chi', tiles }, elapsed: 0 })}>
                {t('practice.chi')} {tiles.map((tile) => getTileLabel(tile, locale)).join(' / ')}
              </button>)}
              {claim && <button type="button" className="practice-button practice-button-quiet"
                onClick={() => commitHuman({ type: 'claim', seat: humanSeat, response: { type: 'pass' }, elapsed: 0 })}>
                {t('practice.pass')}
              </button>}
            </div>
            <div className="practice-hand" aria-label={t('practice.hand')}>
              {round.hands[humanSeat].map((tile, index) => {
                const allowed = humanReady && Boolean(turn?.discardable.includes(tile)) &&
                  (!riichiSelecting || Boolean(turn?.riichiDiscards.includes(tile)));
                return <RiichiTile
                  key={`${tile}-${index}`}
                  tile={tile}
                  variant="hand"
                  state={!allowed ? 'disabled' : round.currentPlayer === humanSeat &&
                    round.drawnTile !== null && index === round.hands[humanSeat].lastIndexOf(round.drawnTile)
                      ? 'drawn' : 'normal'}
                  highlighted={allowed && riichiSelecting}
                  title={`${t(riichiSelecting ? 'practice.riichiAction' : 'practice.discardAction')} ${getTileLabel(tile, locale)}`}
                  onClick={() => {
                    if (allowed) commitHuman({
                      type: riichiSelecting ? 'riichi' : 'discard', seat: humanSeat, tile, elapsed: 0,
                    });
                  }}
                />;
              })}
            </div>
          </fieldset>
        </section>

        {ended && <div className="practice-round-end" role="status">
          <strong>{t('practice.ended')}</strong>
          <span>{round.result?.type === 'win'
            ? `${round.result.wins.map((win) => seatName(win.winner)).join(' / ')} · ${t('practice.won')}`
            : t('practice.draw')}</span>
        </div>}
      </div>
    </section>
  );
}
