'use client';

import { Box, Checkbox, FormControl, InputLabel, ListItemText, MenuItem, Select, Stack, Typography } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import type { ReimbursementListRow } from '../../../services/TravelReimbursement/list';
import GlassCard from './GlassCard';

interface KanbanBuckets {
  waiting: ReimbursementListRow[];
  approved: ReimbursementListRow[];
  rejected: ReimbursementListRow[];
}

interface MyReimbursementsCardProps {
  t: (key: string, fallback: string) => string;
  isDark: boolean;
  selectedMonths: string[];
  reimbursementMonthOptions: string[];
  allMonthsSelected: boolean;
  partiallySelected: boolean;
  allMonthsValue: string;
  handleMonthChange: (event: SelectChangeEvent<string[]>) => void;
  kanbanBuckets: KanbanBuckets;
  rowKey: (row: ReimbursementListRow) => string;
  projectLabelById: Map<string, string>;
  readApprover: (row: ReimbursementListRow) => string;
  reimbursementTotals: Record<string, number>;
  openReimbursementCardDetail: (row: ReimbursementListRow) => void;
  myReimbursementsCount: number;
  onTitleClick: () => void;
  formatMoney: (value: number) => string;
}

export default function MyReimbursementsCard(props: MyReimbursementsCardProps) {
  const {
    t,
    isDark,
    selectedMonths,
    reimbursementMonthOptions,
    allMonthsSelected,
    partiallySelected,
    allMonthsValue,
    handleMonthChange,
    kanbanBuckets,
    rowKey,
    projectLabelById,
    readApprover,
    reimbursementTotals,
    openReimbursementCardDetail,
    myReimbursementsCount,
    onTitleClick,
    formatMoney,
  } = props;
  const statusBlue = isDark ? '#7dd3fc' : '#2563eb';
  const statusGreen = isDark ? '#34d399' : '#059669';
  const statusRed = isDark ? '#fda4af' : '#f43f5e';
  const statusBlueBg = isDark ? 'rgba(56,189,248,0.22)' : 'rgba(37,99,235,0.12)';
  const statusGreenBg = isDark ? 'rgba(16,185,129,0.22)' : 'rgba(5,150,105,0.12)';
  const statusRedBg = isDark ? 'rgba(251,113,133,0.24)' : 'rgba(244,63,94,0.13)';

  return (
    <GlassCard
      title={t('card_my_reimbursements', 'My Reimbursements')}
      subtitle={t('card_my_reimbursements_subtitle', 'Monthly filter + Kanban quick view')}
      headerRight={
        <FormControl size="small" sx={{ minWidth: 260, maxWidth: 320 }}>
          <InputLabel id="home-reimbursement-month-select-label" sx={{ fontSize: 13 }}>
            {t('month', 'Month')}
          </InputLabel>
          <Select<string[]>
            labelId="home-reimbursement-month-select-label"
            multiple
            value={selectedMonths}
            onChange={handleMonthChange}
            MenuProps={{
              PaperProps: {
                sx: {
                  '& .MuiMenuItem-root': {
                    minHeight: 36,
                    py: 0.5,
                  },
                  '& .MuiListItemText-primary': {
                    fontSize: 13,
                  },
                  '& .MuiCheckbox-root': {
                    p: 0.5,
                    mr: 0.6,
                  },
                  '& .MuiSvgIcon-root': {
                    fontSize: 18,
                  },
                },
              },
            }}
            label={t('month', 'Month')}
            renderValue={(selected) => {
              const selectedValues = selected as string[];
              if (!selectedValues.length) {
                return t('none', '(None)');
              }
              if (selectedValues.length === reimbursementMonthOptions.length) {
                return t('all_months', 'All months');
              }
              return selectedValues.join(', ');
            }}
            sx={{
              bgcolor: isDark ? 'rgba(56,189,248,0.12)' : 'rgba(59,130,246,0.08)',
              borderRadius: 2,
              '& .MuiSelect-select': {
                fontSize: 13,
                py: 0.8,
              },
              '& .MuiSelect-icon': {
                fontSize: 20,
              },
            }}
          >
            <MenuItem value={allMonthsValue}>
              <Checkbox checked={allMonthsSelected} indeterminate={partiallySelected} size="small" />
              <ListItemText primary={t('select_all', 'Select All')} />
            </MenuItem>
            {reimbursementMonthOptions.map((monthKey) => (
              <MenuItem key={monthKey} value={monthKey}>
                <Checkbox checked={selectedMonths.includes(monthKey)} size="small" />
                <ListItemText primary={monthKey} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      }
      onTitleClick={onTitleClick}
      sx={{ height: '100%', minHeight: 0 }}
    >
      <Box sx={{ mb: 1.4 }} />
      <Box onClick={(event) => event.stopPropagation()} sx={{ flex: 1, minHeight: 0 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
            gap: 1.1,
            height: '100%',
            minHeight: 0,
            alignItems: 'stretch',
          }}
        >
          {([
            {
              key: 'waiting',
              label: t('stat_wait_approval', 'Waiting'),
              rows: kanbanBuckets.waiting,
              headColor: statusBlue,
              headBg: statusBlueBg,
            },
            {
              key: 'approved',
              label: t('stat_approved', 'Approved'),
              rows: kanbanBuckets.approved,
              headColor: statusGreen,
              headBg: statusGreenBg,
            },
            {
              key: 'rejected',
              label: t('rejected', 'Rejected'),
              rows: kanbanBuckets.rejected,
              headColor: statusRed,
              headBg: statusRedBg,
            },
          ] as const).map((column) => (
            <Box
              key={column.key}
              sx={{
                borderRadius: 3,
                p: 1,
                height: '100%',
                minHeight: 0,
                bgcolor: isDark ? 'rgba(14,165,233,0.07)' : 'rgba(59,130,246,0.05)',
                border: `1px solid ${isDark ? 'rgba(125,211,252,0.16)' : 'rgba(59,130,246,0.12)'}`,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{
                  px: 0.9,
                  py: 0.7,
                  borderRadius: 2.3,
                  bgcolor: column.headBg,
                  border: `1px solid ${isDark ? 'rgba(125,211,252,0.18)' : 'rgba(59,130,246,0.14)'}`,
                }}
              >
                <Typography sx={{ fontSize: 13, fontWeight: 800, color: column.headColor }}>{column.label}</Typography>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: column.headColor }}>{column.rows.length}</Typography>
              </Stack>

              <Stack
                spacing={0.8}
                sx={{ mt: 0.8, flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', pr: 0.2 }}
              >
                {column.rows.map((row) => {
                  const key = rowKey(row);
                  const projectId = String(row.projectid ?? '').trim();
                  const projectLabel = projectLabelById.get(projectId) ?? (projectId || '--');
                  const approver = readApprover(row);
                  const amount = reimbursementTotals[key] ?? 0;
                  return (
                    <Box
                      key={key}
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation();
                        openReimbursementCardDetail(row);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          event.stopPropagation();
                          openReimbursementCardDetail(row);
                        }
                      }}
                      sx={{
                        borderRadius: 2,
                        px: 1,
                        py: 0.9,
                        bgcolor: isDark ? 'rgba(2,10,22,0.56)' : 'rgba(255,255,255,0.86)',
                        border: `1px solid ${isDark ? 'rgba(125,211,252,0.18)' : 'rgba(59,130,246,0.14)'}`,
                        cursor: 'pointer',
                        transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
                        '&:hover': {
                          transform: 'translateY(-1px)',
                          boxShadow: isDark ? '0 10px 20px rgba(3,7,18,0.42)' : '0 10px 22px rgba(37,99,235,0.14)',
                          borderColor: isDark ? 'rgba(125,211,252,0.28)' : 'rgba(37,99,235,0.3)',
                        },
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={0.8}>
                        <Typography sx={{ fontSize: 14, fontWeight: 800, lineHeight: 1.2 }}>
                          {String(row.trno ?? row.id ?? '--')}
                        </Typography>
                        <Typography sx={{ fontSize: 14, fontWeight: 800, lineHeight: 1.2 }}>
                          {formatMoney(amount)}
                        </Typography>
                      </Stack>
                      <Typography sx={{ mt: 0.35, fontSize: 11.5, opacity: 0.82 }}>
                        {projectLabel}
                      </Typography>
                      <Typography sx={{ fontSize: 11.5, opacity: 0.82 }}>
                        {t('approver', 'Approver')}: {approver}
                      </Typography>
                    </Box>
                  );
                })}
                {column.rows.length === 0 ? (
                  <Typography sx={{ px: 0.8, py: 1.2, fontSize: 12.5, opacity: 0.72 }}>
                    {t('no_data', 'No data')}
                  </Typography>
                ) : null}
              </Stack>
            </Box>
          ))}
        </Box>
      </Box>
      {myReimbursementsCount === 0 ? (
        <Typography sx={{ fontSize: 13, opacity: 0.75, px: 0.4, mt: 1.2 }}>
          {t('no_reimbursements_hint', "You don't have any reimbursements yet. Create your first one.")}
        </Typography>
      ) : null}
    </GlassCard>
  );
}
