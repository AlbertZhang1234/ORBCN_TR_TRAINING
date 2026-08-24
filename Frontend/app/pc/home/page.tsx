'use client';

import { useEffect, useMemo, useState } from 'react';
import { Box, ThemeProvider, createTheme } from '@mui/material';
import { CAppHeader, NavigationIsland, usePageLayout } from 'orbcafe-ui';
import { useRouter } from 'next/navigation';
import { usePcI18n } from '../_components/PcI18nProvider';
import { buildPcMenuData, HeaderLogo } from '../_components/nav';
import { getSessionUser, type SessionUser } from '../_components/session';
import { performClientLogout } from '../../../services/Auth/logoutClient';
import HomeDesktopCards from '../../../components/DesktopCards/HomeDesktopCards';
import HomeAiAssistant from './HomeAiAssistant';

export default function HomePage() {
  const router = useRouter();
  const { t, lang, changeLanguage } = usePcI18n();
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [mode, setMode] = useState<'light' | 'dark' | 'system'>('system');
  const [systemMode, setSystemMode] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);
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

  const menuData = useMemo(() => buildPcMenuData(t), [t]);
  const resolvedMode = mode === 'system' ? (mounted ? systemMode : 'light') : mode;
  const muiTheme = useMemo(() => createTheme({ palette: { mode: resolvedMode } }), [resolvedMode]);
  const { navigationIslandProps, navigationMaxHeight } = usePageLayout({
    menuData,
    initialNavigationCollapsed: true,
  });

  useEffect(() => {
    setMounted(true);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyMode = () => setSystemMode(media.matches ? 'dark' : 'light');
    applyMode();
    media.addEventListener('change', applyMode);
    return () => media.removeEventListener('change', applyMode);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem('pc_color_mode', resolvedMode);
    document.documentElement.dataset.pcTheme = resolvedMode;
    document.documentElement.setAttribute('data-mui-color-scheme', resolvedMode);
  }, [mounted, resolvedMode]);

  const headerUser = useMemo(() => {
    if (!sessionUser) {
      return undefined;
    }
    const name =
      sessionUser.firstname && sessionUser.lastname
        ? `${sessionUser.firstname} ${sessionUser.lastname}`
        : sessionUser.userid;
    return {
      name,
      subtitle: sessionUser.email ?? '',
      avatarText: name.slice(0, 1).toUpperCase(),
    };
  }, [sessionUser]);

  if (!sessionUser) {
    return null;
  }

  const handleHeaderSearch = (query: string) => {
    const text = String(query ?? '').trim();
    if (!text) {
      return;
    }

    setAssistantOpen(true);
    setAssistantRequest({
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}`,
      text,
    });
  };

  return (
    <ThemeProvider theme={muiTheme}>
      <Box
        sx={(theme) => ({
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background:
            theme.palette.mode === 'dark'
              ? [
                  'radial-gradient(1280px 560px at 82% -10%, rgba(255,255,255,0.08), rgba(5,6,8,0))',
                  'radial-gradient(900px 460px at 12% 108%, rgba(156,163,175,0.08), rgba(5,6,8,0))',
                  'linear-gradient(180deg, #060607 0%, #0d0e10 48%, #131518 100%)',
                ].join(', ')
              : [
                  'radial-gradient(980px 480px at 88% -12%, rgba(59,130,246,0.15), rgba(255,255,255,0))',
                  'radial-gradient(760px 360px at 4% 104%, rgba(20,184,166,0.12), rgba(255,255,255,0))',
                  'linear-gradient(180deg, #f8fbff 0%, #f3f8ff 46%, #eff6ff 100%)',
                ].join(', '),
        })}
      >
        <CAppHeader
          appTitle={t('home', 'Home')}
          logo={<HeaderLogo />}
          mode={mode}
          onToggleMode={() => setMode((prev) => (prev === 'system' ? 'dark' : prev === 'dark' ? 'light' : 'system'))}
          user={headerUser}
          locale={lang}
          onLocaleChange={(l) => changeLanguage(l as any)}
          localeOptions={['en', 'zh']}
          onSearch={handleHeaderSearch}
          onUserLogout={() => void performClientLogout({ router, replace: true })}
        />

        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
          <Box sx={{ p: 1.5, display: 'flex', alignItems: 'flex-start', flexShrink: 0 }}>
            <NavigationIsland {...navigationIslandProps} maxHeight={navigationMaxHeight} colorMode={resolvedMode} />
          </Box>

          <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto', p: 1.5 }}>
            <Box
              sx={{
                minHeight: '100%',
                height: '100%',
                width: '100%',
                p: { xs: 1, md: 2 },
                display: 'flex',
              }}
            >
              <HomeDesktopCards sessionUser={sessionUser} />
            </Box>
          </Box>
        </Box>

        <HomeAiAssistant
          open={assistantOpen}
          onClose={() => setAssistantOpen(false)}
          request={assistantRequest}
          sessionUser={sessionUser}
          lang={lang}
        />
      </Box>
    </ThemeProvider>
  );
}
