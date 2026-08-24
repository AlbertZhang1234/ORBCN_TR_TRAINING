'use client';

import { Box, Button, Stack, Typography } from '@mui/material';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import GlassCard from './GlassCard';

interface InvoiceStats {
  open: number;
  submitted: number;
  booked: number;
  thisMonth: number;
}

interface MyInvoicesCardProps {
  t: (key: string, fallback: string) => string;
  isDark: boolean;
  invoiceStats: InvoiceStats;
  myInvoicesLength: number;
  onTitleClick: () => void;
  onQuickUpload: () => void;
}

export default function MyInvoicesCard(props: MyInvoicesCardProps) {
  const { t, isDark, invoiceStats, myInvoicesLength, onTitleClick, onQuickUpload } = props;
  const statusBlue = isDark ? 'rgba(125,211,252,0.96)' : 'rgba(37,99,235,0.95)';
  const statusGreen = isDark ? 'rgba(52,211,153,0.94)' : 'rgba(5,150,105,0.92)';
  const statusRed = isDark ? 'rgba(251,113,133,0.94)' : 'rgba(244,63,94,0.92)';

  return (
    <GlassCard
      title={t('card_my_invoices', 'My Invoices + Quick Upload')}
      subtitle={t('card_my_invoices_subtitle', 'Track status and quick upload')}
      icon={<ReceiptLongRoundedIcon fontSize="small" />}
      onTitleClick={onTitleClick}
      sx={{ height: '100%', minHeight: 0 }}
    >
      <Stack spacing={1.6} sx={{ height: '100%', minHeight: 0 }}>
        <Stack direction="row" spacing={1.2}>
          <Box
            sx={{
              flex: 1,
              borderRadius: 3,
              p: 1.2,
              bgcolor: isDark ? 'rgba(56,189,248,0.1)' : 'rgba(59,130,246,0.07)',
            }}
          >
            <Typography sx={{ fontSize: 12, opacity: isDark ? 0.88 : 0.92 }}>{t('stat_my_invoices', 'My Invoices')}</Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 700 }}>{myInvoicesLength}</Typography>
          </Box>
          <Box
            sx={{
              flex: 1,
              borderRadius: 3,
              p: 1.2,
              bgcolor: isDark ? 'rgba(45,212,191,0.1)' : 'rgba(20,184,166,0.07)',
            }}
          >
            <Typography sx={{ fontSize: 12, opacity: isDark ? 0.88 : 0.92 }}>{t('stat_this_month_new', 'New This Month')}</Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 700 }}>{invoiceStats.thisMonth}</Typography>
          </Box>
        </Stack>
        <Stack spacing={0.9} sx={{ flex: 1, minHeight: 0 }}>
          <Stack direction="row" justifyContent="space-between">
            <Typography sx={{ fontSize: 13 }}>Open</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{invoiceStats.open}</Typography>
          </Stack>
          <Box sx={{ height: 8, borderRadius: 999, bgcolor: isDark ? 'rgba(125,211,252,0.16)' : 'rgba(59,130,246,0.12)' }}>
            <Box
              sx={{
                height: '100%',
                width: `${Math.min(100, myInvoicesLength > 0 ? (invoiceStats.open / myInvoicesLength) * 100 : 0)}%`,
                borderRadius: 999,
                bgcolor: statusBlue,
              }}
            />
          </Box>
          <Stack direction="row" justifyContent="space-between">
            <Typography sx={{ fontSize: 13 }}>Submitted</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{invoiceStats.submitted}</Typography>
          </Stack>
          <Box sx={{ height: 8, borderRadius: 999, bgcolor: isDark ? 'rgba(52,211,153,0.16)' : 'rgba(5,150,105,0.12)' }}>
            <Box
              sx={{
                height: '100%',
                width: `${Math.min(100, myInvoicesLength > 0 ? (invoiceStats.submitted / myInvoicesLength) * 100 : 0)}%`,
                borderRadius: 999,
                bgcolor: statusGreen,
              }}
            />
          </Box>
          <Stack direction="row" justifyContent="space-between">
            <Typography sx={{ fontSize: 13 }}>Booked</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{invoiceStats.booked}</Typography>
          </Stack>
          <Box sx={{ height: 8, borderRadius: 999, bgcolor: isDark ? 'rgba(251,113,133,0.16)' : 'rgba(244,63,94,0.12)' }}>
            <Box
              sx={{
                height: '100%',
                width: `${Math.min(100, myInvoicesLength > 0 ? (invoiceStats.booked / myInvoicesLength) * 100 : 0)}%`,
                borderRadius: 999,
                bgcolor: statusRed,
              }}
            />
          </Box>
        </Stack>
        <Stack direction="row" justifyContent="center" sx={{ mt: 'auto', pt: 0.4 }}>
          <Button
            onClick={(event) => {
              event.stopPropagation();
              onQuickUpload();
            }}
            size="small"
            variant="outlined"
            sx={{
              borderRadius: 999,
              border: '3px solid #D4AF37',
              color: '#B8860B',
              bgcolor: '#ffffff',
              width: { xs: '100%', sm: 280, md: 320 },
              maxWidth: '100%',
              py: 0.7,
              fontSize: 20,
              fontWeight: 900,
              '&:hover': {
                border: '3px solid #B8860B',
                bgcolor: '#FFFDF5',
                color: '#8B6B00',
              },
            }}
          >
            {t('action_quick_upload', 'Quick Upload Invoice')}
          </Button>
        </Stack>
      </Stack>
    </GlassCard>
  );
}
