'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import { CAppPageLayout, resolveVariantFilters } from 'orbcafe-ui';
import type { FilterField, FilterValue } from '@/components/Structures/CSmartFilter';
import type { TableLayout } from '@/components/Structures/CTable/types';
import { useRouter } from 'next/navigation';
import { usePcI18n } from '../_components/PcI18nProvider';
import { getSessionUser, type SessionUser } from '../_components/session';
import { buildPcMenuData, HeaderLogo } from '../_components/nav';
import { useMessageBox } from '../_components/useMessageBox';
import { performClientLogout } from '../../../services/Auth/logoutClient';
import { variantService } from '../../../services/common/variant-service';
import { listInvoices, type InvoiceListRow } from '../../../services/Invoice/list';
import { deleteInvoice } from '../../../services/Invoice/delete';
import { listUsers, type UserListRow } from '../../../services/User/list';
import { listTravelEntries, type TravelEntryListRow } from '../../../services/TravelEntry/list';
import { BusyStandardPage } from '../_components/TableLoadingMarquee';
import type { VariantMetadata } from '@/components/Molecules/CVariantManagement';
import { normalizeWorkflowStatus } from '../../../services/_core/locks';
import { readStatus, statusLabel, toTrimmedString } from './_components/shared';
import InvoiceCreateDialog from './_components/InvoiceCreateDialog';
import InvoiceEditDialog from './_components/InvoiceEditDialog';
import InvoiceImportDialog from './_components/InvoiceImportDialog';
import InvoicePreviewDialog from './_components/InvoicePreviewDialog';

const defaultFilters: Record<string, FilterValue> = {
  invoiceno: { value: '', operator: 'contains' },
  userid: { value: [], operator: 'anyOf' },
  travelid: { value: [], operator: 'anyOf' },
  bookingcode: { value: [], operator: 'anyOf' },
  status: { value: [], operator: 'anyOf' },
};

function readMultiFilterValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
  }
  const single = String(value ?? '').trim().toLowerCase();
  return single ? [single] : [];
}

function formatDateOnly(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!text) {
    return '';
  }
  const isoDateMatch = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDateMatch?.[1]) {
    return isoDateMatch[1];
  }
  const ts = Date.parse(text);
  if (Number.isFinite(ts)) {
    return new Date(ts).toISOString().slice(0, 10);
  }
  return text;
}

