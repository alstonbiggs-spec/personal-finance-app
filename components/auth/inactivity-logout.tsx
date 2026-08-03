'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;

export function InactivityLogout() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        await supabase.auth.signOut();
        router.replace('/login?reason=inactive');
        router.refresh();
      }, INACTIVITY_LIMIT_MS);
    };

    const activityEvents = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'mousemove'] as const;
    activityEvents.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timer);
      activityEvents.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [router]);

  return null;
}
