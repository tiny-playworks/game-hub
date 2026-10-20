import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';

export function GameReadyOverlay({
  title,
  description,
  onStart,
  label,
}: {
  title: string;
  description: string;
  onStart: () => void;
  label?: string;
}) {
  const { t } = useLocale();
  return (
    <div className="game-ready-overlay">
      <div className="game-ready-copy">
        <span className="game-ready-symbol" aria-hidden="true">
          <Play />
        </span>
        <h2>{title}</h2>
        <p>{description}</p>
        <Button onClick={onStart}>
          <Play className="size-4" />
          {label ?? t('common.start')}
        </Button>
      </div>
    </div>
  );
}
