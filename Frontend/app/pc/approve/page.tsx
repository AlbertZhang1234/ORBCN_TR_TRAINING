'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
} from '@mui/material';
import { CAppPageLayout, resolveVariantFilters } from 'orbcafe-ui';
import type { FilterField, FilterValue } from '@/components/Structures/CSmartFilter';
import type { TableLayout } from '@/components/Structures/CTable/types';
import { useRouter } from 'next/navigation';
import { usePcI18n } from '../_components/PcI18nProvider';
import { getSessionUser, type SessionUser } from '../_components/session';
import { buildPcMenuData, HeaderLogo } from '../_components/nav';
import { performClientLogout } from '../../../services/Auth/logoutClient';
import { variantService } from '../../../services/common/variant-service';
import {
  listReimbursements,
  type ReimbursementListRow,
} from '../../../services/TravelReimbursement/list';
import { listProjects } from '../../../services/Projects/list';
import { approveTravelReimbursement } from '../../../services/TravelReimbursement/approve';
import type { ReimbursementFilter } from '../../../services/TravelReimbursement/_shared';
import { BusyStandardPage } from '../_components/TableLoadingMarquee';
import type { VariantMetadata } from '@/components/Molecules/CVariantManagement';
import { normalizeWorkflowStatus } from '../../../services/_core/locks';
import { listInvoices, type InvoiceListRow } from '../../../services/Invoice/list';
import { listTravelEntries, type TravelEntryListRow } from '../../../services/TravelEntry/list';

interface ApprovalHeaderRow extends ReimbursementListRow {
  _key: string;
  _approvalstatus: string;
  _bookingstatus: string;
  _approver: string;
  _createdAt: string;
}

const defaultFilters: Record<string, FilterValue> = {
  id: { value: '', operator: 'contains' },
  userid: { value: [], operator: 'anyOf' },
  approver: { value: [], operator: 'anyOf' },
  approvalstatus: { value: [], operator: 'anyOf' },
};

function readMultiFilterValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
  }
  const single = String(value ?? '').trim().toLowerCase();
  return single ? [single] : [];
}

function toFilter(row: ReimbursementListRow): ReimbursementFilter {
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

function readApprover(row: ReimbursementListRow): string {
  return String(row.approver ?? row.approvalby ?? row.approvedby ?? '').trim();
}

function readCreatedAt(row: ReimbursementListRow): string {
  return String(row.created_at ?? row.createdat ?? '');
}

function readBookingStatus(row: ReimbursementListRow): string {
  return String(row.bookingstatus ?? row.booking_status ?? row.financestatus ?? row.finance_status ?? '');
}

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

function getRowDisplayId(row: ReimbursementListRow): string {
  const id = String(row.id ?? '').trim();
  if (id) {
    return id;
  }
  return String(row.trno ?? '').trim();
}

function parseThemeMode(value: unknown): 'light' | 'dark' | null {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'light') {
    return 'light';
  }
  if (normalized === 'dark') {
    return 'dark';
  }
  return null;
}

