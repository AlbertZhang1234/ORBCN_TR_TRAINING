import { useState, useMemo } from 'react';
import { Button, IconButton, Tooltip } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import TableViewRoundedIcon from '@mui/icons-material/TableViewRounded';
import type { FilterField, FilterValue } from '@/components/Structures/CSmartFilter';
import type { TableLayout } from '@/components/Structures/CTable/types';
import { resolveVariantFilters } from 'orbcafe-ui';
import { BusyStandardPage } from '../_components/TableLoadingMarquee';
import { variantService } from '../../../services/common/variant-service';
import type { ReimbursementListRow } from '../../../services/TravelReimbursement/list';
import type { ProjectListRow } from '../../../services/Projects/list';
import type { VariantMetadata } from '@/components/Molecules/CVariantManagement';
import {
  readBookingStatus,
  readApprovalStatus,
  readApprover,
  readCreatedAt,
  readTotalAmount,
  defaultFilters,
} from './helpers';
import { normalizeWorkflowStatus } from '../../../services/_core/locks';

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

function readMultiFilterValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
  }
  const single = String(value ?? '').trim().toLowerCase();
  return single ? [single] : [];
}

function toDateMillis(value: unknown): number | null {
  if (!value) {
    return null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }
  if (typeof value === 'object') {
    const candidate = value as {
      toDate?: () => Date;
      valueOf?: () => number;
      $d?: Date | string;
    };
    if (typeof candidate.toDate === 'function') {
      const date = candidate.toDate();
      const time = date.getTime();
      return Number.isFinite(time) ? time : null;
    }
    if (typeof candidate.valueOf === 'function') {
      const time = candidate.valueOf();
      if (Number.isFinite(time)) {
        return time;
      }
    }
    if (candidate.$d) {
      const time = new Date(candidate.$d).getTime();
      return Number.isFinite(time) ? time : null;
    }
  }
  const time = Date.parse(String(value));
  return Number.isFinite(time) ? time : null;
}

function normalizeDateRange(value: unknown): { start: number | null; end: number | null } {
  if (Array.isArray(value)) {
    return {
      start: toDateMillis(value[0]),
      end: toDateMillis(value[1]),
    };
  }
  if (value && typeof value === 'object') {
    const candidate = value as {
      startDate?: unknown;
      endDate?: unknown;
      from?: unknown;
      to?: unknown;
      start?: unknown;
      end?: unknown;
    };
    return {
      start: toDateMillis(candidate.startDate ?? candidate.from ?? candidate.start),
      end: toDateMillis(candidate.endDate ?? candidate.to ?? candidate.end),
    };
  }
  return { start: null, end: null };
}

