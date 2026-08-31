import { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
} from '@mui/material';
import { CDetailInfoPage } from 'orbcafe-ui';
import { usePcI18n } from '../_components/PcI18nProvider';
import { useMessageBox } from '../_components/useMessageBox';
import { listReimbursementLines, type ReimbursementListRow } from '../../../services/TravelReimbursement/list';
import type { InvoiceListRow } from '../../../services/Invoice/list';
import { toFilter, readInvoiceStatus } from './helpers';
import { normalizeWorkflowStatus } from '../../../services/_core/locks';
import { useBookingRuleOptions } from '../../../services/Invoice/useBookingRuleOptions';
import { formatBookingRuleOption } from '../../../services/Invoice/booking-rules';
import { saveInvoiceBookingRule } from '../../../services/Invoice/save';
import InvoicePreviewDialog from '../invoices/_components/InvoicePreviewDialog';

function statusLabel(
  status: ReturnType<typeof normalizeWorkflowStatus>,
  t: (key: string, fallback: string) => string,
  rawStatus?: string,
): string {
  if (String(rawStatus ?? '').trim() === '已回传SAP系统') {
    return t('booking_status_sap_posted', '已回传SAP系统');
  }
  if (status === 'WAIT FOR APPROVAL') {
    return t('stat_wait_approval', 'Waiting');
  }
  if (status === 'APPROVED' || status === 'BOOKED') {
    return t('stat_approved', 'Approved');
  }
  if (status === 'REJECTED') {
    return t('rejected', 'Rejected');
  }
  if (status === 'SUBMITTED') {
    return t('submitted', 'Submitted');
  }
  return t('pending', 'Pending');
}

interface ReimbursementDetailProps {
  row: ReimbursementListRow;
  onClose: () => void;
  allInvoiceMap: Map<string, InvoiceListRow>;
  travelProjectMap: Map<string, string>;
  standalone?: boolean;
  actions?: React.ReactNode;
}

type DetailInvoiceRow = InvoiceListRow & {
  _status: string;
  tr_amount?: string;
};