function readCurrentThemeMode(): 'light' | 'dark' {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  const docMode =
    parseThemeMode(document.documentElement.getAttribute('data-mui-color-scheme')) ??
    parseThemeMode(document.documentElement.dataset.muiColorScheme) ??
    parseThemeMode(document.documentElement.dataset.pcTheme) ??
    parseThemeMode(window.localStorage.getItem('pc_color_mode'));

  if (docMode) {
    return docMode;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function ApprovePage() {
  const router = useRouter();
  const { t, lang, changeLanguage } = usePcI18n();
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [rows, setRows] = useState<ApprovalHeaderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState<Record<string, FilterValue>>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<Record<string, FilterValue>>(defaultFilters);

  const [layout, setLayout] = useState<TableLayout | null>(null);
  const LAYOUT_KEY = 'pc_approve_default_layout_v2';

  const [dialogSaving, setDialogSaving] = useState(false);

  // Cached data for detail view
  const [allInvoices, setAllInvoices] = useState<InvoiceListRow[]>([]);
  const [allTravelEntries, setAllTravelEntries] = useState<TravelEntryListRow[]>([]);

  useEffect(() => {
    const user = getSessionUser();
    if (!user) {
      router.replace('/pc/login');
      return;
    }
    setSessionUser(user);
  }, [router]);

  const load = async (userid: string) => {
    setLoading(true);
    setError('');
    try {
      const [reimbursementRows, projectRows, invoiceRows, travelRows] = await Promise.all([
        listReimbursements(),
        listProjects(),
        listInvoices(),
        listTravelEntries(),
      ]);

      setAllInvoices(invoiceRows);
      setAllTravelEntries(travelRows);

      const projectManagerMap = new Map(
        projectRows.map((p) => [String(p.projectid), String(p.projectmanager || '')]),
      );

      console.log('ApprovePage Debug:', {
        userid,
        projectCount: projectRows.length,
        reimbursementCount: reimbursementRows.length,
        sampleProject: projectRows[0],
        pmMapKeys: Array.from(projectManagerMap.keys()),
      });

      const nextRows: ApprovalHeaderRow[] = reimbursementRows
        .map((row) => {
          const key = getRowDisplayId(row);
          return {
            ...row,
            _key: key,
            _approvalstatus: normalizeWorkflowStatus(row.approvalstatus ?? row.approval_status),
            _bookingstatus: readBookingStatus(row),
            _approver: readApprover(row),
            _createdAt: readCreatedAt(row),
          };
        })
        .filter((row) => row._key)
        .filter((row) => {
          const status = row._approvalstatus;
          const projectId = String(row.projectid);
          const pm = projectManagerMap.get(projectId);
          
          const isPmMatch = String(pm).toLowerCase() === String(userid).toLowerCase();
          const isApproverMatch = String(row._approver).toLowerCase() === String(userid).toLowerCase();

          if (row.id === 114 || row.trno === '114') {
             console.log('Debug Row 114:', {
                id: row.id,
                status,
                projectId,
                pm,
                userid,
                isPmMatch,
                isApproverMatch,
                approverField: row._approver
             });
          }

          if (status === 'WAIT FOR APPROVAL') {
            // Show if user is the current Project Manager OR if they are explicitly listed as the approver
            return isPmMatch || isApproverMatch;
          }
          return isApproverMatch;
        });

      setRows(nextRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failed_load_approvals', 'Failed to load approvals'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionUser?.userid) {
      return;
    }
    void load(sessionUser.userid);
  }, [sessionUser?.userid]);

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

  const openDetail = async (row: ApprovalHeaderRow) => {
    const rawId = row.id;
    const params = new URLSearchParams();
    if (typeof rawId === 'number' && Number.isFinite(rawId)) {
      params.set('id', String(rawId));
    } else if (typeof rawId === 'string') {
      const parsed = Number(rawId);
      if (Number.isFinite(parsed)) {
        params.set('id', String(parsed));
      }
    }

    if (!params.get('id')) {
      const trno = String(row.trno ?? '').trim();
      if (trno) {
        params.set('trno', trno);
      }
    }

    if (params.size === 0) {
      alert(t('invalid_reimbursement', 'Invalid reimbursement record'));
      return;
    }

    params.set('mode', readCurrentThemeMode());

    const url = `/pc/approve/detail?${params.toString()}`;
    if (typeof window === 'undefined') {
      router.push(url);
      return;
    }

    const popup = window.open(
      url,
      `approve_detail_${params.get('id') ?? params.get('trno') ?? 'popup'}`,
      'popup=yes,width=1500,height=900,left=120,top=80,resizable=yes,scrollbars=yes',
    );

    if (!popup) {
      router.push(url);
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'APPROVAL_COMPLETE' && sessionUser?.userid) {
        void load(sessionUser.userid);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [sessionUser]);

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
        { id: 'id', label: t('reimbursement_id', 'Reimbursement ID'), type: 'text' },
        {
          id: 'userid',
          label: t('applicant', 'Applicant'),
          type: 'multi-select',
          options: buildOptions(rows.map((row) => String(row.userid ?? '').trim())),
        },
        {
          id: 'approver',
          label: t('approver', 'Approver'),
          type: 'multi-select',
          options: buildOptions(rows.map((row) => String(row._approver ?? '').trim())),
        },
        {
          id: 'approvalstatus',
          label: t('approval_status', 'Approval Status'),
          type: 'multi-select',
          options: buildOptions(
            rows.map((row) => String(row._approvalstatus ?? '').trim()),
            (value) => statusLabel(normalizeWorkflowStatus(value), t),
          ),
        },
      ];
    },
    [rows, t],
  );

  const filteredRows = useMemo(() => {
    const idFilter = String(appliedFilters.id?.value ?? '').trim().toLowerCase();
    const userFilters = readMultiFilterValues(appliedFilters.userid?.value);
    const approverFilters = readMultiFilterValues(appliedFilters.approver?.value);
    const approvalFilters = readMultiFilterValues(appliedFilters.approvalstatus?.value);

    return rows.filter((row) => {
      const id = getRowDisplayId(row).trim().toLowerCase();
      const userid = String(row.userid ?? '').trim().toLowerCase();
      const approver = String(row._approver ?? '').trim().toLowerCase();
      const approval = String(row._approvalstatus ?? '').trim().toLowerCase();

      if (idFilter && !id.includes(idFilter)) {
        return false;
      }
      if (userFilters.length > 0 && !userFilters.includes(userid)) {
        return false;
      }
      if (approverFilters.length > 0 && !approverFilters.includes(approver)) {
        return false;
      }
      if (approvalFilters.length > 0 && !approvalFilters.includes(approval)) {
        return false;
      }
      return true;
    });
  }, [rows, appliedFilters]);

  const columns = useMemo<any[]>(
    () => [
      {
        id: 'id',
        label: t('id', 'ID'),
        minWidth: 120,
        render: (_value: unknown, row: ApprovalHeaderRow) => {
          const idText = getRowDisplayId(row);
          return (
            <Button
              size="small"
              variant="text"
              onClick={(event) => {
                event.stopPropagation();
                void openDetail(row);
              }}
              sx={{ px: 0.5, minWidth: 'auto' }}
            >
              {idText}
            </Button>
          );
        },
      },
      { id: 'userid', label: t('applicant', 'Applicant'), minWidth: 160 },
      { id: '_createdAt', label: t('created_at', 'Created At'), minWidth: 180 },
      { id: '_approver', label: t('approver', 'Approver'), minWidth: 160 },
      {
        id: '_approvalstatus',
        label: t('approval_status', 'Approval Status'),
        minWidth: 180,
        render: (value: string) => statusLabel(normalizeWorkflowStatus(value), t),
      },
      {
        id: '_bookingstatus',
        label: t('booking_status', 'Booking Status'),
        minWidth: 150,
        render: (value: string) => statusLabel(normalizeWorkflowStatus(value), t),
      },
    ],
    [t],
  );

  const detailColumns = useMemo<any[]>(
    () => [
      { id: 'invoiceno', label: t('invoice_no', 'Invoice No'), minWidth: 180 },
      { id: 'supplier', label: t('supplier', 'Supplier'), minWidth: 220 },
      { id: 'description', label: t('description', 'Description'), minWidth: 220 },
      { id: 'comment', label: t('comment', 'Comment'), minWidth: 220 },
      { id: 'invoicedate', label: t('invoice_date', 'Invoice Date'), minWidth: 140 },
      { id: 'bookingcode', label: t('booking_rule', 'Booking Rule'), minWidth: 130 },
      { id: 'currency', label: t('currency', 'Currency'), minWidth: 100 },
      {
        id: 'status',
        label: t('status', 'Status'),
        minWidth: 120,
        render: (value: string) => statusLabel(normalizeWorkflowStatus(value), t),
      },
      { id: 'tr_amount', label: t('reimbursement_amount', 'Reimbursement Amount'), minWidth: 170 },
      { id: 'totalnetamount', label: t('net_amount', 'Net Amount'), minWidth: 120 },
      { id: 'taxamount', label: t('tax_amount', 'Tax Amount'), minWidth: 120 },
      { id: 'grossamount', label: t('gross_amount', 'Invoice Amount'), minWidth: 130 },
    ],
    [t],
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

  if (!sessionUser) {
    return null;
  }

  const tableBusy = loading || dialogSaving;

  return (
    <CAppPageLayout
      appTitle={t('approve', 'Approval')}
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
          busy={tableBusy}
          title={t('approve', 'Approval')}
          hideHeader
          spacing={1}
          filterConfig={{
            appId: 'pc-approve',
            tableKey: 'otto_tr_h_approve',
            variantService,
            fields: filterFields,
            filters,
            onFilterChange: setFilters,
            onSearch: () => setAppliedFilters({ ...filters }),
            onVariantLoad: (v: any) => {
              const variant = v as VariantMetadata;
              const nextFilters =
                (resolveVariantFilters(variant, 'otto_tr_h_approve') as Record<string, FilterValue> | null) ??
                (variant.filters as Record<string, FilterValue> | undefined) ??
                defaultFilters;
              setFilters(nextFilters);
              setAppliedFilters(nextFilters);
            },
          }}
          tableProps={{
            appId: 'pc-approve',
            title: t('approve', 'Approval'),
            columns,
            rows: filteredRows,
            rowKey: '_key',
            fitContainer: true,
            layout: layout ?? undefined,
            onLayoutSave: handleSaveLayout,
          }}
        />
    </CAppPageLayout>
  );
}
