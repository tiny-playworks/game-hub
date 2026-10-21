import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { usePlayerProfile } from '@/hooks/usePlayerProfile';
import type { useRoomClient } from '@/lib/household/roomClient';
import { formatMessage } from '@/lib/i18n';
import { getBaseTile, getTileLabel } from '@/lib/mahjongRiichi';
import { RiichiTile, TileBack } from '@/pages/mahjong/japanese/components/Tile';
import { toTileKeyedItems } from '@/pages/mahjong/japanese/helpers';
import { useTileInteraction } from '@/pages/mahjong/japanese/useTileInteraction';
import type { PlayerViewSnapshot } from '../../../shared/contracts/room';
import './riichi-events.css';

type Client = ReturnType<typeof useRoomClient>;
type Choice = { id: string; label: string; tiles: Array<{ tile: number; called?: boolean }>; run: () => Promise<boolean>; confirm?: boolean };

export function FamilyPlayerActions({ view, client, secondsRemaining, name, wind }: {
  view: PlayerViewSnapshot;
  client: Client;
  secondsRemaining: number | null;
  name: string;
  wind: string;
}) {
  const { t, locale } = useLocale();
  const { riichiSettings } = usePlayerProfile();
  const self = view.seats[view.viewerSeat];
  const decisionKey = `${view.matchId}:${view.decisionId ?? view.revision}:${view.viewerSeat}`;
  const [riichiKey, setRiichiKey] = useState<string | null>(null);
  const [confirmedChoice, setConfirmedChoice] = useState<string | null>(null);
  const enabled = !view.isSpectator && view.status === 'playing' && !view.isPaused &&
    client.connected && !client.leaseLost && self.hasControlLease && !self.isAutoplay &&
    !client.commandPending && secondsRemaining !== 0;
  const turn = self.turnOptions;
  const claim = self.claimOptions;
  const riichiSelecting = enabled && riichiKey === decisionKey && Boolean(turn?.riichiDiscards.length);
  const canDiscard = enabled && Boolean(turn) && view.round.phase === 'discard' && view.round.currentPlayer === self.seatIndex;
  const discardable = riichiSelecting ? turn?.riichiDiscards ?? [] : turn?.discardable ?? [];
  const handItems = toTileKeyedItems(self.hand, `family-${view.viewerSeat}`);
  const { selectedKey, selectedTile, selectTile, confirmDiscard, cancelSelection, touchHandlers } = useTileInteraction({
    handItems,
    discardable,
    canDiscard,
    enabled,
    decisionKey,
    riichiSelecting,
    isMyClaim: Boolean(claim),
    singleClickDiscard: riichiSettings.singleClickDiscard,
    onDiscard: (tile) => { void (riichiSelecting ? client.declareRiichi(tile) : client.discardTile(tile)); },
    onCancelRiichi: () => setRiichiKey(null),
    onPassClaim: () => { void client.passClaim(); },
  });

  useEffect(() => {
    setConfirmedChoice(null);
    setRiichiKey(null);
    cancelSelection();
  }, [decisionKey, enabled, client.error, cancelSelection]);

  const choices: Choice[] = [];
  if (claim?.chi && view.round.claimTile) {
    const calledTile = view.round.claimTile.tile;
    for (const tiles of claim.chi) {
      choices.push({
        id: `chi:${tiles.join('-')}`,
        label: t('riichi.chi'),
        tiles: [...tiles.map((tile) => ({ tile, called: false })), { tile: calledTile, called: true }]
          .sort((a, b) => getBaseTile(a.tile) - getBaseTile(b.tile)),
        run: () => client.declareClaim('chi', tiles),
      });
    }
  }
  if (claim?.pon) choices.push({ id: 'pon', label: t('family.room.pon'), tiles: [], run: () => client.declareClaim('pon') });
  if (claim?.minkan) choices.push({ id: 'minkan', label: t('family.room.kan'), tiles: [], run: () => client.declareClaim('minkan') });
  for (const tiles of turn?.ankan ?? []) choices.push({
    id: `ankan:${tiles.join('-')}`, label: t('riichi.angang'), tiles: tiles.map((tile) => ({ tile })), run: () => client.declareAnkan(tiles),
  });
  for (const option of turn?.kakan ?? []) choices.push({
    id: `kakan:${option.meldIndex}:${option.tile}`, label: t('riichi.kakan'),
    tiles: [...(self.melds[option.meldIndex]?.tiles ?? []), option.tile].map((tile) => ({ tile })),
    run: () => client.declareKakan(option.meldIndex, option.tile),
  });
  if (turn?.kyuushu) choices.push({ id: 'kyuushu', label: t('riichi.kyuushu'), tiles: [], run: client.declareKyuushu, confirm: true });

  const choose = (choice: Choice) => {
    if (!enabled) return;
    cancelSelection();
    setRiichiKey(null);
    const key = `${decisionKey}:${choice.id}`;
    if ((riichiSettings.callConfirm || choice.confirm) && confirmedChoice !== key) {
      setConfirmedChoice(key);
      return;
    }
    void choice.run();
  };

  return (
    <section className="family-player-actions" aria-label={t('riichi.action.available')}>
      <div className="family-player-heading">
        <span><b>{wind}</b> {name}</span>
        <span>{formatMessage(locale, 'family.room.points', { points: self.score })}</span>
        {self.isRiichi && <strong>{t('family.room.riichi')}</strong>}
      </div>
      {!view.isSpectator && (
        <div className="family-action-buttons" aria-busy={client.commandPending}>
          {turn?.tsumo && <Button disabled={!enabled} onClick={() => void client.declareTsumo()}>{t('family.room.tsumo')}</Button>}
          {claim?.ron && <Button disabled={!enabled} onClick={() => void client.declareRon()}>{t('family.room.ron')}</Button>}
          {turn && turn.riichiDiscards.length > 0 && !self.isRiichi && (
            <Button disabled={!enabled} aria-pressed={riichiSelecting} onClick={() => {
              cancelSelection();
              setConfirmedChoice(null);
              setRiichiKey(riichiSelecting ? null : decisionKey);
            }}>{t(riichiSelecting ? 'riichi.action.cancelRiichi' : 'family.room.riichi')}</Button>
          )}
          {choices.map((choice) => {
            const confirmation = confirmedChoice === `${decisionKey}:${choice.id}`;
            return (
              <button key={choice.id} type="button" disabled={!enabled} className="family-meld-choice"
                aria-label={`${choice.label} ${choice.tiles.map(({ tile }) => getTileLabel(tile, locale)).join(' ')}`}
                aria-pressed={confirmation} onClick={() => choose(choice)}>
                <span>{confirmation ? t(choice.confirm ? 'family.controls.confirmDraw' : 'riichi.action.confirmCall') : choice.label}</span>
                {choice.tiles.length > 0 && <span className="family-meld-tiles" aria-hidden="true">
                  {choice.tiles.map(({ tile, called }, index) => <span key={`${tile}:${index}`} data-called={called}>
                    <RiichiTile tile={tile} variant="meld" highlighted={called} />
                  </span>)}
                </span>}
              </button>
            );
          })}
          {claim && <Button variant="outline" disabled={!enabled} onClick={() => void client.passClaim()}>{t('family.room.pass')}</Button>}
          {confirmedChoice && <Button variant="outline" disabled={!enabled} onClick={() => setConfirmedChoice(null)}>{t('riichi.action.cancelSelection')}</Button>}
          {client.commandPending && <span role="status">{t('play.saving')}</span>}
        </div>
      )}
      {riichiSelecting && <p className="family-selection-hint" role="status">{t('riichi.action.chooseRiichiDiscard')}</p>}
      <div className="family-room-hand riichi-self-hand">
        {view.isSpectator ? Array.from({ length: self.tileCount }, (_, index) => <TileBack key={index} />) : handItems.map(({ key, tile }) => {
          const allowed = canDiscard && discardable.includes(tile);
          return <RiichiTile key={key} tile={tile} tileKey={key} variant="hand"
            selected={enabled && selectedKey === key} highlighted={riichiSelecting && allowed}
            state={allowed ? 'normal' : 'disabled'}
            onClick={() => selectTile(key, tile, 'click')}
            onTouchStart={touchHandlers.onTouchStart} onTouchMove={touchHandlers.onTouchMove}
            onTouchEnd={(event) => touchHandlers.onTouchEnd(event, key, tile)} />;
        })}
      </div>
      {canDiscard && <div className="family-selection-controls">
        <span aria-live="polite">{selectedTile !== null
          ? formatMessage(locale, 'riichi.action.selectedTile', { tile: getTileLabel(selectedTile, locale) })
          : t('riichi.action.keyboardHint')}</span>
        <Button disabled={selectedTile === null} onClick={confirmDiscard}>
          {t(riichiSelecting ? 'riichi.action.riichiConfirm' : 'riichi.action.discardConfirm')}
        </Button>
        {(selectedTile !== null || riichiSelecting) && <Button variant="outline" onClick={() => {
          cancelSelection(); setRiichiKey(null); setConfirmedChoice(null);
        }}>{t('riichi.action.cancelSelection')}</Button>}
      </div>}
    </section>
  );
}
