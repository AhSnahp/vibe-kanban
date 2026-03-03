import { Link, useRouterState } from '@tanstack/react-router';
import {
  House,
  Lightning,
  Robot,
  GitBranch,
  SquaresFour,
} from '@phosphor-icons/react';
import { cn } from '@cc/lib/cn';

const navItems = [
  { to: '/' as const, label: 'Dashboard', icon: House },
  { to: '/brainstorm' as const, label: 'Brainstorm', icon: Lightning },
  { to: '/workspaces' as const, label: 'Workspaces', icon: Robot },
  { to: '/workflows' as const, label: 'Workflows', icon: GitBranch },
  { to: '/multi' as const, label: 'Multi-Agent', icon: SquaresFour },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="flex flex-col w-48 border-r bg-secondary shrink-0">
      <div className="p-base px-double font-semibold text-lg text-high tracking-tight">
        Command Center
      </div>
      <nav className="flex flex-col gap-half p-half">
        {navItems.map(({ to, label, icon: Icon }) => {
          const active =
            to === '/' ? pathname === '/' : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex items-center gap-base px-base py-half rounded-sm text-sm',
                active
                  ? 'bg-panel text-high font-medium'
                  : 'text-normal hover:bg-panel/50'
              )}
            >
              <Icon size={16} weight={active ? 'fill' : 'regular'} />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
