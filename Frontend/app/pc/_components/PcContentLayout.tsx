'use client';

import { Box, type SxProps, type Theme } from '@mui/material';
import type { PropsWithChildren } from 'react';

interface PcContentLayoutProps extends PropsWithChildren {
  contentSx?: SxProps<Theme>;
  [key: string]: unknown;
}

export function PcContentLayout({ children, contentSx }: PcContentLayoutProps) {
  return (
    <Box sx={{ minWidth: 0, minHeight: 0, height: '100%', ...contentSx }}>
      {children}
    </Box>
  );
}

