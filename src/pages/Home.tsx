import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';
import { categories } from '@/data/categories';

function LocaleSwitcher() {
  const { locale, setLocale } = useLocale();
  return (
    <div className="flex gap-1 text-sm">
      <button
        type="button"
        onClick={() => setLocale('zh')}
        className={
          locale === 'zh'
            ? 'font-semibold text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }
      >
        中
      </button>
      <span className="text-muted-foreground">|</span>
      <button
        type="button"
        onClick={() => setLocale('en')}
        className={
          locale === 'en'
            ? 'font-semibold text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }
      >
        En
      </button>
    </div>
  );
}

const Home = () => {
  const { t } = useLocale();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-4">
        <div className="mx-auto flex max-w-4xl items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {t('home.title')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('home.subtitle')}
            </p>
          </div>
          <LocaleSwitcher />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={cat.path}
              className="group block rounded-lg border border-border bg-card p-5 shadow-sm transition hover:border-primary/50 hover:shadow-md"
            >
              <h2 className="text-lg font-semibold text-foreground group-hover:text-primary">
                {t(`category.${cat.id}.name`)}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {t(`category.${cat.id}.description`)}
              </p>
              <Button className="mt-4 w-full" variant="secondary" size="sm">
                {t('common.enter')}
              </Button>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Home;
