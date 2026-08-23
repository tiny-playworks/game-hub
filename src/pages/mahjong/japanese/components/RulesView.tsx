import { BookOpen, Check, ChevronLeft, Play, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLocale } from '@/contexts/LocaleContext';
import { cn } from '@/lib/utils';
import { RIICHI_THEMES, type RiichiThemeId } from '../constants';
import { GuidePanel } from './GuidePanel';

type MatchLength = 'east' | 'south';

type Props = {
  matchLength: MatchLength;
  onMatchLengthChange: (value: MatchLength) => void;
  theme: RiichiThemeId;
  onThemeChange: (theme: RiichiThemeId) => void;
  onStart: () => void;
};

export function RulesView({
  matchLength,
  onMatchLengthChange,
  theme,
  onThemeChange,
  onStart,
}: Props) {
  const { t } = useLocale();
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <div className="riichi-lobby">
      <header className="riichi-lobby-header">
        <Link to="/">
          <ChevronLeft aria-hidden="true" size={20} />
          {t('common.backHome')}
        </Link>
        <span>TINY GAME HUB · RIICHI</span>
      </header>

      <main className="riichi-lobby-main">
        <section className="riichi-lobby-intro">
          <div className="riichi-lobby-badge">
            <span>DESKTOP BETA</span>
            <i />
            规则引擎已接入
          </div>
          <p className="riichi-lobby-kicker">RIICHI PRACTICE TABLE</p>
          <h1>日本立直麻将</h1>
          <p className="riichi-lobby-lead">
            面向电脑大屏的完整练习牌桌。专注行牌、听牌与局面判断，不用在手机框里挤牌，也不被大厅任务打断。
          </p>

          <div className="riichi-lobby-capabilities">
            <span>
              <Check aria-hidden="true" size={16} />
              四人完整牌桌
            </span>
            <span>
              <Check aria-hidden="true" size={16} />
              规则引擎和牌判定
            </span>
            <span>
              <Check aria-hidden="true" size={16} />
              本地训练提示
            </span>
            <span>
              <Check aria-hidden="true" size={16} />
              无需账号与联网
            </span>
          </div>

          <button
            type="button"
            className="riichi-lobby-guide-button"
            onClick={() => setGuideOpen(true)}
          >
            <BookOpen aria-hidden="true" size={18} />
            查看完整规则与新人指南
          </button>
        </section>

        <section className="riichi-lobby-setup" aria-label="对局设置">
          <div className="riichi-lobby-setup-heading">
            <span>TABLE SETUP</span>
            <h2>准备开局</h2>
            <p>设置只保存在当前浏览器中。</p>
          </div>

          <fieldset>
            <legend>场次</legend>
            <div className="riichi-match-options">
              {(['east', 'south'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={cn(matchLength === value && 'is-active')}
                  onClick={() => onMatchLengthChange(value)}
                  aria-pressed={matchLength === value}
                >
                  <strong>{value === 'east' ? '东风场' : '南风场'}</strong>
                  <span>{value === 'east' ? '东一至东四' : '东一至南四'}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>牌桌主题</legend>
            <div className="riichi-lobby-themes">
              {RIICHI_THEMES.map(({ id }) => (
                <button
                  key={id}
                  type="button"
                  className={cn(theme === id && 'is-active')}
                  onClick={() => onThemeChange(id)}
                  aria-pressed={theme === id}
                >
                  <span className={`riichi-theme-preview is-${id}`}>
                    <i />
                  </span>
                  <strong>{t(`game.mahjong.themes.${id}`)}</strong>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="riichi-lobby-assurance">
            <ShieldCheck aria-hidden="true" size={19} />
            <span>纯前端本地运行 · 不上传牌局数据</span>
          </div>

          <button
            type="button"
            className="riichi-lobby-start"
            onClick={onStart}
          >
            <span>
              <strong>{t('common.startGame')}</strong>
              <small>
                {matchLength === 'east' ? '东风场' : '南风场'} · 四人对局
              </small>
            </span>
            <Play aria-hidden="true" size={20} fill="currentColor" />
          </button>
        </section>
      </main>

      {guideOpen && (
        <dialog
          open
          className="riichi-guide-dialog"
          aria-labelledby="guide-title"
        >
          <button
            type="button"
            className="riichi-guide-backdrop"
            onClick={() => setGuideOpen(false)}
            aria-label="关闭规则"
          />
          <div className="riichi-guide-dialog-content">
            <GuidePanel onClose={() => setGuideOpen(false)} />
          </div>
        </dialog>
      )}
    </div>
  );
}
