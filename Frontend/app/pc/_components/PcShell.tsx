'use client';

import { useEffect, useState, useMemo } from 'react';
import type { PropsWithChildren } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Avatar,
  Box,
  IconButton,
  InputBase,
  Stack,
  Typography,
  Chip,
} from '@mui/material';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import { CNavigationIsland, NavigationItem } from '../../../components/Molecules/CNavigation-island';
import { buildPcMenuData } from './nav';
import { getSessionUser, SessionUser } from './session';
import { performClientLogout } from '../../../services/Auth/logoutClient';
import { usePcColorMode } from './color-mode';
import { usePcI18n } from './PcI18nProvider';

interface PcShellProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  navItems?: NavigationItem[];
}

export function PcShell({ title, subtitle, navItems, children }: PcShellProps) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const { mode, toggleMode } = usePcColorMode();
  const { t, lang, changeLanguage } = usePcI18n();
  const menuData = useMemo(() => buildPcMenuData(t), [t]);
  const isDark = mode === 'dark';

  useEffect(() => {
    const sessionUser = getSessionUser();
    if (!sessionUser) {
      router.replace('/pc/login');
      return;
    }
    setUser(sessionUser);
  }, [router]);

  const displayName =
    user?.firstname && user?.lastname
      ? `${user.firstname} ${user.lastname}`
      : user?.userid ?? 'Guest';

  const userEmail = user?.email ?? '';
  const logoSrc = isDark ? '/images/orbis-china-white.png' : '/images/2021_10_orbis_4C-BIG.png';

  const handleLogout = async () => {
    await performClientLogout({ router, replace: true });
  };

  if (!user) {
    return null;
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: isDark ? '#0c1f48' : '#eaf2ff',
        backgroundImage:
          isDark
            ? 'radial-gradient(circle at 50% 12%, rgba(51,109,224,0.24), rgba(12,31,72,0) 42%), linear-gradient(90deg, rgba(88,140,220,0.09), rgba(12,31,72,0) 40%, rgba(88,140,220,0.09) 100%)'
            : 'radial-gradient(circle at 50% 12%, rgba(84,142,235,0.2), rgba(234,242,255,0) 45%), linear-gradient(90deg, rgba(84,142,235,0.08), rgba(234,242,255,0) 40%, rgba(84,142,235,0.08) 100%)',
      }}
    >
      <Box
        sx={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(13,47,115,0.14)'}`,
          bgcolor: isDark ? 'rgba(8, 20, 47, 0.92)' : 'rgba(255, 255, 255, 0.84)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Image
            src={logoSrc}
            alt="Orbai"
            width={isDark ? 132 : 168}
            height={36}
            style={{ width: 'auto', height: 36, objectFit: 'contain' }}
          />
          <Typography sx={{ color: isDark ? '#f3f8ff' : '#1b3f88', fontSize: 30 }}>|</Typography>
          <Box>
            <Typography sx={{ color: isDark ? '#f3f8ff' : '#163a82', fontWeight: 700, lineHeight: 1 }}>
              {title}
            </Typography>
            {subtitle ? (
              <Typography
                sx={{ color: isDark ? 'rgba(243,248,255,0.72)' : 'rgba(22,58,130,0.72)', fontSize: 12 }}
              >
                {subtitle}
              </Typography>
            ) : null}
          </Box>
        </Stack>

        <Box
          sx={{
            width: { xs: 280, md: 420 },
            px: 1.5,
            py: 0.7,
            borderRadius: 999,
            bgcolor: isDark ? 'rgba(179,210,255,0.12)' : 'rgba(13,47,115,0.08)',
            border: `1px solid ${isDark ? 'rgba(179,210,255,0.2)' : 'rgba(13,47,115,0.16)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <SearchRoundedIcon
            sx={{ color: isDark ? 'rgba(226,238,255,0.7)' : 'rgba(13,47,115,0.65)', fontSize: 18 }}
          />
          <InputBase
            placeholder={t('search_placeholder', 'Ask me...')}
            sx={{
              color: isDark ? '#e6f0ff' : '#10367b',
              fontSize: 14,
              width: '100%',
              '& input::placeholder': {
                color: isDark ? 'rgba(230,240,255,0.58)' : 'rgba(16,54,123,0.48)',
                opacity: 1,
              },
            }}
          />
        </Box>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <IconButton
            size="small"
            onClick={toggleMode}
            sx={{
              color: isDark ? '#e8f2ff' : '#0d2f73',
              bgcolor: isDark ? 'rgba(232,242,255,0.12)' : 'rgba(13,47,115,0.08)',
              border: `1px solid ${isDark ? 'rgba(232,242,255,0.25)' : 'rgba(13,47,115,0.2)'}`,
            }}
          >
            {isDark ? <LightModeRoundedIcon fontSize="small" /> : <DarkModeRoundedIcon fontSize="small" />}
          </IconButton>
          <Chip
            label={lang === 'en' ? 'EN' : '中'}
            size="small"
            onClick={() => changeLanguage(lang === 'en' ? 'zh' : 'en')}
            sx={{
              cursor: 'pointer',
              color: isDark ? '#e9f2ff' : '#123773',
              bgcolor: isDark ? 'rgba(173,204,255,0.14)' : 'rgba(13,47,115,0.08)',
              border: `1px solid ${isDark ? 'rgba(173,204,255,0.28)' : 'rgba(13,47,115,0.2)'}`,
              '&:hover': {
                 bgcolor: isDark ? 'rgba(173,204,255,0.24)' : 'rgba(13,47,115,0.16)',
              }
            }}
          />
          <Stack spacing={0} alignItems="flex-end">
            <Typography sx={{ color: isDark ? '#eff6ff' : '#123773', fontWeight: 600, fontSize: 13 }}>
              {displayName}
            </Typography>
            {userEmail ? (
              <Typography
                sx={{ color: isDark ? 'rgba(239,246,255,0.68)' : 'rgba(18,55,115,0.7)', fontSize: 12 }}
              >
                {userEmail}
              </Typography>
            ) : null}
          </Stack>
          <Avatar
            sx={{
              width: 34,
              height: 34,
              bgcolor: isDark ? 'rgba(218,232,255,0.32)' : 'rgba(13,47,115,0.12)',
              color: isDark ? '#f5f9ff' : '#123773',
            }}
          >
            {displayName.slice(0, 1).toUpperCase()}
          </Avatar>
          <IconButton onClick={handleLogout} size="small" sx={{ color: isDark ? '#d5e7ff' : '#123773' }}>
            <LogoutRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'stretch', minHeight: 'calc(100vh - 64px)' }}>
        <Box sx={{ p: 1.5 }}>
          <CNavigationIsland items={navItems} menuData={navItems ? undefined : menuData} title="Menu" mode={mode} />
        </Box>
        <Box sx={{ flex: 1, pr: 2, pb: 2 }}>{children}</Box>
      </Box>
    </Box>
  );
}
