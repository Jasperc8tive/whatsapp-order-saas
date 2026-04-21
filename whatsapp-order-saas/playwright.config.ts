import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.e2e.local if it exists, else fallback to .env.local
const envPath = path.resolve(__dirname, '.env.e2e.local');
dotenv.config({ path: envPath });

envPath !== '.env.e2e.local' && dotenv.config({ path: path.resolve(__dirname, '.env.local') });

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  use: {
    baseURL: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    headless: true,
    trace: 'on-first-retry',
  },
});
