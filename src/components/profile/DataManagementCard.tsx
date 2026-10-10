import { Download, RotateCcw, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLocale } from '@/contexts/LocaleContext';
import {
  downloadSaveFile,
  importSaveFile,
  parseSaveFile,
  resetSaveData,
  type SaveFile,
} from '@/lib/saveTransfer';

export function DataManagementCard() {
  const { t } = useLocale();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<SaveFile | 'reset' | null>(null);
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const close = () => {
    setPending(null);
    setStep(1);
  };
  return (
    <section className="paper-texture rounded-3xl border bg-card p-5 text-foreground">
      <h2 className="text-lg font-semibold">{t('save.title')}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {t('save.description')}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => {
            try {
              downloadSaveFile();
              setError('');
            } catch {
              setError(t('save.failed'));
            }
          }}
        >
          <Download className="size-4" />
          {t('save.export')}
        </Button>
        <Button variant="outline" onClick={() => input.current?.click()}>
          <Upload className="size-4" />
          {t('save.import')}
        </Button>
        <Button
          variant="ghost"
          className="text-destructive"
          onClick={() => {
            setError('');
            setPending('reset');
            setStep(1);
          }}
        >
          <RotateCcw className="size-4" />
          {t('save.reset')}
        </Button>
      </div>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        className="hidden"
        aria-label={t('save.import')}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          try {
            if (file.size > 10 * 1024 * 1024) throw new Error('Save too large');
            setPending(parseSaveFile(await file.text()));
            setStep(1);
            setError('');
          } catch {
            setError(t('save.invalid'));
          }
        }}
      />
      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="paper-texture rounded-3xl bg-card"
        >
          <DialogTitle className="text-xl font-semibold">
            {t(pending === 'reset' ? 'save.reset' : 'save.import')}
          </DialogTitle>
          <DialogDescription className="text-sm leading-6">
            {t(
              pending === 'reset'
                ? step === 1
                  ? 'save.resetWarning'
                  : 'save.resetFinal'
                : 'save.importWarning',
            )}
          </DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={close}>
              {t('save.cancel')}
            </Button>
            <Button
              variant={pending === 'reset' ? 'destructive' : 'default'}
              onClick={() => {
                if (pending === 'reset' && step === 1) {
                  setStep(2);
                  return;
                }
                try {
                  if (pending === 'reset') resetSaveData();
                  else if (pending) importSaveFile(pending);
                  window.location.reload();
                } catch {
                  close();
                  setError(t('save.failed'));
                }
              }}
            >
              {t(
                pending === 'reset'
                  ? step === 1
                    ? 'save.continue'
                    : 'save.confirmReset'
                  : 'save.confirmImport',
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
