'use client';

import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, CircularProgress } from '@mui/material';
import { useRouter, useSearchParams } from 'next/navigation';
import ReimbursementDetail from '../ReimbursementDetail';
import { usePcI18n } from '../../_components/PcI18nProvider';
import { usePcColorMode } from '../../_components/color-mode';
import {
  listReimbursements,
  type ReimbursementListRow,
} from '../../../../services/TravelReimbursement/list';
import { listInvoices, type InvoiceListRow } from '../../../../services/Invoice/list';
import { listTravelEntries, type TravelEntryListRow } from '../../../../services/TravelEntry/list';

export default function ReimbursementDetailPopupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = usePcI18n();
  const { mode } = usePcColorMode();
  const isDark = mode === 'dark';
  const idParam = searchParams.get('id') ?? '';
  const trnoParam = searchParams.get('trno') ?? '';

  const [row, setRow] = useState<ReimbursementListRow | null>(null);
  const [invoices, setInvoices] = useState<InvoiceListRow[]>([]);
  const [travelEntries, setTravelEntries] = useState<TravelEntryListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!idParam && !trnoParam) {
      setError(t('invalid_reimbursement', 'Invalid reimbursement record'));
      return;
    }

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [reimbursementRows, invoiceRows, travelRows] = await Promise.all([
          listReimbursements(),
          listInvoices(),
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

        setRow(target);
        setInvoices(invoiceRows);
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
    for (const invoice of invoices) {
      const key = String(invoice.invoiceno ?? '').trim();
      if (!key) {
        continue;
      }
      map.set(key, invoice);
    }
    return map;
  }, [invoices]);

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
      window.close();
      return;
    }
    router.push('/pc/reimbursements');
  };

  return (
    <Box
      sx={{
        height: '100vh',
        overflow: 'hidden',
        p: 2,
        bgcolor: isDark ? '#0b0d10' : '#ffffff',
        backgroundImage: isDark
          ? 'radial-gradient(circle at 50% 12%, rgba(255,255,255,0.08), rgba(11,13,16,0) 40%), linear-gradient(180deg, rgba(20,24,30,0.95) 0%, rgba(11,13,16,1) 100%)'
          : 'none',
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
        <Box sx={{ height: 'calc(100vh - 32px)', minHeight: 0 }}>
          <ReimbursementDetail
            row={row}
            onClose={handleClose}
            allInvoiceMap={allInvoiceMap}
            travelProjectMap={travelProjectMap}
            standalone
          />
        </Box>
      ) : null}
    </Box>
  );
}
