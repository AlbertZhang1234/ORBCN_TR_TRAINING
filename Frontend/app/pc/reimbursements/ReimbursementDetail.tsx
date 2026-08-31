import { useEffect, useState, useMemo } from 'react';
import { Box, Alert } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { CDetailInfoPage } from 'orbcafe-ui';
import { usePcI18n } from '../_components/PcI18nProvider';
import { listReimbursementLines, type ReimbursementListRow } from '../../../services/TravelReimbursement/list';
import type { InvoiceListRow } from '../../../services/Invoice/list';
import { toFilter, readInvoiceStatus } from './helpers';
import { normalizeWorkflowStatus } from '../../../services/_core/locks';
import InvoicePreviewDialog from '../invoices/_components/InvoicePreviewDialog';
import { formatDateOnly } from '../invoices/_components/shared';

function statusLabel(status: ReturnType<typeof normalizeWorkflowStatus>, t: (key: string, fallback: string) => string): string {
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

function formatBoolean(value: unknown, t: (key: string, fallback: string) => string): string {
  if (typeof value === 'boolean') {
    return value ? t('yes', 'Yes') : t('no', 'No');
  }
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['true', 't', 'yes', 'y', '是'].includes(normalized)) {
    return t('yes', 'Yes');
  }
  if (['false', 'f', 'no', 'n', '否'].includes(normalized)) {
    return t('no', 'No');
  }
  return '';
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
  trchargeable?: boolean;
  txchargeable?: boolean;
};

export default function ReimbursementDetail({
  row,
  onClose,
  allInvoiceMap,
  travelProjectMap,
  standalone = false,
  actions,
}: ReimbursementDetailProps) {
  const { t } = usePcI18n();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [detailRow, setDetailRow] = useState<ReimbursementListRow | null>(null);
  const [detailInvoices, setDetailInvoices] = useState<DetailInvoiceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewInvoiceNo, setPreviewInvoiceNo] = useState('');

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
              trchargeable: line.trchargeable,
              txchargeable: line.txchargeable,
            };
          })
          .filter(Boolean) as DetailInvoiceRow[];

        setDetailInvoices(
          invoices.map((inv) => ({
            ...inv,
            _status: readInvoiceStatus(inv),
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
      { id: 'bookingcode', label: t('booking_rule', 'Booking Rule'), minWidth: 170 },
      {
        id: 'trchargeable',
        label: t('tr_chargeable', 'TR Chargeable'),
        minWidth: 150,
        render: (value: unknown) => formatBoolean(value, t),
      },
      {
        id: 'invoicedate',
        label: t('invoice_date', 'Invoice Date'),
        minWidth: 140,
        render: (value: unknown) => formatDateOnly(value),
      },
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
        bgcolor: isDark ? 'background.default' : '#ffffff',
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
          subtitle={t('reimbursements', 'Reimbursement Management')}
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
                  value: statusLabel(normalizeWorkflowStatus(String(
                    // @ts-ignore
                    detailRow._bookingstatus ?? detailRow.bookingstatus ?? ''
                  )), t),
                },
              ],
            },
          ]}
          table={{
            title: t('related_invoices', 'Related Invoices'),
            tableProps: {
              appId: 'pc-reimbursements',
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
      <InvoicePreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        invoiceNo={previewInvoiceNo}
        t={t}
      />
    </Box>
  );
}
