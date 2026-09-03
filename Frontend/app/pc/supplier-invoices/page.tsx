'use client';

import { useEffect, useMemo, useState } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import { resolveVariantFilters } from 'orbcafe-ui';
import type { ReactNode } from 'react';
import type { FilterField, FilterValue } from '@/components/Structures/CSmartFilter';
import type { TableLayout } from '@/components/Structures/CTable/types';
import { usePcI18n } from '../_components/PcI18nProvider';
import { getSessionUser } from '../_components/session';
import { listInvoices, type InvoiceListRow } from '../../../services/Invoice/list';
import { BusyStandardPage } from '../_components/TableLoadingMarquee';
import { PcContentLayout } from '../_components/PcContentLayout';
import type { VariantMetadata } from '@/components/Molecules/CVariantManagement';
import { variantService } from '../../../services/common/variant-service';
import { normalizeWorkflowStatus } from '../../../services/_core/locks';
import { formatDateOnly, readStatus, statusLabel } from '../invoices/_components/shared';
import InvoicePreviewDialog from '../invoices/_components/InvoicePreviewDialog';

const defaultFilters: Record<string, FilterValue> = {
  invoiceno: { value: '', operator: 'contains' },
  userid: { value: [], operator: 'anyOf' },
  travelid: { value: [], operator: 'anyOf' },
  bookingcode: { value: [], operator: 'anyOf' },
  status: { value: [], operator: 'anyOf' },
};

function readMultiFilterValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
  const single = String(value ?? '').trim().toLowerCase();
  return single ? [single] : [];
}

const noop = () => undefined;
const SUPPLIER_INVOICE_BUSINESS_TYPES = new Set(['01', '02']);

function isSupplierInvoice(row: InvoiceListRow): boolean {
  return SUPPLIER_INVOICE_BUSINESS_TYPES.has(String(row.businesstype ?? '').trim());
}

