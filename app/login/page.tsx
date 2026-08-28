'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { loginThunk, clearError } from '@/store/slices/authSlice';
import { Eye, EyeOff, Phone, Lock, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const router   = useRouter();

  const { status, error, user } = useAppSelector((s) => s.auth);

  const [phone, setPhone]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (status === 'succeeded' && user) {
      router.replace('/');
    }
  }, [status, user, router]);

  // Clear stale error when user edits inputs
  useEffect(() => {
    if (error) dispatch(clearError());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !password.trim()) return;
    await dispatch(loginThunk({ phone_number: phone.trim(), password }));
  };

  const isLoading = status === 'loading';

  return (
    <div className="min-h-screen flex bg-background overflow-hidden">

      {/* ── Left: Brand panel ──────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center p-14 overflow-hidden">
        {/* animated background */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(135deg, hsl(20 35% 28%) 0%, hsl(20 40% 18%) 50%, hsl(15 30% 12%) 100%)',
          }}
        />
        {/* decorative blobs */}
        <div
          className="absolute -top-40 -left-40 w-[26rem] h-[26rem] rounded-full opacity-30"
          style={{ background: 'radial-gradient(circle, hsl(24 60% 50%), transparent 70%)' }}
        />
        <div
          className="absolute -bottom-40 -right-24 w-[32rem] h-[32rem] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, hsl(356 60% 50%), transparent 70%)' }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center text-center text-white">
          {/* Logo */}
          <div
            className="mb-8 rounded-3xl overflow-hidden shadow-2xl"
            style={{
              background: 'rgba(255,255,255,0.08)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.15)',
              padding: '16px',
            }}
          >
            <Image
              src="/ush-spa-logo.png"
              alt="USH SPA Logo"
              width={160}
              height={160}
              className="rounded-2xl"
              priority
            />
          </div>

          <h1
            className="text-5xl font-black tracking-tight mb-2"
            style={{ textShadow: '0 2px 24px rgba(0,0,0,0.4)' }}
          >
            USH Desk
          </h1>
          <p className="text-base font-medium opacity-70 mb-2">
            Spa Management Platform
          </p>
          <p className="text-sm opacity-50 max-w-xs leading-relaxed">
            Monitor appointments, manage staff, and track earnings across all your spa branches in real time.
          </p>

          {/* Feature pills */}
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {['Live Appointments', 'Earnings Analytics', 'Multi-Branch', 'Smart Reports'].map((f) => (
              <span
                key={f}
                className="rounded-full px-4 py-1.5 text-xs font-semibold"
                style={{
                  background: 'rgba(255,255,255,0.10)',
                  border: '1px solid rgba(255,255,255,0.18)',
                }}
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right: Login form ────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 sm:p-10">

        {/* Mobile logo */}
        <div className="lg:hidden mb-8 flex flex-col items-center">
          <div
            className="mb-4 rounded-2xl overflow-hidden"
            style={{
              background: 'hsl(20 40% 20%)',
              padding: '8px',
            }}
          >
            <Image
              src="/ush-spa-logo.png"
              alt="USH SPA Logo"
              width={80}
              height={80}
              className="rounded-xl"
              priority
            />
          </div>
          <h1 className="text-3xl font-black text-foreground">USH Desk</h1>
          <p className="text-sm text-muted-foreground">Spa Management Platform</p>
        </div>

        <div className="w-full max-w-md">
          {/* Card */}
          <div className="rounded-3xl border border-border bg-card shadow-xl p-8 sm:p-10">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-foreground">Welcome back</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Sign in to your employee account to continue
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Phone */}
              <div className="space-y-1.5">
                <label htmlFor="login-phone" className="text-sm font-semibold text-foreground">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="login-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+96590000011"
                    autoComplete="tel"
                    disabled={isLoading}
                    className="h-12 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label htmlFor="login-password" className="text-sm font-semibold text-foreground">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    id="login-password"
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    disabled={isLoading}
                    className="h-12 w-full rounded-xl border border-border bg-background pl-10 pr-12 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                    aria-label={showPwd ? 'Hide password' : 'Show password'}
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Error banner */}
              {error && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                id="login-submit"
                type="submit"
                disabled={isLoading || !phone.trim() || !password.trim()}
                className="relative h-12 w-full overflow-hidden rounded-xl text-sm font-bold text-white shadow-lg transition-all duration-200 hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                style={{
                  background: 'linear-gradient(135deg, hsl(20 50% 35%) 0%, hsl(20 55% 28%) 100%)',
                }}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in…
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              This portal is restricted to{' '}
              <span className="font-semibold text-foreground">USH Spa employees</span> only.
            </p>
          </div>

          {/* Demo credentials */}
          <div className="mt-5 rounded-2xl border border-border/60 bg-muted/40 p-4">
            <p className="text-xs font-semibold text-foreground mb-2">Demo Credentials</p>
            <div className="space-y-1 text-xs text-muted-foreground font-mono">
              <p><span className="text-foreground">Phone:</span> +96590000011</p>
              <p><span className="text-foreground">Password:</span> Demo@123</p>
            </div>
            <button
              type="button"
              className="mt-3 text-xs text-primary hover:underline font-semibold"
              onClick={() => { setPhone('+96590000011'); setPassword('Demo@123'); }}
            >
              Fill demo credentials →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
