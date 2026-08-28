'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  TextField,
  Tooltip,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import { CAppPageLayout, resolveVariantFilters } from 'orbcafe-ui';
import type { FilterField, FilterValue } from '@/components/Structures/CSmartFilter';
import type { TableLayout } from '@/components/Structures/CTable/types';
import { useRouter } from 'next/navigation';
import { usePcI18n } from '../_components/PcI18nProvider';
import { getSessionUser, type SessionUser } from '../_components/session';
import { useMessageBox } from '../_components/useMessageBox';
import { buildPcMenuData, HeaderLogo } from '../_components/nav';
import { performClientLogout } from '../../../services/Auth/logoutClient';
import { getClientSessionId } from '../../../services/_core/session';
import { variantService } from '../../../services/common/variant-service';
import { listTravelEntries, type TravelEntryListRow } from '../../../services/TravelEntry/list';
import { createTravelEntry } from '../../../services/TravelEntry/create';
import { changeTravelEntry } from '../../../services/TravelEntry/change';
import { deleteTravelEntry } from '../../../services/TravelEntry/delete';
import { listUsers, type UserListRow } from '../../../services/User/list';
import { listProjects, type ProjectListRow } from '../../../services/Projects/list';
import { BusyStandardPage } from '../_components/TableLoadingMarquee';
import { PcContentLayout } from '../_components/PcContentLayout';
import type { VariantMetadata } from '@/components/Molecules/CVariantManagement';

const defaultFilters: Record<string, FilterValue> = {
  travelid: { value: '', operator: 'contains' },
  userid: { value: '', operator: 'contains' },
  projectid: { value: '', operator: 'contains' },
  destination: { value: '', operator: 'contains' },
  fromdate: { value: '', operator: 'contains' },
  todate: { value: [], operator: 'between' },
};

const DAY_MS = 24 * 60 * 60 * 1000;