export default function SupplierInvoicesPage() {
  const { t } = usePcI18n();
  const [rows, setRows] = useState<InvoiceListRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [layout, setLayout] = useState<TableLayout | null>(null);
  const [filters, setFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  const [loading, setLoading] = useState(false);
  const [previewNo, setPreviewNo] = useState('');
  const LAYOUT_KEY = 'pc_supplier_invoices_default_layout_v1';

  const load = async () => {
    setLoading(true);
    try {
      // Supplier invoices intentionally use the existing invoice table for now.
      setRows(await listInvoices());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!getSessionUser()) return;
    void load();
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(LAYOUT_KEY);
        if (raw) setLayout(JSON.parse(raw) as TableLayout);
      } catch {
        // Ignore an invalid saved layout.
      }
    }
  }, []);

  const handleSaveLayout = (nextLayout: TableLayout) => {
    setLayout(nextLayout);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(nextLayout));
    }
  };

  const supplierInvoiceRows = useMemo(() => rows.filter(isSupplierInvoice), [rows]);

  const filterFields = useMemo<FilterField[]>(() => {
    const options = (values: unknown[]) => Array.from(new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ value, label: value }));
    return [
      { id: 'invoiceno', label: t('invoice_no', 'Invoice No'), type: 'text' },
      { id: 'userid', label: t('user_id', 'User ID'), type: 'multi-select', options: options(supplierInvoiceRows.map((row) => row.userid)) },
      { id: 'travelid', label: t('travel_id', 'Travel ID'), type: 'multi-select', options: options(supplierInvoiceRows.map((row) => row.travelid)) },
      { id: 'bookingcode', label: t('booking_rule', 'Booking Rule'), type: 'multi-select', options: options(supplierInvoiceRows.map((row) => row.bookingcode)) },
      { id: 'businesstype', label: t('business_type', 'Business Type'), type: 'multi-select', options: options(supplierInvoiceRows.map((row) => row.businesstype)) },
      {
        id: 'status', label: t('status', 'Status'), type: 'multi-select',
        options: Array.from(new Set(supplierInvoiceRows.map((row) => String(readStatus(row)).trim()).filter(Boolean)))
          .sort((a, b) => a.localeCompare(b))
          .map((value) => ({ value, label: statusLabel(normalizeWorkflowStatus(value), t) })),
      },
    ];
  }, [supplierInvoiceRows, t]);

  const normalizedRows = useMemo(
    () => supplierInvoiceRows.map((row) => ({ ...row, _status: readStatus(row) })),
    [supplierInvoiceRows],
  );

  const filteredRows = useMemo(() => {
    const invoiceNo = String(appliedFilters.invoiceno?.value ?? '').trim().toLowerCase();
    const users = readMultiFilterValues(appliedFilters.userid?.value);
    const travels = readMultiFilterValues(appliedFilters.travelid?.value);
    const bookingCodes = readMultiFilterValues(appliedFilters.bookingcode?.value);
    const businessTypes = readMultiFilterValues(appliedFilters.businesstype?.value);
    const statuses = readMultiFilterValues(appliedFilters.status?.value);
    return normalizedRows.filter((row) => {
      const status = String(readStatus(row)).trim().toLowerCase();
      const matches = (value: unknown, selectedValues: string[]) => selectedValues.length === 0 || selectedValues.includes(String(value ?? '').trim().toLowerCase());
      return (!invoiceNo || String(row.invoiceno ?? '').toLowerCase().includes(invoiceNo))
        && matches(row.userid, users)
        && matches(row.travelid, travels)
        && matches(row.bookingcode, bookingCodes)
        && matches(row.businesstype, businessTypes)
        && matches(status, statuses);
    });
  }, [normalizedRows, appliedFilters]);

  const columns = useMemo<any[]>(() => [
    {
      id: 'invoiceno',
      label: t('invoice_no', 'Invoice No'),
      minWidth: 220,
      render: (value: string) => value ? (
        <span
          style={{ color: '#1976d2', textDecoration: 'underline', cursor: 'pointer' }}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setPreviewNo(value); } }}
          onClick={(event) => { event.stopPropagation(); setPreviewNo(value); }}
        >
          {value}
        </span>
      ) : null,
    },
    { id: 'userid', label: t('user_id', 'User ID'), minWidth: 160 },
    { id: 'travelid', label: t('travel_id', 'Travel ID'), minWidth: 160 },
    { id: 'description', label: t('description', 'Description'), minWidth: 220 },
    { id: 'comment', label: t('comment', 'Comment'), minWidth: 220 },
    { id: 'bookingcode', label: t('booking_rule', 'Booking Rule'), minWidth: 170 },
    { id: 'businesstype', label: t('business_type', 'Business Type'), minWidth: 150 },
    { id: 'invoicedate', label: t('invoice_date', 'Invoice Date'), minWidth: 140, render: (value: unknown) => formatDateOnly(value) },
    { id: 'totalnetamount', label: t('net_amount', 'Net Amount'), minWidth: 130, numeric: true },
    { id: 'taxamount', label: t('tax_amount', 'Tax Amount'), minWidth: 130, numeric: true },
    { id: 'grossamount', label: t('gross_amount', 'Gross Amount'), minWidth: 130, numeric: true },
    { id: 'currency', label: t('currency', 'Currency'), minWidth: 110 },
    { id: 'originalamount', label: t('original_amount', 'Original Amount'), minWidth: 150, numeric: true },
    { id: 'originalcurrency', label: t('original_currency', 'Original Currency'), minWidth: 150 },
    { id: '_status', label: t('status', 'Status'), minWidth: 140, render: (value: unknown) => statusLabel(normalizeWorkflowStatus(String(value ?? '')), t) },
  ], [t]);

  const action = (icon: ReactNode, label: string, disabled = false) => (
    <Tooltip title={label}>
      <span>
        <IconButton onClick={noop} disabled={disabled} aria-label={label}>{icon}</IconButton>
      </span>
    </Tooltip>
  );

  return (
    <PcContentLayout contentSx={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <BusyStandardPage
        busy={loading}
        title={t('supplier_invoice_management', 'Supplier Invoice Management')}
        hideHeader
        spacing={1}
        filterConfig={{
          appId: 'pc-supplier-invoices',
          tableKey: 'otto_invoices',
          variantService,
          fields: filterFields,
          filters,
          onFilterChange: setFilters,
          onSearch: () => setAppliedFilters({ ...filters }),
          onVariantLoad: (value: any) => {
            const variant = value as VariantMetadata;
            const next = (resolveVariantFilters(variant, 'otto_invoices') as Record<string, FilterValue> | null)
              ?? (variant.filters as Record<string, FilterValue> | undefined) ?? defaultFilters;
            setFilters(next);
            setAppliedFilters(next);
          },
        }}
        tableProps={{
          appId: 'pc-supplier-invoices',
          title: t('supplier_invoice_management', 'Supplier Invoice Management'),
          columns,
          rows: filteredRows,
          rowKey: 'invoiceno',
          fitContainer: true,
          selectionMode: 'multiple',
          selected,
          onSelectionChange: (items: unknown[]) => setSelected(items.map(String)),
          layout: layout ?? undefined,
          onLayoutSave: handleSaveLayout,
          actions: [
            action(<AddRoundedIcon />, t('create_invoice', 'Create Invoice')),
            action(<EditRoundedIcon />, t('edit_invoice', 'Edit Invoice'), selected.length !== 1),
            action(<DeleteRoundedIcon />, t('delete_invoice', 'Delete Invoice'), selected.length === 0),
            action(<FactCheckRoundedIcon />, t('book_invoice', 'Book Invoice'), selected.length === 0),
          ],
        }}
      />
      <InvoicePreviewDialog open={Boolean(previewNo)} onClose={() => setPreviewNo('')} invoiceNo={previewNo} t={t}
        sourceUrl={`/api/supplier-invoices/source?invoiceNo=${encodeURIComponent(previewNo)}`} />
    </PcContentLayout>
  );
}







