import { NavLink, useLocation } from 'react-router-dom';
import { BookOpen, ImageIcon, Users, Library, Settings } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage.jsx';

export default function BottomNav() {
  const { t } = useLanguage();
  const location = useLocation();

  const TABS = [
    { to: '/', icon: BookOpen, labelKey: 'nav.books', match: ['/', '/book'] },
    { to: '/images', icon: ImageIcon, labelKey: 'nav.images' },
    { to: '/characters', icon: Users, labelKey: 'nav.characters' },
    { to: '/glossary', icon: Library, labelKey: 'nav.glossary' },
    { to: '/settings', icon: Settings, labelKey: 'nav.settings' },
  ];

  return (
    <nav className="bottom-nav">
      <div className="max-w-2xl mx-auto px-2 grid grid-cols-5">
        {TABS.map(({ to, icon: Icon, labelKey, match }) => {
          const isActive =
            (to === '/' && (location.pathname === '/' || location.pathname.startsWith('/book'))) ||
            (to !== '/' && location.pathname.startsWith(to));

          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={
                'flex flex-col items-center justify-center gap-1 min-h-[56px] py-1.5 rounded-[10px] mx-0.5 transition-colors ' +
                (isActive
                  ? 'text-[var(--color-terracotta)] bg-[rgba(196,98,45,0.10)]'
                  : 'text-[var(--theme-text-soft)] hover:bg-[rgba(201,151,58,0.10)]')
              }
            >
              <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
              <span className="text-[11px] font-medium tracking-wide leading-none">
                {t(labelKey)}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