export default function InvoicesPage() {
  const router = useRouter();
  const { t, lang, changeLanguage } = usePcI18n();
  const { showError, showSuccess, showInfo, messageBox } = useMessageBox(t);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);

  const [rows, setRows] = useState<InvoiceListRow[]>([]);
  const [users, setUsers] = useState<UserListRow[]>([]);
  const [travelEntries, setTravelEntries] = useState<TravelEntryListRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [layout, setLayout] = useState<TableLayout | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<Record<string, FilterValue>>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<Record<string, FilterValue>>(defaultFilters);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewInvoiceNo, setPreviewInvoiceNo] = useState('');
  const [quickUploadHandled, setQuickUploadHandled] = useState(false);
  const [quickUploadRequested, setQuickUploadRequested] = useState(false);

  const reportError = (message: string) => {
    setError(message);
    showError(message);
  };

  const LAYOUT_KEY = 'pc_invoices_default_layout_v1';

  useEffect(() => {
    const user = getSessionUser();
    if (!user) {
      router.replace('/pc/login');
      return;
    }
    setSessionUser(user);
  }, [router]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    setQuickUploadRequested(params.get('quickUpload') === '1');
  }, []);

  useEffect(() => {
    if (!quickUploadRequested || quickUploadHandled || !sessionUser) {
      return;
    }

    setImportOpen(true);
    setQuickUploadHandled(true);
  }, [quickUploadHandled, quickUploadRequested, sessionUser]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [invoiceRows, userRows, travelRows] = await Promise.all([
        listInvoices(),
        listUsers(),
        listTravelEntries(),
      ]);
      setRows(invoiceRows);
      setUsers(userRows);
      setTravelEntries(travelRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const raw = window.localStorage.getItem(LAYOUT_KEY);
      if (raw) {
        setLayout(JSON.parse(raw) as TableLayout);
      }
    } catch {
      // ignore broken layout cache
    }
  }, []);

  const handleSaveLayout = (nextLayout: TableLayout) => {
    setLayout(nextLayout);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(nextLayout));
    }
  };

  const existingInvoiceNoSet = useMemo(
    () =>
      new Set(
        rows
          .map((row) => toTrimmedString(row.invoiceno))
          .filter((x) => x.length > 0),
      ),
    [rows],
  );

  const removeSelected = async () => {
    if (selected.length === 0) {
      reportError(t('please_select_invoices_delete', 'Please select invoices to delete'));
      return;
    }
    if (typeof window !== 'undefined' && !window.confirm(t('confirm_delete_invoices', 'Confirm delete selected invoices?'))) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      for (const id of selected) {
        await deleteInvoice(id);
      }
      setSelected([]);
      await load();
      showSuccess(t('invoice_deleted_success', 'Invoices deleted successfully'));
    } catch (err) {
      reportError(err instanceof Error ? err.message : t('failed_delete_invoice', 'Failed to delete invoice'));
    } finally {
      setLoading(false);
    }
  };

  const markBooked = async () => {
    if (selected.length === 0) {
      reportError(t('please_select_invoices', 'Please select invoices'));
      return;
    }
    showInfo(t('book_invoice_instruction', 'Please book invoices in Reimbursement page (requires reimbursement association)'));
  };

  const filterFields = useMemo<FilterField[]>(
    () => {
      const buildOptions = (values: string[], mapLabel?: (value: string) => string) =>
        Array.from(new Set(values.filter(Boolean)))
          .sort((a, b) => a.localeCompare(b))
          .map((value) => ({
            value,
            label: mapLabel ? mapLabel(value) : value,
          }));

      return [
        { id: 'invoiceno', label: t('invoice_no', 'Invoice No'), type: 'text' },
        {
          id: 'userid',
          label: t('user_id', 'User ID'),
          type: 'multi-select',
          options: buildOptions(rows.map((row) => String(row.userid ?? '').trim())),
        },
        {
          id: 'travelid',
          label: t('travel_id', 'Travel ID'),
          type: 'multi-select',
          options: buildOptions(rows.map((row) => String(row.travelid ?? '').trim())),
        },
        {
          id: 'bookingcode',
          label: t('booking_rule', 'Booking Rule'),
          type: 'multi-select',
          options: buildOptions(rows.map((row) => String(row.bookingcode ?? '').trim())),
        },
        {
          id: 'status',
          label: t('status', 'Status'),
          type: 'multi-select',
          options: buildOptions(
            rows.map((row) => String(readStatus(row)).trim()),
            (value) => statusLabel(normalizeWorkflowStatus(value), t),
          ),
        },
      ];
    },
    [rows, t],
  );

  const normalizedRows = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        _status: readStatus(row),
      })),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const noFilter = String(appliedFilters.invoiceno?.value ?? '').trim().toLowerCase();
    const userFilters = readMultiFilterValues(appliedFilters.userid?.value);
    const travelFilters = readMultiFilterValues(appliedFilters.travelid?.value);
    const bookingCodeFilters = readMultiFilterValues(appliedFilters.bookingcode?.value);
    const statusFilters = readMultiFilterValues(appliedFilters.status?.value);

    return normalizedRows.filter((row) => {
      const no = String(row.invoiceno ?? '').trim().toLowerCase();
      const user = String(row.userid ?? '').trim().toLowerCase();
      const travel = String(row.travelid ?? '').trim().toLowerCase();
      const bookingCode = String(row.bookingcode ?? '').trim().toLowerCase();
      const status = String(row._status ?? '').trim().toLowerCase();
      if (noFilter && !no.toLowerCase().includes(noFilter)) {
        return false;
      }
      if (userFilters.length > 0 && !userFilters.includes(user)) {
        return false;
      }
      if (travelFilters.length > 0 && !travelFilters.includes(travel)) {
        return false;
      }
      if (bookingCodeFilters.length > 0 && !bookingCodeFilters.includes(bookingCode)) {
        return false;
      }
      if (statusFilters.length > 0 && !statusFilters.includes(status)) {
        return false;
      }
      return true;
    });
  }, [normalizedRows, appliedFilters]);

  const columns = useMemo<any[]>(
    () => [
      {
        id: 'invoiceno',
        label: t('invoice_no', 'Invoice No'),
        minWidth: 220,
        render: (value: string) => {
          if (!value) return null;
          return (
            <span
              style={{
                color: '#1976d2',
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
              onClick={(e) => {
                e.stopPropagation();
                setPreviewInvoiceNo(value);
                setPreviewOpen(true);
              }}
            >
              {value}
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
        id: 'invoicedate',
        label: t('invoice_date', 'Invoice Date'),
        minWidth: 140,
        render: (value: unknown) => formatDateOnly(value),
      },
      { id: 'totalnetamount', label: t('net_amount', 'Net Amount'), minWidth: 130, numeric: true },
      { id: 'taxamount', label: t('tax_amount', 'Tax Amount'), minWidth: 130, numeric: true },
      { id: 'grossamount', label: t('gross_amount', 'Gross Amount'), minWidth: 130, numeric: true },
      { id: 'currency', label: t('currency', 'Currency'), minWidth: 110 },
      { id: 'originalamount', label: t('original_amount', 'Original Amount'), minWidth: 150, numeric: true },
      { id: 'originalcurrency', label: t('original_currency', 'Original Currency'), minWidth: 150 },
      {
        id: '_status',
        label: t('status', 'Status'),
        minWidth: 140,
        render: (value: string) => statusLabel(normalizeWorkflowStatus(value), t),
      },
    ],
    [t],
  );

  const userOptions = useMemo(
    () =>
      users.map((user) => {
        const userid = String(user.userid ?? '');
        const fullname = [String(user.firstname ?? ''), String(user.lastname ?? '')]
          .join(' ')
          .trim();
        return {
          value: userid,
          label: fullname ? `${userid} - ${fullname}` : userid,
        };
      }),
    [users],
  );

  const travelOptions = useMemo(
    () =>
      travelEntries.map((travel) => {
        const travelId = String(travel.travelid ?? '').trim();
        const projectId = String(travel.projectid ?? '').trim();
        const destination = String(travel.destination ?? '').trim();
        const metaParts = [projectId, destination].filter((part) => part.length > 0);

        return {
          value: travelId,
          label: metaParts.length > 0 ? `${travelId} (${metaParts.join(' | ')})` : travelId,
        };
      }),
    [travelEntries],
  );

  const menuData = useMemo(() => buildPcMenuData(t), [t]);

  const headerUser = useMemo(() => {
    if (!sessionUser) {
      return undefined;
    }
    const name =
      sessionUser.firstname && sessionUser.lastname
        ? `${sessionUser.firstname} ${sessionUser.lastname}`
        : sessionUser.userid;
    return {
      name,
      subtitle: sessionUser.email ?? '',
      avatarText: name.slice(0, 1).toUpperCase(),
    };
  }, [sessionUser]);

  const openEditDialog = () => {
    if (selected.length !== 1) {
      reportError(t('please_select_one_invoice_edit', 'Please select one invoice to edit'));
      return;
    }
    setEditOpen(true);
  };

  const editingRow = useMemo(
    () => (selected.length === 1 ? rows.find((row) => String(row.invoiceno) === selected[0]) || null : null),
    [rows, selected],
  );

  const createAction = (
    <Tooltip title={t('create_invoice', 'Create Invoice')}>
      <IconButton onClick={() => setCreateOpen(true)} aria-label={t('create_invoice', 'Create Invoice')}>
        <AddRoundedIcon />
      </IconButton>
    </Tooltip>
  );

  const editAction = (
    <Tooltip title={selected.length === 1 ? t('edit_invoice', 'Edit Invoice') : t('please_select_one_invoice_edit', 'Please select one invoice to edit')}>
      <span>
        <IconButton onClick={openEditDialog} disabled={selected.length !== 1} aria-label={t('edit_invoice', 'Edit Invoice')}>
          <EditRoundedIcon />
        </IconButton>
      </span>
    </Tooltip>
  );

  const deleteAction = (
    <Tooltip title={selected.length > 0 ? t('delete_invoice', 'Delete Invoice') : t('please_select_invoices_delete', 'Please select invoices to delete')}>
      <span>
        <IconButton onClick={removeSelected} disabled={selected.length === 0} aria-label={t('delete_invoice', 'Delete Invoice')}>
          <DeleteRoundedIcon />
        </IconButton>
      </span>
    </Tooltip>
  );

  const bookAction = (
    <Tooltip title={selected.length > 0 ? t('book_invoice', 'Book Invoice') : t('please_select_invoices', 'Please select invoices')}>
      <span>
        <IconButton onClick={markBooked} disabled={selected.length === 0} aria-label={t('book_invoice', 'Book Invoice')}>
          <FactCheckRoundedIcon />
        </IconButton>
      </span>
    </Tooltip>
  );

  if (!sessionUser) {
    return null;
  }

  return (
    <CAppPageLayout
      appTitle={t('invoices', 'Invoice Management')}
      menuData={menuData}
      logo={<HeaderLogo />}
      user={headerUser}
      locale={lang}
      onLocaleChange={(l) => changeLanguage(l as any)}
      localeOptions={['en', 'zh']}
      onUserLogout={() => void performClientLogout({ router, replace: true })}
      contentSx={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      {error ? <Alert severity="error">{error}</Alert> : null}
      <BusyStandardPage
          busy={loading}
          title={t('invoices', 'Invoice Management')}
          hideHeader
          spacing={1}
          filterConfig={{
            appId: 'pc-invoices',
            tableKey: 'otto_invoices',
            variantService,
            fields: filterFields,
            filters,
            onFilterChange: setFilters,
            onSearch: () => setAppliedFilters({ ...filters }),
            onVariantLoad: (v: any) => {
              const variant = v as VariantMetadata;
              const nextFilters =
                (resolveVariantFilters(variant, 'otto_invoices') as Record<string, FilterValue> | null) ??
                (variant.filters as Record<string, FilterValue> | undefined) ??
                defaultFilters;
              setFilters(nextFilters);
              setAppliedFilters(nextFilters);
            },
          }}
          tableProps={{
            appId: 'pc-invoices',
            title: t('invoices', 'Invoice Management'),
            columns,
            rows: filteredRows,
            rowKey: 'invoiceno',
            fitContainer: true,
            selectionMode: 'multiple',
            selected,
            onSelectionChange: (rowsSelected: unknown[]) => setSelected(rowsSelected.map((x) => String(x))),
            layout: layout ?? undefined,
            onLayoutSave: handleSaveLayout,
            actions: [createAction, editAction, deleteAction, bookAction],
          }}
        />

      <InvoiceCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={async () => {
          await load();
        }}
        userOptions={userOptions}
        travelOptions={travelOptions}
        t={t}
        onOpenImport={() => {
          setCreateOpen(false);
          setImportOpen(true);
        }}
        defaultUserId={sessionUser.userid}
      />

      <InvoiceEditDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSuccess={async () => {
          await load();
        }}
        userOptions={userOptions}
        travelOptions={travelOptions}
        t={t}
        initialData={editingRow}
      />

      <InvoiceImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={async () => {
          await load();
        }}
        userOptions={userOptions}
        travelOptions={travelOptions}
        t={t}
        defaultUserId={sessionUser.userid}
        existingInvoiceNoSet={existingInvoiceNoSet}
      />

      <InvoicePreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        invoiceNo={previewInvoiceNo}
        t={t}
      />
      {messageBox}
    </CAppPageLayout>
  );
}
