import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { configureAuthRuntime } from '@/shared/lib/auth/runtime';
import { queryClient } from '@/shared/lib/queryClient';
import { TerminalProvider } from '@/shared/providers/TerminalProvider';
import { router } from '@cc/app/router';
import '@cc/styles/index.css';

configureAuthRuntime({
  getToken: async () => 'local-mode',
  triggerRefresh: async () => 'local-mode',
  registerShape: () => () => {},
  getCurrentUser: async () => ({
    user_id: '00000000-0000-0000-0000-000000000000',
  }),
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <TerminalProvider>
        <RouterProvider router={router} />
      </TerminalProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
