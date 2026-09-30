'use client';

import Link from 'next/link';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { logout } from '@/store/slices/authSlice';
import { useRouter } from 'next/navigation';
import { ShieldOff, Mail, Phone, LogOut, RefreshCcw } from 'lucide-react';

export default function NoPermissionPage() {
  const dispatch = useAppDispatch();
  const router   = useRouter();
  const user     = useAppSelector((s) => s.auth.user);

  const handleLogout = () => {
    dispatch(logout());
    router.replace('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      {/* Subtle decorative blobs */}
      <div
        className="pointer-events-none fixed -top-40 -left-40 w-[28rem] h-[28rem] rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, hsl(356 60% 50%), transparent 70%)' }}
      />
      <div
        className="pointer-events-none fixed -bottom-40 -right-24 w-[32rem] h-[32rem] rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, hsl(24 60% 50%), transparent 70%)' }}
      />

      <div className="relative z-10 w-full max-w-lg text-center">
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl border border-border bg-card shadow-xl shadow-destructive/10">
          <ShieldOff className="h-12 w-12 text-destructive/70" strokeWidth={1.5} />
        </div>

        {/* Heading */}
        <h1 className="text-3xl font-black tracking-tight text-foreground mb-3">
          No Access Permissions
        </h1>

        <p className="text-base text-muted-foreground leading-relaxed mb-2">
          Hello{user?.name ? `, ${user.name}` : ''}. Your account does not have any menu
          permissions assigned yet.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed mb-8">
          Please contact your manager or system administrator to get the appropriate
          permissions assigned to your account before you can use USH Desk.
        </p>

        {/* Info card */}
        <div className="rounded-2xl border border-border bg-card p-6 mb-8 text-left shadow-sm">
          <p className="text-sm font-semibold text-foreground mb-4">
            What should you do?
          </p>
          <ul className="space-y-3">
            <li className="flex items-start gap-3 text-sm text-muted-foreground">
              <Mail className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <span>
                Send an email to your branch manager or system administrator requesting the
                necessary access permissions.
              </span>
            </li>
            <li className="flex items-start gap-3 text-sm text-muted-foreground">
              <Phone className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <span>
                Call or message your manager directly and provide them your employee account
                details so they can set up your permissions.
              </span>
            </li>
            <li className="flex items-start gap-3 text-sm text-muted-foreground">
              <RefreshCcw className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <span>
                Once your manager assigns permissions, log out and log back in to see your
                updated access.
              </span>
            </li>
          </ul>
        </div>

        {/* Account info badge */}
        {user && (
          <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 mb-6 text-sm text-muted-foreground flex items-center justify-between">
            <span>
              Logged in as <span className="font-semibold text-foreground">{user.name}</span>
              {user.branch_name ? (
                <> &mdash; <span className="text-foreground">{user.branch_name}</span></>
              ) : null}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              style={{ background: 'hsl(20 40% 20%)', color: 'hsl(20 60% 80%)' }}
            >
              {user.user_type}
            </span>
          </div>
        )}

        {/* Actions */}
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-destructive/30 active:translate-y-0"
          style={{
            background: 'linear-gradient(135deg, hsl(20 50% 35%) 0%, hsl(20 55% 28%) 100%)',
          }}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
