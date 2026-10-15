import { useState } from 'react';
import { useOptionalHousehold } from '@/contexts/HouseholdContext';
import { useLocale } from '@/contexts/LocaleContext';
import { deleteResumeSave, listResumeSaves } from '@/lib/household/api';
import { deleteLocalResume, listLocalResumes } from '@/lib/household/offlineDb';
import { uploadLocalMemberResumes } from '@/lib/household/memberRiichi';
import { preloadRiichiRules } from '@/lib/riichiRules';
import { useRiichiStore } from '@/pages/mahjong/japanese/store/riichiMatchStore';
import type { ResumeSaveSummary } from '../../../shared/contracts/sync';
import { ResumeSavePicker } from './ResumeSavePicker';

export function MemberResumeSaves() {
  const household = useOptionalHousehold();
  const { t } = useLocale();
  const [saves, setSaves] = useState<ResumeSaveSummary[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  if (!household?.currentMember) return null;
  const refresh = async () => {
    setBusy(true);
    setMessage('');
    try {
      const memberId = household.currentMember!.id;
      let next: ResumeSaveSummary[];
      if (household.mode === 'member-online') {
        await uploadLocalMemberResumes(memberId);
        next = await listResumeSaves();
      } else {
        next = (await listLocalResumes(memberId)).map((record) => ({ ...record, matchLength: record.replay.matchLength }));
      }
      setSaves(next);
      setOpen(next.length > 0);
      if (!next.length) setMessage('household.saves.empty');
    } catch { setMessage('household.saves.error'); }
    finally { setBusy(false); }
  };
  return <div className="space-y-2">
    <button type="button" className="riichi-lobby-guide-button" disabled={busy} onClick={() => void refresh()}>
      {t('household.saves.open')}
    </button>
    {message && <p role="status" className="text-sm">{t(message)}</p>}
    <ResumeSavePicker isOpen={open} currentDeviceId={household.deviceId} saves={saves}
      onCancel={() => setOpen(false)}
      onSelect={(saveId) => { void (async () => {
        try {
          await preloadRiichiRules();
          if (!await useRiichiStore.getState().resumeSaved(saveId)) throw new Error('Resume failed');
          setOpen(false);
        } catch { setOpen(false); setMessage('household.saves.error'); }
      })(); }}
      onDelete={(saveId) => { void (async () => {
        try {
          if (household.mode === 'member-online') await deleteResumeSave(saveId);
          await deleteLocalResume(saveId);
          await refresh();
        } catch { setMessage('household.saves.error'); }
      })(); }} />
  </div>;
}
