import { Languages } from 'lucide-react';
import { useLocale } from '@/contexts/LocaleContext';
import { cn } from '@/lib/utils';

interface LanguageSwitcherProps {
  className?: string;
}

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { locale, setLocale } = useLocale();

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-muted p-1 border border-border shadow-sm backdrop-blur-xs transition-all duration-300',
        className,
      )}
    >
      <Languages className="size-3.5 text-muted-foreground ml-2 mr-1" />
      <button
        type="button"
        onClick={() => setLocale('zh')}
        className={cn(
          'cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-250 ease-out select-none active:scale-95',
          locale === 'zh'
            ? 'bg-card text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        中
      </button>
      <button
        type="button"
        onClick={() => setLocale('en')}
        className={cn(
          'cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-250 ease-out select-none active:scale-95',
          locale === 'en'
            ? 'bg-card text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        EN
      </button>
    </div>
  );
}
