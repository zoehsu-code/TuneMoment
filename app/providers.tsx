'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ToastProvider } from '@/components/ui/Toast';
import { FeedProvider } from '@/components/tunemoment/feed';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          mutations: { retry: 0 },
        },
      })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <FeedProvider>{children}</FeedProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
