'use client';

import type { ComponentProps, PropsWithChildren } from 'react';
import { Box } from '@mui/material';
import { CStandardPage } from '@/components/PageComponents/CStandardPage';
import { CTable } from '@/components/Structures/CTable';

interface TableLoadingMarqueeProps extends PropsWithChildren {
  active: boolean;
}

export function TableLoadingMarquee({ active, children }: TableLoadingMarqueeProps) {
  return (
    <Box
      sx={{
        position: 'relative',
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        '@keyframes pcTableBlueMarquee': {
          '0%': { backgroundPosition: '180% 0' },
          '100%': { backgroundPosition: '-180% 0' },
        },
        ...(active
          ? {
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                borderTopLeftRadius: 6,
                borderTopRightRadius: 6,
                pointerEvents: 'none',
                zIndex: 20,
                background:
                  'linear-gradient(90deg, rgba(30,136,229,0) 0%, rgba(33,150,243,0.35) 18%, rgba(100,181,246,0.95) 50%, rgba(33,150,243,0.35) 82%, rgba(30,136,229,0) 100%)',
                backgroundSize: '240% 100%',
                animation: 'pcTableBlueMarquee 1.15s linear infinite',
                boxShadow: '0 0 12px rgba(33, 150, 243, 0.55)',
              },
            }
          : {}),
      }}
    >
      {children}
    </Box>
  );
}

type BusyStandardPageProps = ComponentProps<typeof CStandardPage> & {
  busy: boolean;
};

export function BusyStandardPage({ busy, tableProps, ...rest }: BusyStandardPageProps) {
  return (
    <TableLoadingMarquee active={busy}>
      <CStandardPage
        {...rest}
        tableProps={{
          ...tableProps,
          loading: busy || Boolean(tableProps?.loading),
        }}
      />
    </TableLoadingMarquee>
  );
}

type BusyTableProps = ComponentProps<typeof CTable> & {
  busy: boolean;
};

export function BusyTable({ busy, loading, ...rest }: BusyTableProps) {
  return (
    <TableLoadingMarquee active={busy}>
      <CTable {...rest} loading={busy || Boolean(loading)} />
    </TableLoadingMarquee>
  );
}
