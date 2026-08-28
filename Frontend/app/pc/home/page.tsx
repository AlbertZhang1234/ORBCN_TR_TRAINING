'use client';

import { useCallback, useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { useRouter } from 'next/navigation';
import { usePcI18n } from '../_components/PcI18nProvider';
import { getSessionUser, type SessionUser } from '../_components/session';
import HomeDesktopCards from '../../../components/DesktopCards/HomeDesktopCards';
import HomeAiAssistant from './HomeAiAssistant';
import { PcContentLayout } from '../_components/PcContentLayout';
import { usePcHeaderSearch } from '../_components/PcAppShell';

export default function HomePage() {
  const router = useRouter();
  const { lang } = usePcI18n();
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantRequest, setAssistantRequest] = useState<{ id: string; text: string } | null>(null);

  useEffect(() => {
    const user = getSessionUser();
    if (!user) {
      router.replace('/pc/login');
      return;
    }
    setSessionUser(user);
  }, [router]);

  const handleHeaderSearch = useCallback((query: string) => {
    const text = String(query ?? '').trim();
    if (!text) return;
    setAssistantOpen(true);
    setAssistantRequest({
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}`,
      text,
    });
  }, []);

  usePcHeaderSearch(handleHeaderSearch);

  if (!sessionUser) return null;

  return (
    <PcContentLayout contentSx={{ minHeight: '100%', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
      <Box sx={{ minHeight: '100%', height: '100%', width: '100%', p: { xs: 1, md: 2 }, display: 'flex' }}>
        <HomeDesktopCards sessionUser={sessionUser} />
      </Box>
      <HomeAiAssistant
        open={assistantOpen}
        onClose={() => setAssistantOpen(false)}
        request={assistantRequest}
        sessionUser={sessionUser}
        lang={lang}
      />
    </PcContentLayout>
  );
}
