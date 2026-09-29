import { X } from 'lucide-react';
import { useLocale } from '@/contexts/LocaleContext';

type Props = {
  onClose: () => void;
};

const GUIDE_SECTIONS = [
  {
    key: 'goal',
  },
  {
    key: 'controls',
  },
  {
    key: 'limits',
  },
];

export function GuidePanel({ onClose }: Props) {
  const { t } = useLocale();
  return (
    <div className="riichi-guide-panel">
      <header className="riichi-guide-header">
        <div>
          <p>RULES & ONBOARDING</p>
          <h2 id="guide-title">{t('riichi.guide.title')}</h2>
          <span>{t('riichi.guide.subtitle')}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('game.mahjong.close')}
        >
          <X aria-hidden="true" size={22} />
        </button>
      </header>

      <div className="riichi-guide-grid">
        {GUIDE_SECTIONS.map((section, index) => (
          <section key={section.key}>
            <p>
              {String(index + 1).padStart(2, '0')} ·{' '}
              {t(`riichi.guide.${section.key}.eyebrow`)}
            </p>
            <h3>{t(`riichi.guide.${section.key}.title`)}</h3>
            <ul>
              {[1, 2, 3].map((item) => (
                <li key={item}>
                  {t(`riichi.guide.${section.key}.item${item}`)}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section className="riichi-guide-rules">
        <div>
          <h3>{t('riichi.guide.rules.title')}</h3>
          <p>{t('riichi.guide.rules.body')}</p>
        </div>
        <div>
          <h3>{t('riichi.guide.scoring.title')}</h3>
          <p>{t('riichi.guide.scoring.body')}</p>
        </div>
        <div>
          <h3>{t('riichi.guide.end.title')}</h3>
          <p>{t('riichi.guide.end.body')}</p>
        </div>
      </section>
    </div>
  );
}
