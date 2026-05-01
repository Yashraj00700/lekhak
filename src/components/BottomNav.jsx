import { NavLink } from 'react-router-dom';
import { BookOpen, ImageIcon, Users, Library, Settings } from 'lucide-react';

const TABS = [
  { to: '/', icon: BookOpen, label: 'पुस्तके', match: ['/', '/book'] },
  { to: '/images', icon: ImageIcon, label: 'चित्रे' },
  { to: '/characters', icon: Users, label: 'पात्रे' },
  { to: '/glossary', icon: Library, label: 'शब्दार्थ' },
  { to: '/settings', icon: Settings, label: 'सेटिंग्ज' },
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      <div className="max-w-2xl mx-auto px-2 grid grid-cols-5">
        {TABS.map(({ to, icon: Icon, label, match }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => {
              const active =
                isActive ||
                (match && match.some((m) => location.pathname.startsWith(m) && m !== '/'));
              return (
                'flex flex-col items-center justify-center gap-1 min-h-[56px] py-1.5 rounded-[10px] mx-0.5 transition-colors ' +
                (active
                  ? 'text-[var(--color-terracotta)] bg-[rgba(196,98,45,0.10)]'
                  : 'text-[var(--color-ink-soft)] hover:bg-[rgba(201,151,58,0.10)]')
              );
            }}
          >
            {({ isActive }) => (
              <>
                <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
                <span className="text-[11px] font-medium tracking-wide">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
