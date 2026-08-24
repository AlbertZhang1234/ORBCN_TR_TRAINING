'use client';

import { Box, Stack, Typography } from '@mui/material';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import PaidRoundedIcon from '@mui/icons-material/PaidRounded';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import LocationCityRoundedIcon from '@mui/icons-material/LocationCityRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import PieChartRoundedIcon from '@mui/icons-material/PieChartRounded';
import GlassCard from './GlassCard';

interface BreakdownRow {
  key: string;
  label: string;
  amount: number;
  ratio: number;
}

interface YearInsightCoverCardProps {
  t: (key: string, fallback: string) => string;
  isDark: boolean;
  currentYear: number;
  totalAmount: number;
  reimbursementCount: number;
  invoiceCount: number;
  litCityCount: number;
  projectBreakdown: BreakdownRow[];
  categoryBreakdown: BreakdownRow[];
  aiSummary: string;
  aiTag: string;
  aiSummaryLoading: boolean;
}

function money(value: number): string {
  return `¥${value.toFixed(2)}`;
}

function toPercentText(value: number): string {
  return `${(Math.max(0, value) * 100).toFixed(1)}%`;
}

function buildPieGradient(items: BreakdownRow[], isDark: boolean): string {
  const colors = isDark
    ? [
        'rgba(125,211,252,0.94)',
        'rgba(52,211,153,0.9)',
        'rgba(251,113,133,0.9)',
        'rgba(45,212,191,0.78)',
        'rgba(251,191,36,0.78)',
      ]
    : [
        'rgba(37,99,235,0.9)',
        'rgba(5,150,105,0.9)',
        'rgba(244,63,94,0.9)',
        'rgba(20,184,166,0.78)',
        'rgba(245,158,11,0.78)',
      ];
  const safe = items.filter((item) => item.ratio > 0).slice(0, 5);
  if (safe.length === 0) {
    return isDark
      ? 'conic-gradient(from 15deg, rgba(159,185,232,0.36), rgba(167,202,184,0.3))'
      : 'conic-gradient(from 15deg, rgba(95,127,189,0.3), rgba(110,156,134,0.24))';
  }
  let cursor = 0;
  const segments: string[] = [];
  safe.forEach((item, index) => {
    const start = cursor;
    const end = Math.min(1, cursor + item.ratio);
    segments.push(`${colors[index % colors.length]} ${start * 100}% ${end * 100}%`);
    cursor = end;
  });
  if (cursor < 1) {
    segments.push(`${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)'} ${cursor * 100}% 100%`);
  }
  return `conic-gradient(from 20deg, ${segments.join(', ')})`;
}

