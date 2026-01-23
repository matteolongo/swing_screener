'use client';

import type { ReactNode } from 'react';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import { CssBaseline, ThemeProvider } from '@mui/material';
import theme from '@/lib/theme';

interface ThemeRegistryProps {
  children: ReactNode;
}

export default function ThemeRegistry({ children }: ThemeRegistryProps) {
  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
