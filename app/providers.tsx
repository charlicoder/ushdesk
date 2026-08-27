'use client';

import { useEffect } from 'react';
import { Provider } from 'react-redux';
import { useAppSelector } from '@/store/hooks';
import { store } from '@/store';

function DirSync() {
  const locale = useAppSelector((s) => s.ui.locale);
  const theme = useAppSelector((s) => s.ui.theme);

  useEffect(() => {
    const html = document.documentElement;
    html.lang = locale;
    html.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale]);

  useEffect(() => {
    const html = document.documentElement;
    if (theme === 'dark') html.classList.add('dark');
    else html.classList.remove('dark');
  }, [theme]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <DirSync />
      {children}
    </Provider>
  );
}

