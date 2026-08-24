'use client';

import { Stack, Typography } from '@mui/material';
import InboxRoundedIcon from '@mui/icons-material/InboxRounded';
import type { ReimbursementListRow } from '../../../services/TravelReimbursement/list';
import GlassCard from './GlassCard';

interface MyInboxData {
  approvals: ReimbursementListRow[];
  feedback: ReimbursementListRow[];
}

interface MyInboxCardProps {
  t: (key: string, fallback: string) => string;
  isDark: boolean;
  myInbox: MyInboxData;
  rowKey: (row: ReimbursementListRow) => string;
  getStatusLabel: (row: ReimbursementListRow) => string;
  onTitleClick: () => void;
}

export default function MyInboxCard(props: MyInboxCardProps) {
  const { t, isDark, myInbox, rowKey, getStatusLabel, onTitleClick } = props;

  return (
    <GlassCard
      title={t('card_my_inbox', 'My Inbox')}
      subtitle={t('card_my_inbox_subtitle', 'Pending Approval & My Feedback')}
      icon={<InboxRoundedIcon fontSize="small" />}
      onTitleClick={onTitleClick}
      sx={{ height: '100%', minHeight: 0 }}
    >
      <Typography sx={{ fontSize: 12, opacity: 0.72, mb: 0.7 }}>{t('section_need_my_approval', 'Need My Approval')}</Typography>
      <Stack spacing={0.8} sx={{ mb: 1.5 }}>
        {myInbox.approvals.slice(0, 2).map((row) => (
          <Stack
            key={`ap-${rowKey(row)}`}
            direction="row"
            justifyContent="space-between"
            sx={{
              py: 0.6,
              px: 1,
              borderRadius: 2,
              bgcolor: isDark ? 'rgba(56,189,248,0.1)' : 'rgba(59,130,246,0.08)',
            }}
          >
            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{String(row.trno ?? row.id ?? '--')}</Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: isDark ? '#7dd3fc' : '#2563eb' }}>
              {t('pending', 'Pending')}
            </Typography>
          </Stack>
        ))}
        {myInbox.approvals.length === 0 ? (
          <Typography sx={{ fontSize: 13, opacity: 0.75, px: 0.4 }}>{t('no_pending_approvals', 'No pending approvals.')}</Typography>
        ) : null}
      </Stack>

      <Typography sx={{ fontSize: 12, opacity: 0.72, mb: 0.7 }}>{t('section_my_approval_feedback', 'My Approval Feedback')}</Typography>
      <Stack spacing={0.8}>
        {myInbox.feedback.slice(0, 2).map((row) => (
          <Stack
            key={`fd-${rowKey(row)}`}
            direction="row"
            justifyContent="space-between"
            sx={{
              py: 0.6,
              px: 1,
              borderRadius: 2,
              bgcolor: isDark ? 'rgba(45,212,191,0.1)' : 'rgba(20,184,166,0.08)',
            }}
          >
            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{String(row.trno ?? row.id ?? '--')}</Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: isDark ? '#34d399' : '#059669' }}>
              {getStatusLabel(row)}
            </Typography>
          </Stack>
        ))}
        {myInbox.feedback.length === 0 ? (
          <Typography sx={{ fontSize: 13, opacity: 0.75, px: 0.4 }}>{t('feedback_stream_developing', 'Feedback stream is under development.')}</Typography>
        ) : null}
      </Stack>
    </GlassCard>
  );
}
