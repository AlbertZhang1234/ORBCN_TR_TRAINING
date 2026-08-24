'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { Box, Chip, IconButton, Stack } from '@mui/material';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import type { PropsWithChildren } from 'react';
import { usePcColorMode } from './color-mode';
import { usePcI18n } from './PcI18nProvider';

const Galaxy = dynamic(() => import('../../../components/Animations/Galaxy'), { ssr: false });

export function AuthFrame({ children }: PropsWithChildren) {
  const { mode, toggleMode } = usePcColorMode();
  const { lang, changeLanguage } = usePcI18n();
  const isDark = mode === 'dark';
  const logoSrc = isDark ? '/images/orbis-china-white.png' : '/images/2021_10_orbis_4C-BIG.png';

  return (
    <Box
      sx={{
        minHeight: '100vh',
        position: 'relative',
        bgcolor: isDark ? '#0b2a69' : '#d7e8ff',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
        }}
      >
        {isDark ? (
          <Galaxy density={1.25} mouseRepulsion />
        ) : null}
      </Box>

      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background:
            isDark
              ? 'radial-gradient(circle at 50% 20%, rgba(46,107,225,0.2), rgba(8,22,58,0.7) 38%, rgba(8,22,58,0.92) 72%), repeating-linear-gradient(0deg, rgba(255,255,255,0.14) 0px, rgba(255,255,255,0.14) 1px, transparent 1px, transparent 72px), repeating-linear-gradient(90deg, rgba(255,255,255,0.14) 0px, rgba(255,255,255,0.14) 1px, transparent 1px, transparent 72px)'
              : 'repeating-linear-gradient(0deg, rgba(11,42,105,0.16) 0px, rgba(11,42,105,0.16) 1px, transparent 1px, transparent 72px), repeating-linear-gradient(90deg, rgba(11,42,105,0.16) 0px, rgba(11,42,105,0.16) 1px, transparent 1px, transparent 72px)',
          opacity: isDark ? 0.9 : 0.65,
          pointerEvents: 'none',
        }}
      />

      <Box sx={{ position: 'absolute', top: 32, left: 40, zIndex: 2 }}>
        <Image
          src={logoSrc}
          alt="Orbis"
          width={isDark ? 140 : 170}
          height={36}
          style={{ width: 'auto', height: 36, objectFit: 'contain' }}
        />
      </Box>

      <Box sx={{ position: 'absolute', top: 28, right: 36, zIndex: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <IconButton
            onClick={toggleMode}
            sx={{
              color: isDark ? '#e8f2ff' : '#0d2f73',
              bgcolor: isDark ? 'rgba(232,242,255,0.12)' : 'rgba(13,47,115,0.08)',
              border: `1px solid ${isDark ? 'rgba(232,242,255,0.25)' : 'rgba(13,47,115,0.25)'}`,
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
        </Stack>
      </Box>

      <Box sx={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 760 }}>{children}</Box>
    </Box>
  );
}