export default function YearInsightCoverCard(props: YearInsightCoverCardProps) {
  const {
    t,
    isDark,
    currentYear,
    totalAmount,
    reimbursementCount,
    invoiceCount,
    litCityCount,
    projectBreakdown,
    categoryBreakdown,
    aiSummary,
    aiSummaryLoading,
  } = props;

  const projectRows = projectBreakdown.slice(0, 8);
  const categoryRows = categoryBreakdown.slice(0, 5);
  const maxProjectRatio = Math.max(0.01, ...projectRows.map((row) => row.ratio));
  const pieGradient = buildPieGradient(categoryRows, isDark);
  const kpiTextColor = isDark ? '#f8fafc' : '#374151';
  const heatPalette = isDark ? ['125,211,252', '52,211,153', '251,113,133'] : ['37,99,235', '5,150,105', '244,63,94'];
  const chartBlue = isDark ? '#7dd3fc' : '#2563eb';
  const chartGreen = isDark ? '#34d399' : '#059669';

  return (
    <GlassCard
      title={t('card_year_insight', 'My {0}').replace('{0}', String(currentYear))}
      subtitle=""
      icon={<AutoAwesomeRoundedIcon fontSize="small" />}
      sx={{
        height: '100%',
        minHeight: 0,
        bgcolor: isDark ? undefined : '#ffffff',
        backgroundImage: isDark
          ? [
              'radial-gradient(460px 180px at 96% -10%, rgba(255,255,255,0.06), rgba(10,11,13,0))',
              'radial-gradient(360px 180px at 4% 108%, rgba(148,163,184,0.08), rgba(10,11,13,0))',
              'linear-gradient(145deg, rgba(24,26,31,0.96), rgba(17,19,23,0.94) 45%, rgba(13,15,18,0.95))',
            ].join(', ')
          : 'none',
      }}
    >
      <Stack spacing={1.1} sx={{ height: '100%', minHeight: 0 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
            gap: 0.75,
          }}
        >
            {[
              { key: 'amount', icon: <PaidRoundedIcon sx={{ fontSize: 14 }} />, label: t('total_amount', 'Total Amount'), value: money(totalAmount) },
              { key: 'times', icon: <AssignmentTurnedInRoundedIcon sx={{ fontSize: 14 }} />, label: t('reimbursements', 'Reimbursements'), value: String(reimbursementCount) },
              { key: 'invoices', icon: <ReceiptLongRoundedIcon sx={{ fontSize: 14 }} />, label: t('invoice_items', 'Invoice Items'), value: String(invoiceCount) },
              { key: 'cities', icon: <LocationCityRoundedIcon sx={{ fontSize: 14 }} />, label: t('city_lit', 'Cities Lit'), value: String(litCityCount) },
            ].map((kpi) => (
            <Box key={kpi.key} sx={{ borderRadius: 1.8, p: 0.75, bgcolor: isDark ? 'rgba(56,189,248,0.12)' : 'rgba(59,130,246,0.08)' }}>
              <Stack direction="row" spacing={0.45} alignItems="center" sx={{ color: kpiTextColor, opacity: 0.88 }}>
                <Box sx={{ color: kpiTextColor, display: 'grid', placeItems: 'center' }}>{kpi.icon}</Box>
                <Typography sx={{ fontSize: 10.8, fontWeight: 700 }}>{kpi.label}</Typography>
              </Stack>
              <Typography sx={{ mt: 0.15, fontSize: 22, lineHeight: 1.05, fontWeight: 900, color: kpiTextColor, textAlign: 'right' }}>{kpi.value}</Typography>
            </Box>
          ))}
        </Box>

        <Typography sx={{ px: 0.2, fontSize: 12.8, lineHeight: 1.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: isDark ? 'rgba(248,250,252,0.88)' : 'rgba(51,65,85,0.92)' }}>
          {aiSummaryLoading ? t('ai_summary_generating', 'AI is generating your annual summary...') : aiSummary}
        </Typography>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
            gridTemplateRows: 'minmax(0, 1fr)',
            gap: 0.9,
            flex: 1,
            minHeight: 0,
            alignContent: 'stretch',
          }}
        >
          <Box sx={{ borderRadius: 2.2, p: 1, bgcolor: 'transparent', minHeight: 0 }}>
            <Stack direction="row" spacing={0.55} alignItems="center" sx={{ mb: 0.55 }}>
              <GridViewRoundedIcon sx={{ fontSize: 16, color: chartGreen }} />
              <Typography sx={{ fontSize: 13, fontWeight: 800 }}>{t('project', 'Project')}</Typography>
            </Stack>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 0.32 }}>
              {Array.from({ length: 8 }).map((_, index) => {
                const item = projectRows[index];
                const ratio = item ? item.ratio / maxProjectRatio : 0;
                const palette = heatPalette[index % heatPalette.length];
                return (
                  <Box
                    key={item?.key ?? `empty-${index}`}
                    sx={{
                      height: 20,
                      borderRadius: 0.7,
                      bgcolor: item
                        ? `rgba(${palette},${0.2 + 0.42 * ratio})`
                        : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.07)'),
                    }}
                  />
                );
              })}
            </Box>
            <Typography sx={{ mt: 0.55, fontSize: 11.5, opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {projectRows[0]?.label ?? t('no_data', 'No data')}
            </Typography>
          </Box>

          <Box
            sx={{
              borderRadius: 2.2,
              p: 1,
              bgcolor: 'transparent',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Stack direction="row" spacing={0.55} alignItems="center" sx={{ mb: 0.55 }}>
              <PieChartRoundedIcon sx={{ fontSize: 16, color: chartBlue }} />
              <Typography sx={{ fontSize: 13, fontWeight: 800 }}>{t('insight_category_card', 'Invoice Category Profile')}</Typography>
            </Stack>
            <Stack direction="column" spacing={0.75} alignItems="center" justifyContent="center" sx={{ flex: 1, minHeight: 0 }}>
              <Box
                sx={{
                  position: 'relative',
                  width: { xs: 170, md: 220 },
                  height: { xs: 92, md: 112 },
                  borderRadius: '50%',
                  background: pieGradient,
                  boxShadow: isDark ? '0 10px 20px rgba(0,0,0,0.3)' : '0 10px 20px rgba(15,23,42,0.14)',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    left: '12%',
                    right: '12%',
                    top: '78%',
                    height: { xs: 22, md: 24 },
                    borderRadius: '999px',
                    background: isDark
                      ? 'radial-gradient(ellipse at center, rgba(125,211,252,0.34) 0%, rgba(251,113,133,0.18) 56%, rgba(15,23,42,0) 100%)'
                      : 'radial-gradient(ellipse at center, rgba(37,99,235,0.28) 0%, rgba(244,63,94,0.16) 56%, rgba(15,23,42,0) 100%)',
                    filter: 'blur(1.2px)',
                    zIndex: -1,
                  },
                }}
              />
              <Stack spacing={0.2} sx={{ minWidth: 0, width: '100%', textAlign: 'center' }}>
                {categoryRows.slice(0, 4).map((row) => (
                  <Typography key={row.key} sx={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {row.label} {toPercentText(row.ratio)}
                  </Typography>
                ))}
                {categoryRows.length === 0 ? <Typography sx={{ fontSize: 12, opacity: 0.72 }}>{t('no_data', 'No data')}</Typography> : null}
              </Stack>
            </Stack>
          </Box>
        </Box>
      </Stack>
    </GlassCard>
  );
}
