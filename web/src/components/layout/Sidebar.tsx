import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function Sidebar() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const isNutritionist = user?.roles.some((r) => ['Nutritionist', 'Admin'].includes(r));
  const isTrainer = user?.roles.some((r) => ['Trainer', 'Admin'].includes(r));

  const navItems = [
    { to: '/dashboard', icon: '\u{1F4CA}', label: t('sidebar.dashboard') },
    { to: '/clients', icon: '\u{1F465}', label: t('sidebar.clients') },
    ...(isNutritionist
      ? [
          { to: '/foods', icon: '\u{1F34E}', label: t('sidebar.foods') },
          { to: '/recipes', icon: '\u{1F4D6}', label: t('sidebar.recipes') },
          { to: '/plans', icon: '\u{1F4CB}', label: t('sidebar.plans') },
        ]
      : []),
    ...(isTrainer
      ? [
          { to: '/exercises', icon: '\u{1F4AA}', label: t('sidebar.exercises') },
          { to: '/training-plans', icon: '\u{1F3CB}\u{FE0F}', label: t('sidebar.trainingPlans') },
        ]
      : []),
    { to: '/profile', icon: '\u{2699}\u{FE0F}', label: t('sidebar.settings') },
  ];

  const initials = user
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : '??';

  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-border bg-dark2 min-h-screen">
      {/* Logo */}
      <div className="border-b border-border px-5 py-4 font-heading text-base font-black uppercase tracking-wide">
        GoodFellas <span className="text-gold">Platform</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 py-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `relative mx-2 flex items-center gap-2.5 rounded-sm px-4 py-2.5 font-heading text-xs font-semibold uppercase tracking-wide transition-all ${
                isActive
                  ? 'bg-gold/8 text-gold before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-gold'
                  : 'text-text3 hover:bg-[#1a1712] hover:text-gold'
              }`
            }
          >
            <span className="w-[22px] text-center text-base">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Language switcher */}
      <div className="flex justify-center border-t border-border px-4 py-3">
        <LanguageSwitcher />
      </div>

      {/* User + Logout */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border-[1.5px] border-gold/30 bg-gold/10 font-heading text-xs font-bold text-gold">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold">
              {user?.firstName} {user?.lastName}
            </div>
            <div className="text-[11px] text-muted">
              {user?.roles.map((r) => t(`auth.role${r}`)).join(', ')}
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          className="mt-3 w-full rounded-sm border border-border bg-transparent px-3 py-1.5 font-heading text-[11px] font-semibold uppercase tracking-wide text-text3 transition-colors hover:border-red hover:text-red"
        >
          {t('auth.logout')}
        </button>
      </div>
    </aside>
  );
}