export default function ReimbursementDetail({
  row,
  onClose,
  allInvoiceMap,
  travelProjectMap,
  standalone = false,
  actions,
}: ReimbursementDetailProps) {
  const { t, lang } = usePcI18n();
  const { showError, showSuccess, messageBox } = useMessageBox(t);
  const [detailRow, setDetailRow] = useState<ReimbursementListRow | null>(null);
  const [detailInvoices, setDetailInvoices] = useState<DetailInvoiceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewInvoiceNo, setPreviewInvoiceNo] = useState('');
  const [editBookingOpen, setEditBookingOpen] = useState(false);
  const [editingInvoiceNo, setEditingInvoiceNo] = useState('');
  const [bookingCodeDraft, setBookingCodeDraft] = useState('');
  const [savingBookingCode, setSavingBookingCode] = useState(false);
  const { options: bookingRuleOptions } = useBookingRuleOptions(bookingCodeDraft);

  useEffect(() => {
    // 1. Initialize with row data
    const initialDetail = { ...row };

    // Ensure created_at is populated
    if (!initialDetail.created_at) {
      initialDetail.created_at = String(
        // @ts-ignore
        row._createdAt || row.createdat || row.created_at || ''
      );
    }

    setDetailRow(initialDetail);
    setLoading(true);
    setError('');

    const loadLines = async () => {
      try {
        const filter = toFilter(row);
        const lines = await listReimbursementLines(filter);

        const invoices = lines
          .map((line) => {
            const inv = allInvoiceMap.get(line.invoiceno);
            if (!inv) return null;
            return {
              ...inv,
              tr_amount: line.tr_amount,
            };
          })
          .filter(Boolean) as DetailInvoiceRow[];

        setDetailInvoices(
          invoices.map((inv) => ({
            ...inv,
            _status: readInvoiceStatus(inv),
            bookingcode: String(inv.bookingcode ?? '').trim(),
          })),
        );

        // 2. Derive project from first invoice's travel info
        if (invoices.length > 0) {
          const firstInv = invoices[0];
          const travelId = String(firstInv.travelid ?? '').trim();
          const projectId = travelProjectMap.get(travelId) ?? '';

          setDetailRow((prev) => {
            if (!prev) return prev;
            // Only update if projectid is missing or needs update
            if (!prev.projectid && projectId) {
              return {
                ...prev,
                projectid: projectId,
              };
            }
            return prev;
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load details');
      } finally {
        setLoading(false);
      }
    };

    void loadLines();
  }, [row, allInvoiceMap, travelProjectMap]);

  const openInvoicePreview = (invoiceNoRaw: unknown) => {
    const invoiceNo = String(invoiceNoRaw ?? '').trim();
    if (!invoiceNo) {
      return;
    }
    setPreviewInvoiceNo(invoiceNo);
    setPreviewOpen(true);
  };

  const openBookingRuleEditor = (invoice: DetailInvoiceRow) => {
    const invoiceNo = String(invoice.invoiceno ?? '').trim();
    if (!invoiceNo) {
      return;
    }
    setEditingInvoiceNo(invoiceNo);
    setBookingCodeDraft(String(invoice.bookingcode ?? '').trim());
    setEditBookingOpen(true);
  };

  const handleSaveBookingRule = async () => {
    const invoiceNo = editingInvoiceNo.trim();
    if (!invoiceNo) {
      return;
    }

    setSavingBookingCode(true);
    try {
      const updated = await saveInvoiceBookingRule(invoiceNo, bookingCodeDraft);
      const nextBookingCode = String(updated.bookingcode ?? '').trim();
      setDetailInvoices((prev) =>
        prev.map((invoice) =>
          String(invoice.invoiceno ?? '').trim() === invoiceNo
            ? { ...invoice, bookingcode: nextBookingCode }
            : invoice,
        ),
      );
      setEditBookingOpen(false);
      showSuccess(t('invoice_saved_success', 'Invoice saved successfully'));
    } catch (err) {
      const message = err instanceof Error ? err.message : t('failed_change_invoice', 'Failed to change invoice');
      setError(message);
      showError(message);
    } finally {
      setSavingBookingCode(false);
    }
  };

  const detailTableColumns = useMemo<any[]>(
    () => [
      {
        id: 'invoiceno',
        label: t('invoice_no', 'Invoice No'),
        minWidth: 220,
        render: (value: unknown) => {
          const invoiceNo = String(value ?? '').trim();
          if (!invoiceNo) return null;
          return (
            <span
              style={{
                color: '#1976d2',
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
              onClick={(e) => {
                e.stopPropagation();
                openInvoicePreview(invoiceNo);
              }}
            >
              {invoiceNo}
            </span>
          );
        },
      },
      { id: 'userid', label: t('user_id', 'User ID'), minWidth: 160 },
      { id: 'travelid', label: t('travel_id', 'Travel ID'), minWidth: 160 },
      { id: 'description', label: t('description', 'Description'), minWidth: 220 },
      { id: 'comment', label: t('comment', 'Comment'), minWidth: 220 },
      {
        id: 'bookingcode',
        label: t('booking_rule', 'Booking Rule'),
        minWidth: 230,
        render: (value: unknown, invoice: DetailInvoiceRow) => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <span>{String(value ?? '').trim() || t('none', '(None)')}</span>
            <Button
              variant="text"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                openBookingRuleEditor(invoice);
              }}
              sx={{ minWidth: 0, p: 0, textTransform: 'none' }}
            >
              {t('edit', 'Edit')}
            </Button>
          </Box>
        ),
      },
      { id: 'invoicedate', label: t('invoice_date', 'Invoice Date'), minWidth: 140 },
      { id: 'tr_amount', label: t('reimbursement_amount', 'Reimbursement Amount'), minWidth: 150, numeric: true, align: 'right' },
      { id: 'totalnetamount', label: t('net_amount', 'Net Amount'), minWidth: 130, numeric: true, align: 'right' },
      { id: 'taxamount', label: t('tax_amount', 'Tax Amount'), minWidth: 130, numeric: true, align: 'right' },
      { id: 'grossamount', label: t('gross_amount', 'Gross Amount'), minWidth: 130, numeric: true, align: 'right' },
      { id: 'currency', label: t('currency', 'Currency'), minWidth: 110 },
      { id: 'originalamount', label: t('original_amount', 'Original Amount'), minWidth: 150, numeric: true, align: 'right' },
      { id: 'originalcurrency', label: t('original_currency', 'Original Currency'), minWidth: 150 },
      { id: '_status', label: t('status', 'Status'), minWidth: 140 },
    ],
    [t],
  );

  if (!detailRow) {
    return null;
  }

  return (
    <Box
      sx={{
        position: standalone ? 'relative' : 'absolute',
        top: standalone ? undefined : 0,
        left: standalone ? undefined : 0,
        right: standalone ? undefined : 0,
        bottom: standalone ? undefined : 0,
        zIndex: standalone ? undefined : 10,
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        height: standalone ? '100%' : undefined,
        overflow: standalone ? 'hidden' : 'auto',
      }}
    >
      {error && (
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', pb: standalone ? 0 : 2 }}>
        <CDetailInfoPage
          title={t('detail_title', 'Detail - {0}').replace('{0}', String(detailRow.id ?? ''))}
          subtitle={t('tr_booking_title', 'TR Booking & Archive')}
          onClose={onClose}
          sections={[
            {
              id: 'basic',
              title: t('basic_information', 'Basic Information'),
              columns: 3,
              fields: [
                {
                  id: 'project',
                  label: t('project', 'Project'),
                  value: String(detailRow.projectid ?? ''),
                },
                {
                  id: 'date',
                  label: t('created_at', 'Created At'),
                  value: String(
                    // @ts-ignore
                    detailRow.created_at || detailRow._createdAt || ''
                  ),
                },
                {
                  id: 'creator',
                  label: t('created_by', 'Created By'),
                  value: String(detailRow.userid ?? ''),
                },
                {
                  id: 'app_status',
                  label: t('approval_status', 'Approval Status'),
                  value: statusLabel(normalizeWorkflowStatus(String(
                    // @ts-ignore
                    detailRow._approvalstatus ?? detailRow.approvalstatus ?? ''
                  )), t),
                },
                {
                  id: 'book_status',
                  label: t('booking_status', 'Booking Status'),
                  value: (() => {
                    const rawStatus = String(
                      // @ts-ignore
                      detailRow._bookingstatus ?? detailRow.bookingstatus ?? '',
                    );
                    return statusLabel(normalizeWorkflowStatus(rawStatus), t, rawStatus);
                  })(),
                },
              ],
            },
          ]}
          table={{
            title: t('related_invoices', 'Related Invoices'),
            tableProps: {
              appId: 'pc-tr-booking',
              columns: detailTableColumns,
              rows: detailInvoices,
              rowKey: 'invoiceno',
              loading: loading,
              fitContainer: true,
              showSummary: true,
              // CDetailInfoPage internally forces fitContainer=false for embedded table;
              // provide an explicit viewport-based height so detail table uses remaining screen space.
              maxHeight: 'calc(100vh - 210px)',
              fullWidth: true,
              layout: undefined,
            },
          }}
          rightHeaderSlot={actions}
        />
      </Box>
      <Dialog open={editBookingOpen} onClose={() => setEditBookingOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{t('booking_rule', 'Booking Rule')}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField
              label={t('invoice_no', 'Invoice No')}
              value={editingInvoiceNo}
              fullWidth
              disabled
            />
            <TextField
              label={t('booking_rule', 'Booking Rule')}
              value={bookingCodeDraft}
              onChange={(e) => setBookingCodeDraft(e.target.value)}
              fullWidth
              select
            >
              <MenuItem value="">{t('none', '(None)')}</MenuItem>
              {bookingRuleOptions.map((option) => (
                <MenuItem key={option.code} value={option.code}>
                  {formatBookingRuleOption(option, lang)}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditBookingOpen(false)} disabled={savingBookingCode}>
            {t('cancel', 'Cancel')}
          </Button>
          <Button onClick={() => void handleSaveBookingRule()} variant="contained" disabled={savingBookingCode}>
            {t('save', 'Save')}
          </Button>
        </DialogActions>
      </Dialog>
      <InvoicePreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        invoiceNo={previewInvoiceNo}
        t={t}
      />
      {messageBox}
    </Box>
  );
}
