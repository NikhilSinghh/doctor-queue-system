import React, { useEffect } from 'react';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import axios from 'axios';
import '../styles/globals.css';
import { useStore } from '../store/useStore';

// Global axios rewrite for mobile/local network compatibility
if (typeof window !== 'undefined') {
  axios.interceptors.request.use((config) => {
    // Hardcode the default fallback to the live Render backend
    const productionUrl = process.env.NEXT_PUBLIC_API_URL || 'https://doctor-queue-backend-1eka.onrender.com';
    if (config.url && config.url.includes('localhost:5000')) {
      const baseUrl = productionUrl.endsWith('/') ? productionUrl.slice(0, -1) : productionUrl;
      config.url = config.url.replace('http://localhost:5000', baseUrl);
    }
    return config;
  });
}

export default function App({ Component, pageProps }: AppProps) {
  const { theme } = useStore();

  useEffect(() => {
    // Inject correct theme on mount
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return (
    <>
      <Head>
        <title>Smart Queue - AI Powered Clinic Queue System</title>
        <meta name="description" content="AI-Powered Smart Doctor Appointment Booking & Queue Prediction System. Eliminate physical waiting times in clinics and hospitals." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
