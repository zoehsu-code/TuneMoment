'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { AudioLines, Bell, Compass, Plus, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const HIDDEN_PREFIXES = ['/daw', '/mix'];

function isHidden(pathname: string): boolean {
  return HIDDEN_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (isHidden(pathname)) return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col bg-white text-[#17171B]">
      <TopBar />
      <div className="flex-1 pb-28">{children}</div>
      <BottomNav pathname={pathname} />
    </div>
  );
}

function TopBar() {
  const [notesOpen, setNotesOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-[#E7E7EC] bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="TuneMoment home">
          <span className="tm-gradient flex h-8 w-8 items-center justify-center rounded-lg text-white">
            <AudioLines className="h-4 w-4" strokeWidth={2.4} />
          </span>
          <span className="text-[17px] font-semibold tracking-tight">TuneMoment</span>
          <span className="hidden text-xs text-[#9A9AA5] sm:inline">Turn moments into music.</span>
        </Link>

        <div className="flex items-center gap-1.5">
          <div className="relative">
            <button
              type="button"
              aria-label="Notifications"
              aria-expanded={notesOpen}
              onClick={() => setNotesOpen((open) => !open)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-[#17171B] transition-colors hover:bg-[#F6F6F9]"
            >
              <Bell className="h-5 w-5" />
            </button>
            {notesOpen && (
              <div className="absolute right-0 top-11 w-64 rounded-2xl border border-[#E7E7EC] bg-white p-4 text-sm shadow-sm">
                <p className="font-medium text-[#17171B]">Notifications</p>
                <p className="mt-1 text-[#6F6F7B]">You&apos;re all caught up.</p>
              </div>
            )}
          </div>
          <Link
            href="/profile"
            aria-label="Your profile"
            className="tm-gradient flex h-9 w-9 items-center justify-center rounded-full p-[2px]"
          >
            <span className="flex h-full w-full items-center justify-center rounded-full bg-white text-xs font-semibold text-[#17171B]">
              Y
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}

function BottomNav({ pathname }: { pathname: string }) {
  const exploreActive = pathname.startsWith('/explore');
  const profileActive = pathname.startsWith('/profile');
  const createActive = pathname === '/' || pathname.startsWith('/studio');

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-3 sm:pb-4" aria-label="Primary">
      <div className="pointer-events-auto flex w-full max-w-md items-end justify-around rounded-2xl border border-[#E7E7EC] bg-white/95 px-4 py-2 shadow-[0_-8px_30px_-20px_rgba(23,23,27,0.25)] backdrop-blur-md">
        <NavItem href="/explore" label="Explore" active={exploreActive}>
          <Compass className="h-6 w-6" strokeWidth={activeStroke(exploreActive)} />
        </NavItem>

        <Link
          href="/"
          aria-label="Create"
          aria-current={createActive ? 'page' : undefined}
          className="flex flex-col items-center gap-0.5"
        >
          <span className="tm-gradient -mt-6 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-md transition-transform hover:scale-[1.03] active:scale-95">
            <Plus className="h-7 w-7" strokeWidth={2.4} />
          </span>
          <span className={`text-[11px] font-medium ${createActive ? 'text-[#7C3AED]' : 'text-[#6F6F7B]'}`}>Create</span>
        </Link>

        <NavItem href="/profile" label="Profile" active={profileActive}>
          <User className="h-6 w-6" strokeWidth={activeStroke(profileActive)} />
        </NavItem>
      </div>
    </nav>
  );
}

function activeStroke(active: boolean): number {
  return active ? 2.4 : 1.8;
}

function NavItem({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-w-16 flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-medium transition-colors',
        active ? 'text-[#7C3AED]' : 'text-[#6F6F7B] hover:text-[#17171B]',
      )}
    >
      {children}
      {label}
    </Link>
  );
}
