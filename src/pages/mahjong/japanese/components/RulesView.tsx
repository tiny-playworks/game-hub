import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/contexts/LocaleContext';

type MatchLength = 'east' | 'south';

type Props = {
  matchLength: MatchLength;
  onMatchLengthChange: (v: MatchLength) => void;
  onStart: () => void;
};

export function RulesView({
  matchLength,
  onMatchLengthChange,
  onStart,
}: Props) {
  const { t } = useLocale();
  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <Link
          to="/"
          className="text-muted-foreground hover:text-foreground"
        >
          ← {t('common.backHome')}
        </Link>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="text-xl font-bold text-foreground">日本立直麻将</h1>
        <p className="mt-2 text-muted-foreground">
          天凤/雀魂标准，规则以 skill「mahjong-japanese-riichi」为准
        </p>

        <section className="mt-6 rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">
            核心规则摘要
          </h2>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
            <li>4 人 · 136 张 + 红宝牌 3 枚（赤 5 万/筒/索）</li>
            <li>无役不能和了；振听只能自摸，不能荣和</li>
            <li>
              立直：门前清听牌宣告，放 1000
              点棒；立直后禁止换牌、禁止吃/碰/明杠/补杠，仅可暗杠与和了
            </li>
            <li>宝牌只加番不算役；里宝牌在立直和了时翻开；开杠时追加杠宝牌</li>
            <li>
              加杠（补杠）可被抢杠；一发：立直一巡内和了且本巡无吃碰杠 +1 番
            </li>
            <li>
              符数最小 10 符，七对子固定 25 符；1–2 番按 符×2^(番+2)，3
              番满贯、5–6 番跳满、7–10 番倍满、≥13 役满
            </li>
          </ul>
        </section>

        <section className="mt-4 rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">
            起和役（常用）
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            立直(1)、门前清自摸(1)、断幺九(1)、役牌(1)、平和(1)、一发(1)、七对子(2)、混一色(3)、清一色(6)
            等；满贯 12000/8000、跳满 18000/12000、役满 48000/32000（亲/子）
          </p>
        </section>

        <section className="mt-4 rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">场次</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            东风场：东1～东4局，东4局子家胡或流局后结束。南风场：东1～南4局。
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              variant={matchLength === 'east' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onMatchLengthChange('east')}
            >
              东风场
            </Button>
            <Button
              type="button"
              variant={matchLength === 'south' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onMatchLengthChange('south')}
            >
              南风场
            </Button>
          </div>
        </section>

        <div className="mt-6">
          <Button
            onClick={onStart}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {t('common.startGame')}
          </Button>
        </div>
      </main>
    </div>
  );
}
