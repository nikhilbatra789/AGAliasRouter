import { AppShell } from '@/components/AppShell';
import { ConfigurationPage } from '@/features/ui-pages';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const cookieStore = await cookies();
  if (cookieStore.get('aglias_session')?.value !== 'active') redirect('/login?next=/configuration');
  return (
    <AppShell>
      <ConfigurationPage />
    </AppShell>
  );
}
