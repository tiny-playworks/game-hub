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
        'inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800/80 p-1 border border-slate-200/50 dark:border-slate-700/50 shadow-sm backdrop-blur-xs transition-all duration-300',
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
            ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
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
            ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200',
        )}
      >
        EN
      </button>
    </div>
  );
}
