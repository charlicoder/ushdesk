import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
      <h1 className="text-4xl font-bold tracking-tight">404 - Page Not Found</h1>
      <p className="mt-2 text-muted-foreground">The page you are looking for does not exist.</p>
      <Link
        href="/"
        className="mt-6 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
      >
        Return Home
      </Link>
    </div>
  );
}
