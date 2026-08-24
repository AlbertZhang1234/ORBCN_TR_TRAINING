'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import { useRouter, useSearchParams } from 'next/navigation';
import ReimbursementDetail from '../../reimbursements/ReimbursementDetail';
import { usePcI18n } from '../../_components/PcI18nProvider';
import { usePcColorMode } from '../../_components/color-mode';
import { getSessionUser } from '../../_components/session';
import {
  listReimbursementInvoiceDetails,
  listReimbursements,
  type ReimbursementListRow,
} from '../../../../services/TravelReimbursement/list';
import { approveTravelReimbursement } from '../../../../services/TravelReimbursement/approve';
import { listInvoices, type InvoiceListRow } from '../../../../services/Invoice/list';
import { listTravelEntries, type TravelEntryListRow } from '../../../../services/TravelEntry/list';
import { normalizeWorkflowStatus } from '../../../../services/_core/locks';

function toFilter(row: ReimbursementListRow) {
  const rawId = row.id;
  if (typeof rawId === 'number' && Number.isFinite(rawId)) {
    return { id: rawId };
  }
  if (typeof rawId === 'string') {
    const parsed = Number(rawId);
    if (Number.isFinite(parsed)) {
      return { id: parsed };
    }
  }
  const trno = String(row.trno ?? '').trim();
  if (trno) {
    return { trno };
  }
  throw new Error('Selected reimbursement has no id or trno');
}

