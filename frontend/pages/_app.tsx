import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { ClerkProvider } from '@clerk/nextjs';
import ErrorBoundary from '../components/ErrorBoundary';

export default function App({ Component, pageProps }: AppProps) {
  return (
    // 👇 This wrapper is CRITICAL. It enables authentication for every page.
    <ClerkProvider {...pageProps}>
      <ErrorBoundary>
        <Component {...pageProps} />
      </ErrorBoundary>
    </ClerkProvider>
  );
}