function formatAmount(value: unknown): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return '';
  }
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDateYmd(value: unknown): string {
  const ms = toDateMillis(value);
  if (ms === null) {
    return String(value ?? '').trim();
  }

  const date = new Date(ms);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface ReimbursementListProps {
  rows: ReimbursementListRow[];
  projects: ProjectListRow[];
  loading: boolean;
  selected: string[];
  onSelectionChange: (ids: string[]) => void;
  onOpenCreate: () => void;
  onOpenEdit: () => void;
  onDelete: () => void;
  onApprove: () => void;
  onDetail: (row: ReimbursementListRow) => void;
  t: (key: string, defaultVal: string) => string;
  showManageActions?: boolean;
  onBook?: () => void;
  onExport?: () => void;
  selectionMode?: 'single' | 'multiple';
  pageTitle?: string;
  appId?: string;
  tableKey?: string;
  layoutStorageKey?: string;
}

export default function ReimbursementList({
  rows,
  projects,
  loading,
  selected,
  onSelectionChange,
  onOpenCreate,
  onOpenEdit,
  onDelete,
  onApprove,
  onDetail,
  t,
  showManageActions = true,
  onBook,
  onExport,
  selectionMode = 'single',
  pageTitle,
  appId = 'pc-reimbursements',
  tableKey = 'otto_v_tr_all',
  layoutStorageKey,
}: ReimbursementListProps) {
  const [filters, setFilters] = useState<Record<string, FilterValue>>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<Record<string, FilterValue>>(defaultFilters);
  const [layout, setLayout] = useState<TableLayout | null>(null);

  const LAYOUT_KEY = layoutStorageKey ?? 'pc_reimbursements_default_layout_v2';

  useMemo(() => {
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

  const projectDescById = useMemo(() => {
    const map = new Map<string, string>();
    projects.forEach((project) => {
      const id = String(project.projectid ?? '').trim();
      if (!id) {
        return;
      }
      map.set(id, String(project.description ?? '').trim());
    });
    return map;
  }, [projects]);

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
        {
          id: 'id',
          label: t('id', 'ID'),
          type: 'text',
        },
        {
          id: 'projectid',
          label: t('project_id', 'Project ID'),
          type: 'multi-select',
          options: Array.from(
            new Map(
              projects
                .map((project) => {
                  const id = String(project.projectid ?? '').trim();
                  if (!id) {
                    return null;
                  }
                  const description = String(project.description ?? '').trim();
                  return [
                    id,
                    {
                      value: id,
                      label: description ? `${id} - ${description}` : id,
                    },
                  ] as const;
                })
                .filter((item): item is readonly [string, { value: string; label: string }] => Boolean(item)),
            ).values(),
          ).sort((a, b) => a.value.localeCompare(b.value)),
        },
        {
          id: 'userid',
          label: t('applicant', 'Applicant'),
          type: 'multi-select',
          options: buildOptions(rows.map((row) => String(row.userid ?? '').trim())),
        },
        {
          id: 'created_at',
          label: t('created_at', 'Created At'),
          type: 'date',
        },
        {
          id: 'bookingstatus',
          label: t('booking_status', 'Booking Status'),
          type: 'multi-select',
          options: buildOptions(
            rows.map((row) => String(readBookingStatus(row)).trim()),
            (value) => statusLabel(normalizeWorkflowStatus(value), t),
          ),
        },
        {
          id: 'approvalstatus',
          label: t('approval_status', 'Approval Status'),
          type: 'multi-select',
          options: buildOptions(
            rows.map((row) => String(readApprovalStatus(row)).trim()),
            (value) => statusLabel(normalizeWorkflowStatus(value), t),
          ),
        },
        {
          id: 'approver',
          label: t('approver', 'Approver'),
          type: 'multi-select',
          options: buildOptions(rows.map((row) => String(readApprover(row)).trim())),
        },
      ];
    },
    [projects, rows, t],
  );

  const normalizedRows = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        _bookingstatus: readBookingStatus(row),
        _approvalstatus: readApprovalStatus(row),
        _approver: readApprover(row),
        _createdAt: readCreatedAt(row),
        _createdAtMs: toDateMillis(readCreatedAt(row)),
        _totalAmount: readTotalAmount(row),
        _projectid: String(row.projectid ?? '').trim(),
        _projectdesc:
          String(row.project_description ?? '').trim() ||
          projectDescById.get(String(row.projectid ?? '').trim()) ||
          '',
        _key: String(row.id ?? row.trno ?? ''),
      })),
    [projectDescById, rows],
  );

  const filteredRows = useMemo(() => {
    const idFilters = readMultiFilterValues(appliedFilters.id?.value);
    const projectFilters = readMultiFilterValues(appliedFilters.projectid?.value);
    const userFilters = readMultiFilterValues(appliedFilters.userid?.value);
    const createdAtRange = normalizeDateRange(appliedFilters.created_at?.value);
    const bookingFilters = readMultiFilterValues(appliedFilters.bookingstatus?.value);
    const approvalFilters = readMultiFilterValues(appliedFilters.approvalstatus?.value);
    const approverFilters = readMultiFilterValues(appliedFilters.approver?.value);

    return normalizedRows.filter((row) => {
      const id = String(row.id ?? '').trim().toLowerCase();
      const projectId = String(row._projectid ?? '').trim().toLowerCase();
      const user = String(row.userid ?? '').trim().toLowerCase();
      const booking = String(row._bookingstatus ?? '').trim().toLowerCase();
      const approval = String(row._approvalstatus ?? '').trim().toLowerCase();
      const approver = String(row._approver ?? '').trim().toLowerCase();

      if (idFilters.length > 0 && !idFilters.includes(id)) {
        return false;
      }
      if (projectFilters.length > 0 && !projectFilters.includes(projectId)) {
        return false;
      }
      if (userFilters.length > 0 && !userFilters.includes(user)) {
        return false;
      }
      if (createdAtRange.start !== null || createdAtRange.end !== null) {
        const createdAtMs = Number(row._createdAtMs);
        if (!Number.isFinite(createdAtMs)) {
          return false;
        }
        if (createdAtRange.start !== null && createdAtMs < createdAtRange.start) {
          return false;
        }
        if (createdAtRange.end !== null && createdAtMs > createdAtRange.end + 24 * 60 * 60 * 1000 - 1) {
          return false;
        }
      }
      if (bookingFilters.length > 0 && !bookingFilters.includes(booking)) {
        return false;
      }
      if (approvalFilters.length > 0 && !approvalFilters.includes(approval)) {
        return false;
      }
      if (approverFilters.length > 0 && !approverFilters.includes(approver)) {
        return false;
      }
      return true;
    });
  }, [normalizedRows, appliedFilters]);

  const columns = useMemo<any[]>(
    () => [
      {
        id: 'id',
        label: t('id', 'ID'),
        minWidth: 90,
        render: (value: any, row: any) => (
          <Button
            variant="text"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onDetail(row);
            }}
            sx={{
              minWidth: 0,
              p: 0,
              textTransform: 'none',
              fontWeight: 'bold',
              justifyContent: 'flex-start',
              textAlign: 'left',
              color: 'primary.main',
            }}
          >
            {value}
          </Button>
        ),
      },
      { id: '_projectid', label: t('project_id', 'Project ID'), minWidth: 130 },
      { id: '_projectdesc', label: t('project_description', 'Project Description'), minWidth: 220 },
      { id: 'userid', label: t('applicant', 'Applicant'), minWidth: 160 },
      {
        id: '_totalAmount',
        label: t('reimbursement_amount', 'Reimbursement Amount'),
        minWidth: 160,
        align: 'right',
        render: (value: number) => formatAmount(value),
      },
      {
        id: '_createdAt',
        label: t('created_at', 'Created At'),
        minWidth: 130,
        render: (value: string) => formatDateYmd(value),
      },
      {
        id: '_bookingstatus',
        label: t('booking_status', 'Booking Status'),
        minWidth: 140,
        render: (value: string) => statusLabel(normalizeWorkflowStatus(value), t),
      },
      {
        id: '_approvalstatus',
        label: t('approval_status', 'Approval Status'),
        minWidth: 140,
        render: (value: string) => statusLabel(normalizeWorkflowStatus(value), t),
      },
      { id: '_approver', label: t('approver', 'Approver'), minWidth: 150 },
    ],
    [onDetail, t],
  );

  const createAction = (
    <Tooltip key="create" title={t('create_reimbursement', 'Create Reimbursement')}>
      <IconButton onClick={onOpenCreate} aria-label={t('create_reimbursement', 'Create Reimbursement')}>
        <AddRoundedIcon />
      </IconButton>
    </Tooltip>
  );

  const editAction = (
    <Tooltip key="edit" title={selected.length === 1 ? t('edit_reimbursement', 'Edit Reimbursement') : t('please_select_one_reimbursement', 'Please select one reimbursement record')}>
      <span>
        <IconButton onClick={onOpenEdit} disabled={selected.length !== 1} aria-label={t('edit_reimbursement', 'Edit Reimbursement')}>
          <EditRoundedIcon />
        </IconButton>
      </span>
    </Tooltip>
  );

  const deleteAction = (
    <Tooltip key="delete" title={selected.length === 1 ? t('delete_reimbursement', 'Delete Reimbursement') : t('please_select_one_reimbursement', 'Please select one reimbursement record')}>
      <span>
        <IconButton onClick={onDelete} disabled={selected.length !== 1} aria-label={t('delete_reimbursement', 'Delete Reimbursement')}>
          <DeleteRoundedIcon />
        </IconButton>
      </span>
    </Tooltip>
  );

  const approveAction = (
    <Tooltip key="approve" title={selected.length === 1 ? t('approve_reimbursement', 'Approve Reimbursement') : t('please_select_one_reimbursement', 'Please select one reimbursement record')}>
      <span>
        <IconButton onClick={onApprove} disabled={selected.length !== 1} aria-label={t('approve_reimbursement', 'Approve Reimbursement')}>
          <TaskAltRoundedIcon />
        </IconButton>
      </span>
    </Tooltip>
  );

  const bookAction = (
    <Tooltip key="book" title={selected.length > 0 ? t('book_reimbursement', 'Book Reimbursement') : t('please_select', 'Please select')}>
      <span>
        <IconButton onClick={onBook} disabled={selected.length === 0} aria-label={t('book_reimbursement', 'Book Reimbursement')}>
          <FactCheckRoundedIcon />
        </IconButton>
      </span>
    </Tooltip>
  );

  const exportAction = (
    <Tooltip key="export" title={selected.length > 0 ? t('export_excel', 'Export Excel') : t('please_select', 'Please select')}>
      <span>
        <IconButton onClick={onExport} disabled={selected.length === 0} aria-label={t('export_excel', 'Export Excel')}>
          <TableViewRoundedIcon />
        </IconButton>
      </span>
    </Tooltip>
  );

  const actions = [
    ...(showManageActions ? [createAction, editAction, deleteAction, approveAction] : []),
    ...(onBook ? [bookAction] : []),
    ...(onExport ? [exportAction] : []),
  ];

  return (
    <BusyStandardPage
      busy={loading}
      title={pageTitle ?? t('reimbursements', 'Reimbursement Management')}
      hideHeader
      spacing={1}
      filterConfig={{
        appId,
        tableKey,
        variantService,
        fields: filterFields,
        filters,
        onFilterChange: setFilters,
        onSearch: () => setAppliedFilters({ ...filters }),
        onVariantLoad: (v: any) => {
          const variant = v as VariantMetadata;
          const nextFilters =
            (resolveVariantFilters(variant, tableKey) as Record<string, FilterValue> | null) ??
            (variant.filters as Record<string, FilterValue> | undefined) ??
            defaultFilters;
          setFilters(nextFilters);
          setAppliedFilters(nextFilters);
        },
      }}
      tableProps={{
        appId,
        title: pageTitle ?? t('reimbursements', 'Reimbursement Management'),
        columns,
        rows: filteredRows,
        rowKey: '_key',
        fitContainer: true,
        selectionMode,
        selected,
        onSelectionChange: (rowsSelected: unknown[]) => onSelectionChange(rowsSelected.map((x) => String(x))),
        layout: layout ?? undefined,
        onLayoutSave: handleSaveLayout,
        actions,
      }}
    />
  );
}
