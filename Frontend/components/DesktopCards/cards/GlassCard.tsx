'use client';

import { Box, Stack, Typography, useTheme } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import type { ReactNode } from 'react';

interface GlassCardProps {
  title: string;
  subtitle: string;
  icon?: ReactNode;
  headerRight?: ReactNode;
  onClick?: () => void;
  onTitleClick?: () => void;
  children: ReactNode;
  sx?: SxProps<Theme>;
}

export default function GlassCard(props: GlassCardProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      onClick={props.onClick}
      sx={{
        borderRadius: 6,
        p: 2.5,
        minHeight: 300,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: isDark ? '#f3f4f6' : '#0f172a',
        border: `1px solid ${isDark ? 'rgba(148,163,184,0.22)' : 'rgba(59,130,246,0.22)'}`,
        bgcolor: isDark ? 'rgba(16,18,21,0.9)' : '#ffffff',
        backgroundImage: isDark
          ? [
              'radial-gradient(460px 200px at 100% -8%, rgba(255,255,255,0.06), rgba(10,11,13,0))',
              'radial-gradient(360px 180px at -8% 106%, rgba(148,163,184,0.08), rgba(10,11,13,0))',
              'linear-gradient(150deg, rgba(24,26,31,0.96), rgba(17,19,23,0.94) 48%, rgba(13,15,18,0.95))',
            ].join(', ')
          : 'none',
        boxShadow: isDark
          ? '0 20px 48px rgba(0, 0, 0, 0.52), 0 0 0 1px rgba(148,163,184,0.1), inset 0 1px 0 rgba(255,255,255,0.04)'
          : '0 18px 44px rgba(30, 64, 175, 0.14), 0 0 0 1px rgba(56,189,248,0.08), inset 0 1px 0 rgba(255,255,255,0.9)',
        backdropFilter: 'blur(14px)',
        transition: 'transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease, background-image 220ms ease',
        cursor: props.onClick ? 'pointer' : 'default',
        '&:hover': props.onClick
          ? {
              transform: 'translateY(-4px)',
              boxShadow: isDark
                ? '0 24px 54px rgba(0, 0, 0, 0.64), 0 0 0 1px rgba(203,213,225,0.18), inset 0 1px 0 rgba(255,255,255,0.08)'
                : '0 24px 58px rgba(30, 64, 175, 0.18), 0 0 0 1px rgba(56,189,248,0.14), inset 0 1px 0 rgba(255,255,255,0.94)',
              borderColor: isDark ? 'rgba(203,213,225,0.34)' : 'rgba(59,130,246,0.32)',
            }
          : undefined,
        ...props.sx,
      }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
        <Box>
          <Typography
            onClick={
              props.onTitleClick
                ? (event) => {
                    event.stopPropagation();
                    props.onTitleClick?.();
                  }
                : undefined
            }
            sx={{
              fontSize: 22,
              fontWeight: 700,
              color: isDark ? '#f8fafc' : '#0f172a',
              cursor: props.onTitleClick ? 'pointer' : 'default',
              '&:hover': props.onTitleClick
                ? {
                    textDecoration: 'underline',
                    textDecorationThickness: '2px',
                    textUnderlineOffset: '3px',
                  }
                : undefined,
            }}
          >
            {props.title}
          </Typography>
          {props.subtitle ? (
            <Typography sx={{ mt: 0.5, fontSize: 13, color: isDark ? 'rgba(229,231,235,0.78)' : 'rgba(51,65,85,0.82)' }}>
              {props.subtitle}
            </Typography>
          ) : null}
        </Box>
        {props.headerRight ? (
          <Box onClick={(event) => event.stopPropagation()}>{props.headerRight}</Box>
        ) : props.icon ? (
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: 3,
              display: 'grid',
              placeItems: 'center',
              color: isDark ? '#f8fafc' : '#0f172a',
              bgcolor: isDark ? 'rgba(56,189,248,0.14)' : 'rgba(59,130,246,0.1)',
              border: `1px solid ${isDark ? 'rgba(125,211,252,0.3)' : 'rgba(59,130,246,0.24)'}`,
            }}
          >
            {props.icon}
          </Box>
        ) : null}
      </Stack>
      <Box sx={{ flex: 1, mt: 2, minHeight: 0, overflow: 'hidden' }}>{props.children}</Box>
    </Box>
  );
}
