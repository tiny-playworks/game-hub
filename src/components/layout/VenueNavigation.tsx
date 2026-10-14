import { NavLink, useLocation } from 'react-router-dom';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { MemberSelector } from '@/components/household/MemberSelector';
import { SyncStatus } from '@/components/household/SyncStatus';
import { ThemeSwitcher } from '@/components/common/ThemeSwitcher';
import { WalletBadge } from '@/components/WalletBadge';
import { useLocale } from '@/contexts/LocaleContext';

const links = [
  ['/', 'venue.nav.home'],
  ['/family', 'venue.nav.family'],
  ['/characters', 'characters.title'],
  ['/achievements', 'home.quick.achievements'],
  ['/shop', 'shop.title'],
  ['/profile', 'profile.title'],
] as const;

/** Public pages share navigation; games keep their own compact control bars. */
export function VenueNavigation() {
  const { t } = useLocale();
  const { pathname } = useLocation();
  if (pathname.startsWith('/game/')) return null;
  return (
    <header className="venue-navigation">
      <div className="venue-navigation-inner">
        <NavLink to="/" className="venue-brand" aria-label="Game Hub">
          <span aria-hidden="true">中</span>
          GAME HUB
        </NavLink>
        <nav className="venue-nav-links" aria-label={t('venue.nav.label')}>
          {links.map(([path, key]) => (
            <NavLink key={path} to={path} end={path === '/'}>
              {t(key)}
            </NavLink>
          ))}
        </nav>
        <div className="venue-nav-tools">
          <SyncStatus />
          <MemberSelector />
          <WalletBadge />
          <LanguageSwitcher />
          <ThemeSwitcher />
        </div>
      </div>
    </header>
  );
}