export default function ApprovalDetailPopupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = usePcI18n();
  const { mode } = usePcColorMode();
  const isDark = mode === 'dark';
  const idParam = searchParams.get('id') ?? '';
  const trnoParam = searchParams.get('trno') ?? '';

  const [row, setRow] = useState<ReimbursementListRow | null>(null);
  const [invoiceDetails, setInvoiceDetails] = useState<InvoiceListRow[]>([]);
  const [travelEntries, setTravelEntries] = useState<TravelEntryListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectionComment, setRejectionComment] = useState('');
  const [rejectionError, setRejectionError] = useState('');

  useEffect(() => {
    if (!idParam && !trnoParam) {
      setError(t('invalid_reimbursement', 'Invalid reimbursement record'));
      return;
    }

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [reimbursementRows, travelRows] = await Promise.all([
          listReimbursements(),
          listTravelEntries(),
        ]);

        const idValue =
          idParam && Number.isFinite(Number(idParam))
            ? Number(idParam)
            : undefined;

        const target =
          reimbursementRows.find((item) => {
            if (typeof idValue === 'number') {
              return Number(item.id) === idValue;
            }
            return String(item.trno ?? '').trim() === trnoParam.trim();
          }) ?? null;

        if (!target) {
          setError(t('reimbursement_not_found', 'Reimbursement not found'));
          setRow(null);
          return;
        }

        // Fetch specific invoice details for this reimbursement
        const details = await listReimbursementInvoiceDetails(toFilter(target));
        // Map details to InvoiceListRow format for compatibility
        const mappedInvoices: InvoiceListRow[] = details.map(d => ({
          invoiceno: d.invoiceno,
          supplier: d.supplier,
          description: d.description,
          comment: d.comment,
          userid: d.userid,
          travelid: d.travelid,
          invoicedate: d.invoicedate,
          bookingcode: d.bookingcode,
          currency: d.currency,
          status: d.status,
          totalnetamount: d.totalnetamount,
          taxamount: d.taxamount,
          grossamount: d.grossamount,
          // Store tr_amount if needed, though ReimbursementDetail might fetch it again via lines
        }));

        setRow(target);
        setInvoiceDetails(mappedInvoices);
        setTravelEntries(travelRows);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('failed_load_reimbursements', 'Failed to load reimbursements'));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [idParam, trnoParam, t]);

  const allInvoiceMap = useMemo(() => {
    const map = new Map<string, InvoiceListRow>();
    for (const invoice of invoiceDetails) {
      const key = String(invoice.invoiceno ?? '').trim();
      if (!key) {
        continue;
      }
      map.set(key, invoice);
    }
    return map;
  }, [invoiceDetails]);

  const travelProjectMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const travel of travelEntries) {
      const travelId = String(travel.travelid ?? '').trim();
      if (!travelId) {
        continue;
      }
      map.set(travelId, String(travel.projectid ?? '').trim());
    }
    return map;
  }, [travelEntries]);

  const handleClose = () => {
    if (typeof window !== 'undefined' && window.opener && !window.opener.closed) {
      // Notify parent to reload if needed
      window.opener.postMessage({ type: 'APPROVAL_COMPLETE' }, '*');
      window.close();
      return;
    }
    router.push('/pc/approve');
  };

  const handleSubmit = async (approvalStatus: 'approved' | 'rejected', comment = '') => {
    const user = getSessionUser();
    if (!user?.userid) {
      alert(t('invalid_user_relogin', 'Invalid user, please relogin'));
      return;
    }
    if (!row) {
      return;
    }

    setProcessing(true);
    try {
      await approveTravelReimbursement({
        filter: toFilter(row),
        approvalStatus,
        approver: user.userid,
        rejectionComment: approvalStatus === 'rejected' ? comment.trim() : undefined,
      });
      handleClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : t('approval_failed', 'Approval failed'));
    } finally {
      setProcessing(false);
    }
  };

  const openRejectDialog = () => {
    setRejectionComment('');
    setRejectionError('');
    setRejectOpen(true);
  };

  const confirmReject = () => {
    const comment = rejectionComment.trim();
    if (!comment) {
      setRejectionError(t('please_enter_rejection_comment', 'Please enter rejection comment'));
      return;
    }
    void handleSubmit('rejected', comment);
  };

  const approvalStatus = row ? normalizeWorkflowStatus(row.approvalstatus ?? row.approval_status) : 'PENDING';
  const showActions = approvalStatus === 'WAIT FOR APPROVAL';

  return (
    <Box
      sx={{
        height: '100vh',
        overflow: 'hidden',
        p: 2,
        bgcolor: isDark ? '#0b0d10' : '#eef4ff',
        backgroundImage: isDark
          ? 'radial-gradient(circle at 50% 12%, rgba(255,255,255,0.08), rgba(11,13,16,0) 40%), linear-gradient(180deg, rgba(20,24,30,0.95) 0%, rgba(11,13,16,1) 100%)'
          : 'radial-gradient(circle at 50% 12%, rgba(84,142,235,0.2), rgba(234,242,255,0) 45%), linear-gradient(90deg, rgba(84,142,235,0.08), rgba(234,242,255,0) 40%, rgba(84,142,235,0.08) 100%)',
      }}
    >
      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      {loading && !row ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 96px)' }}>
          <CircularProgress size={28} />
        </Box>
      ) : null}

      {!loading && !error && row ? (
        <Box sx={{ height: 'calc(100vh - 32px)', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ flex: 1, minHeight: 0, mb: 2 }}>
            <ReimbursementDetail
              row={row}
              onClose={handleClose}
              allInvoiceMap={allInvoiceMap}
              travelProjectMap={travelProjectMap}
              standalone
            />
          </Box>
          {showActions ? (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 2,
                py: 2,
                px: 3,
                borderTop: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                borderRadius: 1,
              }}
            >
              <Button
                onClick={handleClose}
                disabled={processing}
                variant="text"
              >
                {t('cancel', 'Cancel')}
              </Button>
              <Button
                onClick={openRejectDialog}
                color="error"
                disabled={processing}
                variant="outlined"
              >
                {t('reject', 'Reject')}
              </Button>
              <Button
                onClick={() => void handleSubmit('approved')}
                color="success"
                disabled={processing}
                variant="contained"
                autoFocus
              >
                {t('approve', 'Approve')}
              </Button>
            </Box>
          ) : null}
        </Box>
      ) : null}

      <Dialog open={rejectOpen} onClose={() => (processing ? undefined : setRejectOpen(false))} fullWidth maxWidth="sm">
        <DialogTitle>{t('reject_reimbursement', 'Reject Reimbursement')}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <TextField
            label={t('rejection_comment', 'Rejection Comment')}
            value={rejectionComment}
            onChange={(event) => {
              setRejectionComment(event.target.value);
              if (rejectionError) {
                setRejectionError('');
              }
            }}
            fullWidth
            multiline
            minRows={4}
            required
            autoFocus
            error={Boolean(rejectionError)}
            helperText={rejectionError || t('rejection_comment_required', 'Required before rejection')}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectOpen(false)} disabled={processing}>
            {t('cancel', 'Cancel')}
          </Button>
          <Button onClick={confirmReject} color="error" variant="contained" disabled={processing}>
            {t('reject', 'Reject')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
