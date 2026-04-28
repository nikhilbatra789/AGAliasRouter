'use client';

import { Suspense } from 'react';
import { LoginPage } from '@/features/ui-pages';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginPage />
    </Suspense>
  );
}