function buildNextTravelId(existingRows: TravelEntryListRow[], now = new Date()): string {
  const year = String(now.getFullYear());
  const prefix = `${year}`;
  let maxSeq = 0;

  for (const row of existingRows) {
    const value = String(row.travelid ?? '').trim();
    if (!new RegExp(`^${prefix}\\d{4}$`).test(value)) {
      continue;
    }
    const seq = Number(value.slice(4));
    if (Number.isFinite(seq) && seq > maxSeq) {
      maxSeq = seq;
    }
  }

  const nextSeq = maxSeq + 1;
  if (nextSeq > 9999) {
    throw new Error(`${year} 年差旅编号已达到上限 9999`);
  }

  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

function normalizeDateInput(value: string): string | null {
  const normalized = value.trim().replace(/\//g, '-');
  if (!normalized) {
    return null;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
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
  const single = toDateMillis(value);
  return { start: single, end: single };
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

function normalizeTravelDateForInput(value: unknown): string {
  const formatted = formatDateYmd(value);
  return normalizeDateInput(formatted) ?? '';
}

function readDateOnlyMillis(value: string): number | null {
  const normalized = normalizeDateInput(value);
  if (!normalized) {
    return null;
  }
  const time = new Date(`${normalized}T00:00:00`).getTime();
  return Number.isFinite(time) ? time : null;
}

function calculateTravelNights(fromDateValue: unknown, toDateValue: unknown): number {
  const start = readDateOnlyMillis(formatDateYmd(fromDateValue));
  const end = readDateOnlyMillis(formatDateYmd(toDateValue));
  if (start === null || end === null || end <= start) {
    return 0;
  }
  return Math.round((end - start) / DAY_MS);
}

function isDomesticDestination(destination: unknown): boolean {
  const text = String(destination ?? '').trim();
  if (!text) {
    return true;
  }
  if (/(香港|hong kong|澳门|澳門|macau|台湾|台灣|taiwan|德国|德國|germany|deutschland|法国|法國|france|美国|美國|usa|united states|英国|英國|uk|united kingdom|日本|japan|韩国|韓國|korea|新加坡|singapore|泰国|泰國|thailand|越南|vietnam|印度|india|意大利|義大利|italy|西班牙|spain|荷兰|荷蘭|netherlands|瑞士|switzerland|奥地利|奧地利|austria|澳大利亚|澳大利亞|australia|加拿大|canada|海外|国外|國外|overseas|foreign)/i.test(text)) {
    return false;
  }
  return /[\u4e00-\u9fff]/.test(text) || /\b(china|cn|prc|中国|国内)\b/i.test(text);
}

type DestinationClass = 'domestic' | 'overseas';

function normalizeDestinationClass(value: unknown): DestinationClass {
  return String(value ?? '').trim().toLowerCase() === 'overseas' ? 'overseas' : 'domestic';
}

async function classifyDestinationsForAllowance(destinations: string[]): Promise<Map<string, DestinationClass>> {
  const uniqueDestinations = Array.from(new Set(destinations.map((item) => item.trim()).filter(Boolean)));
  const result = new Map<string, DestinationClass>();
  if (uniqueDestinations.length === 0) {
    return result;
  }

  const response = await fetch('/api/travel-entry/classify-destinations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-session-id': getClientSessionId(),
    },
    body: JSON.stringify({ destinations: uniqueDestinations }),
  });
  if (!response.ok) {
    throw new Error('Failed to classify travel destinations');
  }

  const payload = (await response.json()) as {
    results?: Array<{ destination?: string; classification?: string }>;
  };
  for (const item of payload.results ?? []) {
    const destination = String(item.destination ?? '').trim();
    if (!destination) {
      continue;
    }
    result.set(destination, normalizeDestinationClass(item.classification));
  }
  return result;
}

function toExportTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

function canViewAllTravelEntries(user: SessionUser | null): boolean {
  if (!user) {
    return false;
  }
  if (user.permissions?.isAdmin || user.permissions?.isFinance) {
    return true;
  }
  const roleText = (user.roleids ?? []).join(' ').toLowerCase();
  return /super\s*admin|superadmin|admin|finance|accounting|财务/.test(roleText);
}

function normalizeProjectIdInput(value: string): string {
  const raw = value.trim();
  if (!raw) {
    return '';
  }
  // Defensive normalization: in case UI ever returns "ID - Description".
  const [head] = raw.split(' - ');
  return head?.trim() ?? '';
}

export default function TravelEntriesPage() {
  const router = useRouter();
  const { t, lang, changeLanguage } = usePcI18n();
  const { showError, showSuccess, messageBox } = useMessageBox(t);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);

  const [rows, setRows] = useState<TravelEntryListRow[]>([]);
  const [users, setUsers] = useState<UserListRow[]>([]);
  const [projects, setProjects] = useState<ProjectListRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [layout, setLayout] = useState<TableLayout | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<Record<string, FilterValue>>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<Record<string, FilterValue>>(defaultFilters);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [travelId, setTravelId] = useState('');
  const [userId, setUserId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [destination, setDestination] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const LAYOUT_KEY = 'pc_travel_entries_default_layout_v1';
  const canViewAll = canViewAllTravelEntries(sessionUser);

  const reportError = (message: string) => {
    setError(message);
    showError(message);
  };

  useEffect(() => {
    const user = getSessionUser();
    if (!user) {
      router.replace('/pc/login');
      return;
    }
    setSessionUser(user);
  }, [router]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [travelRows, userRows, projectRows] = await Promise.all([
        listTravelEntries(),
        listUsers(),
        listProjects(),
      ]);
      setRows(travelRows);
      setUsers(userRows);
      setProjects(projectRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load travel entries');
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

  const openCreateDialog = () => {
    setTravelId('');
    setUserId(sessionUser?.userid ?? '');
    setProjectId('');
    setDestination('');
    setFromDate('');
    setToDate('');
    setError('');
    setCreateOpen(true);
  };

  const openEditDialog = () => {
    if (selected.length !== 1) {
      reportError(t('please_select_one_travel_edit', 'Please select one travel entry to edit'));
      return;
    }
    const current = visibleRows.find((row) => String(row.travelid) === selected[0]);
    if (!current) {
      reportError(t('failed_load_travel', 'Failed to load travel entry'));
      return;
    }
    setTravelId(String(current.travelid ?? ''));
    setUserId(String(current.userid ?? ''));
    setProjectId(String(current.projectid ?? ''));
    setDestination(String(current.destination ?? ''));
    setFromDate(normalizeTravelDateForInput(current.fromdate));
    setToDate(normalizeTravelDateForInput(current.todate));
    setError('');
    setEditOpen(true);
  };

  const saveCreate = async () => {
    const user = userId.trim();
    const project = normalizeProjectIdInput(projectId);
    const fromDateValue = normalizeDateInput(fromDate);
    const toDateValue = normalizeDateInput(toDate);
    if (!user) {
      reportError(t('please_enter_user_id', 'Please enter User ID'));
      return;
    }
    if (!project) {
      reportError(t('please_enter_project_id', 'Please enter Project ID'));
      return;
    }
    if (!projects.some((row) => String(row.projectid ?? '').trim() === project)) {
      reportError(`${t('project_not_found', 'Project not found')}: ${project}`);
      return;
    }
    if (!fromDate.trim()) {
      reportError(t('please_enter_from_date', 'Please enter From Date'));
      return;
    }
    if (!fromDateValue) {
      reportError(t('invalid_date_format', 'Invalid Date format, please use YYYY-MM-DD'));
      return;
    }
    if (!toDate.trim()) {
      reportError(t('please_enter_to_date', 'Please enter To Date'));
      return;
    }
    if (!toDateValue) {
      reportError(t('invalid_date_format', 'Invalid Date format, please use YYYY-MM-DD'));
      return;
    }
    const fromDateMs = readDateOnlyMillis(fromDateValue);
    const toDateMs = readDateOnlyMillis(toDateValue);
    if (fromDateMs !== null && toDateMs !== null && toDateMs < fromDateMs) {
      reportError(t('to_date_before_from_date', 'To Date cannot be earlier than From Date'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const latestRows = await listTravelEntries();
      const id = buildNextTravelId(latestRows);
      await createTravelEntry({
        travelid: id,
        userid: user,
        projectid: project,
        destination: destination.trim() || null,
        fromdate: fromDateValue,
        todate: toDateValue,
      });
      setCreateOpen(false);
      await load();
      showSuccess(t('travel_created_success', 'Travel entry created successfully'));
    } catch (err) {
      reportError(err instanceof Error ? err.message : t('failed_create_travel', 'Failed to create travel entry'));
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    const id = travelId.trim();
    const normalizedProjectId = normalizeProjectIdInput(projectId);
    const fromDateValue = normalizeDateInput(fromDate);
    const toDateValue = normalizeDateInput(toDate);
    if (!id) {
      reportError(t('please_enter_travel_id', 'Please enter Travel ID'));
      return;
    }
    if (!fromDate.trim()) {
      reportError(t('please_enter_from_date', 'Please enter From Date'));
      return;
    }
    if (!fromDateValue) {
      reportError(t('invalid_date_format', 'Invalid Date format, please use YYYY-MM-DD'));
      return;
    }
    if (!toDate.trim()) {
      reportError(t('please_enter_to_date', 'Please enter To Date'));
      return;
    }
    if (!toDateValue) {
      reportError(t('invalid_date_format', 'Invalid Date format, please use YYYY-MM-DD'));
      return;
    }
    const fromDateMs = readDateOnlyMillis(fromDateValue);
    const toDateMs = readDateOnlyMillis(toDateValue);
    if (fromDateMs !== null && toDateMs !== null && toDateMs < fromDateMs) {
      reportError(t('to_date_before_from_date', 'To Date cannot be earlier than From Date'));
      return;
    }

    setSaving(true);
    setError('');
    try {
      await changeTravelEntry(id, {
        userid: userId.trim() || null,
        projectid: normalizedProjectId || null,
        destination: destination.trim() || null,
        fromdate: fromDateValue,
        todate: toDateValue,
      });
      setEditOpen(false);
      await load();
      showSuccess(t('travel_saved_success', 'Travel entry saved successfully'));
    } catch (err) {
      reportError(err instanceof Error ? err.message : t('failed_change_travel', 'Failed to change travel entry'));
    } finally {
      setSaving(false);
    }
  };

  const visibleRows = useMemo(() => {
    if (canViewAll) {
      return rows;
    }
    const currentUserId = String(sessionUser?.userid ?? '').trim().toLowerCase();
    if (!currentUserId) {
      return [];
    }
    return rows.filter((row) => String(row.userid ?? '').trim().toLowerCase() === currentUserId);
  }, [canViewAll, rows, sessionUser?.userid]);

  const removeSelected = async () => {
    if (selected.length === 0) {
      reportError(t('please_select_travel_delete', 'Please select travel entries to delete'));
      return;
    }
    if (typeof window !== 'undefined' && !window.confirm(t('confirm_delete_travel', 'Confirm delete selected travel entries?'))) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      for (const id of selected) {
        await deleteTravelEntry(id);
      }
      setSelected([]);
      await load();
      showSuccess(t('travel_deleted_success', 'Travel entries deleted successfully'));
    } catch (err) {
      reportError(err instanceof Error ? err.message : t('failed_delete_travel', 'Failed to delete travel entry'));
    } finally {
      setLoading(false);
    }
  };

  const filterFields = useMemo<FilterField[]>(
    () => [
      { id: 'travelid', label: t('travel_id', 'Travel ID'), type: 'text' },
      { id: 'userid', label: t('user_id', 'User ID'), type: 'text' },
      { id: 'projectid', label: t('project_id', 'Project ID'), type: 'text' },
      { id: 'destination', label: t('destination', 'Destination'), type: 'text' },
      { id: 'fromdate', label: t('from_date', 'From Date'), type: 'text' },
      { id: 'todate', label: t('to_date', 'To Date'), type: 'date' },
    ],
    [t],
  );

  const filteredRows = useMemo(() => {
    const travelFilter = String(appliedFilters.travelid?.value ?? '').trim().toLowerCase();
    const userFilter = String(appliedFilters.userid?.value ?? '').trim().toLowerCase();
    const projectFilter = String(appliedFilters.projectid?.value ?? '').trim().toLowerCase();
    const destinationFilter = String(appliedFilters.destination?.value ?? '').trim().toLowerCase();
    const fromDateFilter = String(appliedFilters.fromdate?.value ?? '').trim().toLowerCase();
    const toDateRange = normalizeDateRange(appliedFilters.todate?.value);
    return visibleRows.filter((row) => {
      const travel = String(row.travelid ?? '');
      const user = String(row.userid ?? '');
      const project = String(row.projectid ?? '');
      const rowDestination = String(row.destination ?? '');
      const rowFromDate = String(row.fromdate ?? '');
      const rowToDate = String(row.todate ?? '');
      const rowToDateMs = toDateMillis(rowToDate);
      if (travelFilter && !travel.toLowerCase().includes(travelFilter)) {
        return false;
      }
      if (userFilter && !user.toLowerCase().includes(userFilter)) {
        return false;
      }
      if (projectFilter && !project.toLowerCase().includes(projectFilter)) {
        return false;
      }
      if (destinationFilter && !rowDestination.toLowerCase().includes(destinationFilter)) {
        return false;
      }
      if (fromDateFilter && !rowFromDate.toLowerCase().includes(fromDateFilter)) {
        return false;
      }
      if (toDateRange.start !== null || toDateRange.end !== null) {
        if (rowToDateMs === null) {
          return false;
        }
        if (toDateRange.start !== null && rowToDateMs < toDateRange.start) {
          return false;
        }
        if (toDateRange.end !== null && rowToDateMs > toDateRange.end + DAY_MS - 1) {
          return false;
        }
      }
      return true;
    });
  }, [visibleRows, appliedFilters]);

  const exportRows = useMemo(() => {
    if (selected.length === 0) {
      return filteredRows;
    }
    const selectedSet = new Set(selected.map((item) => String(item)));
    return filteredRows.filter((row) => selectedSet.has(String(row.travelid ?? '')));
  }, [filteredRows, selected]);

  const exportAllowanceData = async () => {
    if (typeof window === 'undefined' || exportRows.length === 0) {
      return;
    }

    const { Workbook } = await import('exceljs');
    const workbook = new Workbook();
    workbook.creator = 'ORBIS TR';
    workbook.created = new Date();
    const projectDescriptionById = new Map(
      projects
        .map((project) => [
          String(project.projectid ?? '').trim(),
          String(project.description ?? '').trim(),
        ] as const)
        .filter(([id]) => id.length > 0),
    );
    const destinationClasses = await classifyDestinationsForAllowance(
      exportRows.map((row) => String(row.destination ?? '').trim()),
    );

    const details = exportRows.map((row) => {
      const nights = calculateTravelNights(row.fromdate, row.todate);
      const destination = String(row.destination ?? '').trim();
      const destinationClass =
        destinationClasses.get(destination) ??
        (isDomesticDestination(destination) ? 'domestic' : 'overseas');
      const isDomestic = destinationClass === 'domestic';
      const rate = isDomestic ? 180 : 300;
      const projectId = String(row.projectid ?? '').trim();
      return {
        userid: String(row.userid ?? ''),
        travelid: String(row.travelid ?? ''),
        description:
          String(row.description ?? row.project_description ?? '').trim() ||
          projectDescriptionById.get(projectId) ||
          '',
        destination,
        fromdate: formatDateYmd(row.fromdate),
        todate: formatDateYmd(row.todate),
        domesticNights: isDomestic ? nights : 0,
        overseasNights: isDomestic ? 0 : nights,
        allowanceAmount: nights * rate,
      };
    });

    const summaryByUser = new Map<string, { userid: string; amount: number }>();
    for (const row of details) {
      const current =
        summaryByUser.get(row.userid) ??
        { userid: row.userid, amount: 0 };
      current.amount += row.allowanceAmount;
      summaryByUser.set(row.userid, current);
    }

    const detailSheet = workbook.addWorksheet(t('travel_allowance_details', 'Allowance Details'));
    const detailColumns = [
      { key: 'userid', header: t('travel_export_person', '人'), width: 18 },
      { key: 'travelid', header: t('travel_id', 'Travel ID'), width: 18 },
      { key: 'description', header: t('travel_export_description', '描述'), width: 28 },
      { key: 'destination', header: t('travel_export_destination', '地点'), width: 22 },
      { key: 'fromdate', header: t('travel_export_from_date', '从哪天'), width: 14 },
      { key: 'todate', header: t('travel_export_to_date', '到哪天'), width: 14 },
      { key: 'domesticNights', header: t('domestic_nights', 'Domestic Nights'), width: 18 },
      { key: 'overseasNights', header: t('overseas_nights', 'Overseas Nights'), width: 18 },
      { key: 'allowanceAmount', header: t('allowance_amount', 'Allowance Amount'), width: 18 },
    ];
    detailSheet.columns = detailColumns;
    detailSheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    details.forEach((item, index) => {
      const excelRow = detailSheet.getRow(index + 2);
      excelRow.values = detailColumns.map((column) => item[column.key as keyof typeof item]);
      excelRow.getCell(7).numFmt = '0';
      excelRow.getCell(8).numFmt = '0';
      excelRow.getCell(9).numFmt = '#,##0.00';
    });
    detailSheet.views = [{ state: 'frozen', ySplit: 1 }];
    detailSheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: detailColumns.length },
    };

    const summarySheet = workbook.addWorksheet(t('travel_allowance_summary', 'Allowance Summary'));
    const summaryColumns = [
      { key: 'userid', header: t('travel_export_person', '人'), width: 18 },
      { key: 'amount', header: t('allowance_amount', 'Allowance Amount'), width: 18 },
    ];
    summarySheet.columns = summaryColumns;
    summarySheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F75B5' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    Array.from(summaryByUser.values())
      .sort((a, b) => a.userid.localeCompare(b.userid))
      .forEach((item, index) => {
        const excelRow = summarySheet.getRow(index + 2);
        excelRow.values = [item.userid, item.amount];
        excelRow.getCell(2).numFmt = '#,##0.00';
      });
    summarySheet.views = [{ state: 'frozen', ySplit: 1 }];
    summarySheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: summaryColumns.length },
    };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `travel-allowance-${toExportTimestamp(new Date())}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const columns = useMemo<any[]>(
    () => [
      { id: 'travelid', label: t('travel_id', 'Travel ID'), minWidth: 180 },
      { id: 'userid', label: t('user_id', 'User ID'), minWidth: 180 },
      { id: 'projectid', label: t('project_id', 'Project ID'), minWidth: 180 },
      { id: 'destination', label: t('destination', 'Destination'), minWidth: 180 },
      {
        id: 'fromdate',
        label: t('from_date', 'From Date'),
        minWidth: 140,
        render: (value: unknown) => formatDateYmd(value),
      },
      {
        id: 'todate',
        label: t('to_date', 'To Date'),
        minWidth: 140,
        render: (value: unknown) => formatDateYmd(value),
      },
    ],
    [t],
  );

  const userOptions = useMemo(
    () =>
      users
        .filter((user) => canViewAll || String(user.userid ?? '').trim().toLowerCase() === String(sessionUser?.userid ?? '').trim().toLowerCase())
        .map((user) => {
        const userid = String(user.userid ?? '');
        const fullname = [String(user.firstname ?? ''), String(user.lastname ?? '')]
          .join(' ')
          .trim();
        return {
          value: userid,
          label: fullname ? `${userid} - ${fullname}` : userid,
        };
      }),
    [canViewAll, sessionUser?.userid, users],
  );

  const projectOptions = useMemo(
    () =>
      projects.map((project) => ({
        value: String(project.projectid ?? ''),
        label: `${String(project.projectid ?? '')} - ${String(project.description ?? '').trim()}`,
      })),
    [projects],
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

  const createAction = (
    <Tooltip title={t('create_travel', 'Create Travel')}>
      <IconButton onClick={openCreateDialog} aria-label={t('create_travel', 'Create Travel')}>
        <AddRoundedIcon />
      </IconButton>
    </Tooltip>
  );

  const editAction = (
    <Tooltip title={selected.length === 1 ? t('edit_travel', 'Edit Travel') : t('please_select_one_travel_edit', 'Please select one travel entry to edit')}>
      <span>
        <IconButton onClick={openEditDialog} disabled={selected.length !== 1} aria-label={t('edit_travel', 'Edit Travel')}>
          <EditRoundedIcon />
        </IconButton>
      </span>
    </Tooltip>
  );

  const deleteAction = (
    <Tooltip title={selected.length > 0 ? t('delete_travel', 'Delete Travel') : t('please_select_travel_delete', 'Please select travel entries to delete')}>
      <span>
        <IconButton onClick={removeSelected} disabled={selected.length === 0} aria-label={t('delete_travel', 'Delete Travel')}>
          <DeleteRoundedIcon />
        </IconButton>
      </span>
    </Tooltip>
  );

  const exportAction = (
    <Tooltip title={exportRows.length > 0 ? t('export_travel_allowance', 'Export Travel Allowance') : t('no_data_to_export', 'No data to export')}>
      <span>
        <Button
          onClick={() => void exportAllowanceData()}
          disabled={exportRows.length === 0}
          startIcon={<FileDownloadRoundedIcon />}
          variant="outlined"
          size="small"
          aria-label={t('export_travel_allowance', 'Export Travel Allowance')}
          sx={{ whiteSpace: 'nowrap' }}
        >
          {t('export_allowance', 'Export Allowance')}
        </Button>
      </span>
    </Tooltip>
  );

  if (!sessionUser) {
    return null;
  }

  const tableBusy = loading || saving;

  return (
    <PcContentLayout
      contentSx={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      {error ? <Alert severity="error">{error}</Alert> : null}
      <BusyStandardPage
          busy={tableBusy}
          title={t('travel_entries', 'Travel Management')}
          hideHeader
          spacing={1}
          filterConfig={{
            appId: 'pc-travel-entries',
            tableKey: 'otto_travelentry',
            variantService,
            fields: filterFields,
            filters,
            onFilterChange: setFilters,
            onSearch: () => setAppliedFilters({ ...filters }),
            onVariantLoad: (v: any) => {
              const variant = v as VariantMetadata;
              const nextFilters =
                (resolveVariantFilters(variant, 'otto_travelentry') as Record<string, FilterValue> | null) ??
                (variant.filters as Record<string, FilterValue> | undefined) ??
                defaultFilters;
              setFilters(nextFilters);
              setAppliedFilters(nextFilters);
            },
          }}
          tableProps={{
            appId: 'pc-travel-entries',
            title: t('travel_entries', 'Travel Management'),
            columns,
            rows: filteredRows,
            rowKey: 'travelid',
            fitContainer: true,
            selectionMode: 'multiple',
            selected,
            onSelectionChange: (rowsSelected: unknown[]) => setSelected(rowsSelected.map((x) => String(x))),
            layout: layout ?? undefined,
            onLayoutSave: handleSaveLayout,
            actions: [createAction, editAction, deleteAction, exportAction],
          }}
        />

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('create_travel', 'Create Travel')}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField
              label={t('user_id', 'User ID')}
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              fullWidth
              select
              autoFocus={canViewAll}
              disabled={!canViewAll || userOptions.length === 0}
              helperText={userOptions.length === 0 ? t('no_users_available', 'No users available, please create a user first') : undefined}
            >
              {userOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={t('project_id', 'Project ID')}
              value={projectId}
              onChange={(e) => setProjectId(normalizeProjectIdInput(e.target.value))}
              fullWidth
              select
              disabled={projectOptions.length === 0}
              helperText={projectOptions.length === 0 ? t('no_projects_available', 'No projects available, please create a project first') : undefined}
            >
              {projectOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={t('destination', 'Destination')}
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('from_date', 'From Date')}
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label={t('to_date', 'To Date')}
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} disabled={saving}>
            {t('cancel', 'Cancel')}
          </Button>
          <Button onClick={saveCreate} variant="contained" disabled={saving}>
            {t('save', 'Save')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('edit_travel', 'Edit Travel')}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField label={t('travel_id', 'Travel ID')} value={travelId} fullWidth disabled />
            <TextField
              label={t('user_id', 'User ID')}
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              fullWidth
              select
              disabled={!canViewAll || userOptions.length === 0}
              helperText={userOptions.length === 0 ? t('no_users_available', 'No users available, please create a user first') : undefined}
            >
              {userOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={t('project_id', 'Project ID')}
              value={projectId}
              onChange={(e) => setProjectId(normalizeProjectIdInput(e.target.value))}
              fullWidth
              select
              disabled={projectOptions.length === 0}
              helperText={projectOptions.length === 0 ? t('no_projects_available', 'No projects available, please create a project first') : undefined}
            >
              {projectOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={t('destination', 'Destination')}
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('from_date', 'From Date')}
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label={t('to_date', 'To Date')}
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} disabled={saving}>
            {t('cancel', 'Cancel')}
          </Button>
          <Button onClick={saveEdit} variant="contained" disabled={saving}>
            {t('save', 'Save')}
          </Button>
        </DialogActions>
      </Dialog>
      {messageBox}
    </PcContentLayout>
  );
}
