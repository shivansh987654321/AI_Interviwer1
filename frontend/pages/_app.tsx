import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { ClerkProvider, useAuth } from '@clerk/nextjs';
import ErrorBoundary from '../components/ErrorBoundary';
import axios from 'axios';
import { useEffect } from 'react';

// Attaches Clerk Bearer token to every outgoing axios request automatically
function AxiosAuthSetup() {
  const { getToken } = useAuth();
  useEffect(() => {
    const id = axios.interceptors.request.use(async (config) => {
      try {
        const token = await getToken();
        if (token) config.headers.Authorization = `Bearer ${token}`;
      } catch { /* ignore — unauthenticated pages will still work */ }
      return config;
    });
    return () => axios.interceptors.request.eject(id);
  }, [getToken]);
  return null;
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ClerkProvider>
      <ErrorBoundary>
        <AxiosAuthSetup />
        <Component {...pageProps} />
      </ErrorBoundary>
    </ClerkProvider>
  );
}