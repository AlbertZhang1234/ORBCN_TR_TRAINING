'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  CircularProgress,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import { usePcI18n } from '../../app/pc/_components/PcI18nProvider';
import {
  listReimbursementLines,
  listReimbursements,
  type ReimbursementListRow,
} from '../../services/TravelReimbursement/list';
import { listInvoices, type InvoiceListRow } from '../../services/Invoice/list';
import { listProjects, type ProjectListRow } from '../../services/Projects/list';
import { listCustomers, type CustomerListRow } from '../../services/Customer/list';
import { normalizeLineAmount, type ReimbursementFilter } from '../../services/TravelReimbursement/_shared';
import { normalizeWorkflowStatus } from '../../services/_core/locks';
import type { SessionUser } from '../../app/pc/_components/session';
import { openReimbursementDetail } from '../../app/pc/reimbursements/helpers';
import MyReimbursementsCard from './cards/MyReimbursementsCard';
import MyInvoicesCard from './cards/MyInvoicesCard';
import MyInboxCard from './cards/MyInboxCard';
import YearInsightCoverCard from './cards/YearInsightCoverCard';

interface HomeDesktopCardsProps {
  sessionUser: SessionUser;
}

interface YearLineRecord {
  invoiceNo: string;
  amount: number;
  projectId: string;
}

interface InsightMetricEntry {
  key: string;
  label: string;
  amount: number;
  count: number;
  ratio: number;
}

interface YearInsight {
  totalAmount: number;
  invoiceCount: number;
  litCityCount: number;
  cityBreakdown: InsightMetricEntry[];
  customerBreakdown: InsightMetricEntry[];
  projectBreakdown: InsightMetricEntry[];
  categoryBreakdown: InsightMetricEntry[];
}

interface YearInsightSummaryPayload {
  year: number;
  totalAmount: number;
  reimbursementCount: number;
  invoiceCount: number;
  cities: Array<{ name: string; amount: number; ratio: number; count: number }>;
  customers: Array<{ name: string; amount: number; ratio: number; count: number }>;
  projects: Array<{ name: string; amount: number; ratio: number; count: number }>;
  categories: Array<{ name: string; amount: number; ratio: number; count: number }>;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return 0;
    }
    const normalized = trimmed.replace(/,/g, '');
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function readInvoiceAmount(row?: InvoiceListRow): number {
  if (!row) {
    return 0;
  }
  return toNumber(row.grossamount ?? row.totalnetamount ?? row.totalnetamour ?? row.taxamount ?? 0);
}

function readCreatedAt(row: ReimbursementListRow): string {
  return String(row.created_at ?? row.createdat ?? '').trim();
}

function readRowStatus(row: ReimbursementListRow): ReturnType<typeof normalizeWorkflowStatus> {
  const raw =
    row.approvalstatus ??
    row.approval_status ??
    row.bookingstatus ??
    row.booking_status ??
    row.status ??
    '';
  return normalizeWorkflowStatus(raw);
}

function parseMonthIndex(isoLike: string): number {
  const ts = Date.parse(isoLike);
  if (!Number.isFinite(ts)) {
    return -1;
  }
  return new Date(ts).getMonth();
}

function parseYear(isoLike: string): number {
  const ts = Date.parse(isoLike);
  if (!Number.isFinite(ts)) {
    return -1;
  }
  return new Date(ts).getFullYear();
}

function toYearMonth(isoLike: string): string {
  const ts = Date.parse(isoLike);
  if (!Number.isFinite(ts)) {
    return '';
  }
  const date = new Date(ts);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
}

function reimbursementToFilter(row: ReimbursementListRow): ReimbursementFilter | null {
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
  return null;
}

function rowKey(row: ReimbursementListRow): string {
  const id = String(row.id ?? '').trim();
  if (id) {
    return id;
  }
  return String(row.trno ?? '').trim();
}

function readApprover(row: ReimbursementListRow): string {
  return String(row.approver ?? row.approvalby ?? row.approvedby ?? '--').trim() || '--';
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

type KanbanStatus = 'waiting' | 'approved' | 'rejected';

function toKanbanStatus(status: ReturnType<typeof normalizeWorkflowStatus>): KanbanStatus {
  if (status === 'REJECTED') {
    return 'rejected';
  }
  if (status === 'APPROVED' || status === 'BOOKED' || status === 'SUBMITTED') {
    return 'approved';
  }
  return 'waiting';
}

function readInvoiceWorkflowStatus(row: InvoiceListRow): ReturnType<typeof normalizeWorkflowStatus> {
  const raw =
    row.bookingstatus ??
    row.booking_status ??
    row.financestatus ??
    row.finance_status ??
    row.status ??
    '';
  return normalizeWorkflowStatus(raw);
}

function invoiceCategory(row?: InvoiceListRow): 'taxi' | 'parking' | 'flight' | 'other' {
  if (!row) {
    return 'other';
  }

  const code = String(row.bookingcode ?? '').trim().toUpperCase();
  if (code.includes('TAXI')) {
    return 'taxi';
  }
  if (code.includes('PARK')) {
    return 'parking';
  }
  if (code.includes('FLUG') || code.includes('FLIGHT')) {
    return 'flight';
  }

  const text = `${row.description ?? ''} ${row.comment ?? ''} ${row.supplier ?? ''}`.toLowerCase();
  if (/taxi|didi|uber|网约车|出租车/.test(text)) {
    return 'taxi';
  }
  if (/停车|停车场|park/.test(text)) {
    return 'parking';
  }
  if (/flight|机票|航班|airline/.test(text)) {
    return 'flight';
  }

  return 'other';
}

function accumulateMetric(
  map: Map<string, { key: string; label: string; amount: number; count: number }>,
  key: string,
  label: string,
  amount: number,
): void {
  const safeKey = key || label;
  const current = map.get(safeKey);
  if (current) {
    current.amount += amount;
    current.count += 1;
    return;
  }
  map.set(safeKey, { key: safeKey, label, amount, count: 1 });
}

function toMetricEntries(
  map: Map<string, { key: string; label: string; amount: number; count: number }>,
  totalAmount: number,
): InsightMetricEntry[] {
  return Array.from(map.values())
    .sort((a, b) => b.amount - a.amount)
    .map((item) => ({
      ...item,
      ratio: totalAmount > 0 ? Math.max(0, item.amount / totalAmount) : 0,
    }));
}

function toPercentText(value: number): string {
  return `${(Math.max(0, value) * 100).toFixed(1)}%`;
}

function buildLocalPortraitSummary(
  insight: YearInsight,
  year: number,
  t: (key: string, fallback: string) => string,
): string {
  if (insight.totalAmount <= 0 || insight.invoiceCount <= 0) {
    return `${year}，我们刚刚出发。每一次提交都在积累你的闪光轨迹，继续加油。`;
  }

  const topCustomer = insight.customerBreakdown[0]?.label ?? t('unknown_customer', 'Unknown Customer');
  const topProject = insight.projectBreakdown[0]?.label ?? t('unknown_project', 'Unknown Project');
  const topCategory = insight.categoryBreakdown[0]?.label ?? t('transport_other', 'Other');
  const topCategoryShare = toPercentText(insight.categoryBreakdown[0]?.ratio ?? 0);

  return (
    `${year}累计${insight.invoiceCount}张发票、总额${money(insight.totalAmount)}。` +
    `你在客户「${topCustomer}」与项目「${topProject}」上持续发力，` +
    `${topCategory}占比${topCategoryShare}。继续发光。`
  );
}

function buildLocalEnergyTag(
  insight: YearInsight,
  reimbursementCount: number,
  t: (key: string, fallback: string) => string,
): string {
  if (insight.totalAmount <= 0) {
    return `#${t('energy_tag_ready', 'Ready To Shine').replace(/^#/, '')}`;
  }
  if (insight.litCityCount >= 4) {
    return `#${t('energy_tag_city', 'City Explorer').replace(/^#/, '')}`;
  }
  if (reimbursementCount >= 6) {
    return `#${t('energy_tag_rhythm', 'Execution Full Power').replace(/^#/, '')}`;
  }
  return `#${t('energy_tag_steady', 'Steady And Strong').replace(/^#/, '')}`;
}

function money(value: number): string {
  return `¥${value.toFixed(2)}`;
}

function readCustomerLabel(customer?: CustomerListRow): string {
  if (!customer) {
    return '';
  }
  const zh = String(customer.fullname_zh ?? '').trim();
  if (zh) {
    return zh;
  }
  const en = String(customer.fullname_en ?? '').trim();
  if (en) {
    return en;
  }
  const short = String(customer.customername ?? '').trim();
  if (short) {
    return short;
  }
  return String(customer.customerid ?? '').trim();
}

function parseCityFromAddress(value: string): string {
  const text = value.trim();
  if (!text) {
    return '';
  }
  const cityMatch = text.match(/([\u4e00-\u9fa5]{2,}(?:市|州|地区|盟|特别行政区))/);
  if (cityMatch?.[1]) {
    return cityMatch[1];
  }

  const namedCities = ['上海', '北京', '深圳', '广州', '杭州', '苏州', '南京', '成都', '武汉', '西安', '重庆', '天津'];
  const hit = namedCities.find((city) => text.includes(city));
  if (hit) {
    return hit.endsWith('市') ? hit : `${hit}市`;
  }

  const parts = text.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return parts[parts.length - 2];
  }
  return '';
}

export default function HomeDesktopCards({ sessionUser }: HomeDesktopCardsProps) {
  const router = useRouter();
  const { t } = usePcI18n();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const currentYear = new Date().getFullYear();

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [reimbursements, setReimbursements] = useState<ReimbursementListRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceListRow[]>([]);
  const [projects, setProjects] = useState<ProjectListRow[]>([]);
  const [customers, setCustomers] = useState<CustomerListRow[]>([]);
  const [yearLines, setYearLines] = useState<YearLineRecord[]>([]);
  const [reimbursementTotals, setReimbursementTotals] = useState<Record<string, number>>({});
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [aiSummary, setAiSummary] = useState('');
  const [aiTag, setAiTag] = useState('#继续前进');
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiLoadedSignature, setAiLoadedSignature] = useState('');

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setLoadError('');

      try {
        const [reimbursementRows, invoiceRows, projectRows, customerRows] = await Promise.all([
          listReimbursements(),
          listInvoices(),
          listProjects(),
          listCustomers().catch(() => []),
        ]);
        if (!active) {
          return;
        }

        setReimbursements(reimbursementRows);
        setInvoices(invoiceRows);
        setProjects(projectRows);
        setCustomers(customerRows);

        const invoiceMap = new Map(
          invoiceRows
            .map((row) => [String(row.invoiceno ?? '').trim(), row] as const)
            .filter(([invoiceNo]) => invoiceNo.length > 0),
        );

        const myRows = reimbursementRows.filter((row) => {
          return String(row.userid ?? '').trim() === sessionUser.userid;
        });

        const totals: Record<string, number> = {};
        const lineRows = await Promise.all(
          myRows.map(async (row) => {
            const filter = reimbursementToFilter(row);
            if (!filter) {
              return { key: rowKey(row), createdAt: readCreatedAt(row), lines: [] as YearLineRecord[] };
            }

            try {
              const lines = await listReimbursementLines(filter);
              const normalizedLines = lines
                .map((line) => {
                  const invoiceNo = String(line.invoiceno ?? '').trim();
                  if (!invoiceNo) {
                    return null;
                  }
                  const trAmount = toNumber(normalizeLineAmount(line.tr_amount) ?? '');
                  const fallbackAmount = readInvoiceAmount(invoiceMap.get(invoiceNo));
                  return {
                    invoiceNo,
                    amount: trAmount > 0 ? trAmount : fallbackAmount,
                    projectId: String(row.projectid ?? '').trim(),
                  } as YearLineRecord;
                })
                .filter((line): line is YearLineRecord => Boolean(line));
              totals[rowKey(row)] = normalizedLines.reduce((sum, line) => sum + line.amount, 0);
              return { key: rowKey(row), createdAt: readCreatedAt(row), lines: normalizedLines };
            } catch {
              totals[rowKey(row)] = 0;
              return { key: rowKey(row), createdAt: readCreatedAt(row), lines: [] as YearLineRecord[] };
            }
          }),
        );

        if (!active) {
          return;
        }

        const yearLineRecords = lineRows
          .filter((entry) => parseYear(entry.createdAt) === currentYear)
          .flatMap((entry) => entry.lines);
        setYearLines(yearLineRecords);
        setReimbursementTotals(totals);
      } catch (err) {
        if (!active) {
          return;
        }
        setLoadError(err instanceof Error ? err.message : t('home_load_failed', 'Failed to load home card data'));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [currentYear, sessionUser.userid]);

  const myReimbursements = useMemo(
    () =>
      reimbursements.filter((row) => {
        return String(row.userid ?? '').trim() === sessionUser.userid;
      }),
    [reimbursements, sessionUser.userid],
  );

  const yearReimbursementCount = useMemo(
    () => myReimbursements.filter((row) => parseYear(readCreatedAt(row)) === currentYear).length,
    [currentYear, myReimbursements],
  );

  const myReimbursementsSorted = useMemo(() => {
    return [...myReimbursements].sort((a, b) => {
      const dateDiff = Date.parse(readCreatedAt(b)) - Date.parse(readCreatedAt(a));
      if (Number.isFinite(dateDiff) && dateDiff !== 0) {
        return dateDiff;
      }
      return toNumber(b.id ?? 0) - toNumber(a.id ?? 0);
    });
  }, [myReimbursements]);

  const reimbursementMonthOptions = useMemo(() => {
    const unique = new Set<string>();
    for (const row of myReimbursements) {
      const monthKey = toYearMonth(readCreatedAt(row));
      if (monthKey) {
        unique.add(monthKey);
      }
    }
    return Array.from(unique).sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
  }, [myReimbursements]);

  useEffect(() => {
    if (reimbursementMonthOptions.length === 0) {
      setSelectedMonths([]);
      return;
    }

    setSelectedMonths((prev) => {
      if (prev.length === 0) {
        return reimbursementMonthOptions;
      }
      const retained = prev.filter((month) => reimbursementMonthOptions.includes(month));
      if (retained.length === 0) {
        return reimbursementMonthOptions;
      }
      return retained;
    });
  }, [reimbursementMonthOptions]);

  const filteredReimbursements = useMemo(() => {
    if (selectedMonths.length === 0) {
      return [];
    }
    const selected = new Set(selectedMonths);
    return myReimbursementsSorted.filter((row) => selected.has(toYearMonth(readCreatedAt(row))));
  }, [myReimbursementsSorted, selectedMonths]);

  const kanbanBuckets = useMemo(() => {
    const waiting: ReimbursementListRow[] = [];
    const approved: ReimbursementListRow[] = [];
    const rejected: ReimbursementListRow[] = [];

    for (const row of filteredReimbursements) {
      const bucket = toKanbanStatus(readRowStatus(row));
      if (bucket === 'approved') {
        approved.push(row);
      } else if (bucket === 'rejected') {
        rejected.push(row);
      } else {
        waiting.push(row);
      }
    }

    return { waiting, approved, rejected };
  }, [filteredReimbursements]);

  const customerLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const customer of customers) {
      const customerId = String(customer.customerid ?? '').trim();
      if (!customerId) {
        continue;
      }
      const label = readCustomerLabel(customer);
      map.set(customerId, label || customerId);
    }
    return map;
  }, [customers]);

  const customerCityById = useMemo(() => {
    const map = new Map<string, string>();
    for (const customer of customers) {
      const customerId = String(customer.customerid ?? '').trim();
      if (!customerId) {
        continue;
      }
      const city = parseCityFromAddress(String(customer.address ?? ''));
      if (city) {
        map.set(customerId, city);
      }
    }
    return map;
  }, [customers]);

  const projectMetaById = useMemo(() => {
    const map = new Map<string, { projectLabel: string; customerId: string; customerLabel: string; customerCity: string }>();
    for (const project of projects) {
      const projectId = String(project.projectid ?? '').trim();
      if (!projectId) {
        continue;
      }
      const desc = String(project.description ?? '').trim();
      const projectLabel = desc ? `${projectId} + ${desc}` : projectId;
      const customerId = String(project.customerid ?? '').trim();
      const fallbackCustomer = String(project.customer ?? '').trim();
      const customerLabel = customerLabelById.get(customerId) ?? fallbackCustomer ?? customerId;
      const customerCity = customerCityById.get(customerId) ?? '';
      map.set(projectId, { projectLabel, customerId, customerLabel, customerCity });
    }
    return map;
  }, [projects, customerCityById, customerLabelById]);

  const projectLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const [projectId, meta] of projectMetaById.entries()) {
      map.set(projectId, meta.projectLabel);
    }
    return map;
  }, [projectMetaById]);

  const ALL_MONTHS_VALUE = '__ALL_MONTHS__';
  const allMonthsSelected =
    reimbursementMonthOptions.length > 0 && selectedMonths.length === reimbursementMonthOptions.length;
  const partiallySelected = selectedMonths.length > 0 && !allMonthsSelected;

  const handleMonthChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    const next = typeof value === 'string' ? value.split(',') : value;
    if (next.includes(ALL_MONTHS_VALUE)) {
      setSelectedMonths(allMonthsSelected ? [] : reimbursementMonthOptions);
      return;
    }
    setSelectedMonths(next);
  };

  const openReimbursementCardDetail = (row: ReimbursementListRow) => {
    openReimbursementDetail(row, router, {
      invalidMessage: t('invalid_reimbursement', 'Invalid reimbursement record'),
      onInvalid: setLoadError,
    });
  };

  const myInvoices = useMemo(
    () => invoices.filter((row) => String(row.userid ?? '').trim() === sessionUser.userid),
    [invoices, sessionUser.userid],
  );

  const invoiceStats = useMemo(() => {
    const currentMonth = new Date().getMonth();
    let open = 0;
    let submitted = 0;
    let booked = 0;
    let thisMonth = 0;

    for (const row of myInvoices) {
      const status = readInvoiceWorkflowStatus(row);
      if (status === 'SUBMITTED') {
        submitted += 1;
      } else if (status === 'BOOKED') {
        booked += 1;
      } else {
        open += 1;
      }

      const month = parseMonthIndex(String(row.invoicedate ?? '').trim());
      if (month === currentMonth) {
        thisMonth += 1;
      }
    }

    return { open, submitted, booked, thisMonth };
  }, [myInvoices]);

  const myInbox = useMemo(() => {
    const approvals = reimbursements
      .filter((row) => String(row.approver ?? row.approvalby ?? row.approvedby ?? '').trim() === sessionUser.userid)
      .filter((row) => readRowStatus(row) === 'WAIT FOR APPROVAL')
      .sort((a, b) => Date.parse(readCreatedAt(b)) - Date.parse(readCreatedAt(a)))
      .slice(0, 3);

    const feedback = myReimbursementsSorted
      .filter((row) => {
        const status = readRowStatus(row);
        return status === 'APPROVED' || status === 'BOOKED' || status === 'REJECTED';
      })
      .slice(0, 3);

    return { approvals, feedback };
  }, [myReimbursementsSorted, reimbursements, sessionUser.userid]);

  const yearInsight = useMemo<YearInsight>(() => {
    const invoiceMap = new Map(
      invoices
        .map((row) => [String(row.invoiceno ?? '').trim(), row] as const)
        .filter(([invoiceNo]) => invoiceNo.length > 0),
    );

    const categoryLabelMap: Record<'taxi' | 'parking' | 'flight' | 'other', string> = {
      taxi: t('transport_taxi', 'Taxi'),
      parking: t('transport_parking', 'Parking'),
      flight: t('transport_flight', 'Flight'),
      other: t('transport_other', 'Other'),
    };

    let totalAmount = 0;
    const cityMap = new Map<string, { key: string; label: string; amount: number; count: number }>();
    const customerMap = new Map<string, { key: string; label: string; amount: number; count: number }>();
    const projectMap = new Map<string, { key: string; label: string; amount: number; count: number }>();
    const categoryMap = new Map<string, { key: string; label: string; amount: number; count: number }>();

    for (const line of yearLines) {
      const amount = line.amount;
      totalAmount += amount;

      const projectId = line.projectId;
      const projectMeta = projectMetaById.get(projectId);
      const projectLabel = projectMeta?.projectLabel || projectId || t('unknown_project', 'Unknown Project');
      const customerId = projectMeta?.customerId || '';
      const customerLabel = projectMeta?.customerLabel || t('unknown_customer', 'Unknown Customer');
      const customerKey = customerId || customerLabel;
      const customerCity = projectMeta?.customerCity || t('unknown_city', 'Unknown City');

      accumulateMetric(projectMap, projectId || projectLabel, projectLabel, amount);
      accumulateMetric(customerMap, customerKey, customerLabel, amount);
      accumulateMetric(cityMap, customerCity, customerCity, amount);

      const invoice = invoiceMap.get(line.invoiceNo);
      const category = invoiceCategory(invoice);
      const categoryLabel = categoryLabelMap[category];
      accumulateMetric(categoryMap, category, categoryLabel, amount);
    }

    return {
      totalAmount,
      invoiceCount: yearLines.length,
      litCityCount: Array.from(cityMap.values()).filter((item) => item.label !== t('unknown_city', 'Unknown City')).length,
      cityBreakdown: toMetricEntries(cityMap, totalAmount),
      customerBreakdown: toMetricEntries(customerMap, totalAmount),
      projectBreakdown: toMetricEntries(projectMap, totalAmount),
      categoryBreakdown: toMetricEntries(categoryMap, totalAmount),
    };
  }, [invoices, projectMetaById, t, yearLines]);

  const yearInsightPayload = useMemo<YearInsightSummaryPayload>(() => {
    const toPayloadRows = (rows: InsightMetricEntry[]) =>
      rows.slice(0, 6).map((item) => ({
        name: item.label,
        amount: Number(item.amount.toFixed(2)),
        ratio: Number((item.ratio * 100).toFixed(1)),
        count: item.count,
      }));

    return {
      year: currentYear,
      totalAmount: Number(yearInsight.totalAmount.toFixed(2)),
      reimbursementCount: yearReimbursementCount,
      invoiceCount: yearInsight.invoiceCount,
      cities: toPayloadRows(yearInsight.cityBreakdown),
      customers: toPayloadRows(yearInsight.customerBreakdown),
      projects: toPayloadRows(yearInsight.projectBreakdown),
      categories: toPayloadRows(yearInsight.categoryBreakdown),
    };
  }, [currentYear, yearInsight, yearReimbursementCount]);

  const yearInsightSignature = useMemo(() => JSON.stringify(yearInsightPayload), [yearInsightPayload]);

  useEffect(() => {
    if (yearInsight.totalAmount <= 0 || yearInsight.invoiceCount <= 0) {
      setAiSummary(buildLocalPortraitSummary(yearInsight, currentYear, t));
      setAiTag(buildLocalEnergyTag(yearInsight, yearReimbursementCount, t));
      setAiSummaryLoading(false);
      setAiLoadedSignature(`no-data-${currentYear}`);
      return;
    }

    if (aiLoadedSignature === yearInsightSignature && aiSummary.trim()) {
      return;
    }

    let active = true;
    const controller = new AbortController();

    const loadAiSummary = async () => {
      setAiSummaryLoading(true);

      try {
        const response = await fetch('/api/home/year-insight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(yearInsightPayload),
          signal: controller.signal,
        });
        const payload = (await response.json()) as {
          summary?: string;
          tag?: string;
          message?: string;
        };

        if (!response.ok) {
          throw new Error(payload?.message || 'Failed to generate annual summary');
        }

        if (!active) {
          return;
        }

        const nextSummary = String(payload.summary ?? '').trim() || buildLocalPortraitSummary(yearInsight, currentYear, t);
        const nextTagRaw = String(payload.tag ?? '').trim().replace(/^#+/, '');
        const nextTag = nextTagRaw ? `#${nextTagRaw}` : buildLocalEnergyTag(yearInsight, yearReimbursementCount, t);
        setAiSummary(nextSummary);
        setAiTag(nextTag);
        setAiLoadedSignature(yearInsightSignature);
      } catch {
        if (!active || controller.signal.aborted) {
          return;
        }
        setAiSummary(buildLocalPortraitSummary(yearInsight, currentYear, t));
        setAiTag(buildLocalEnergyTag(yearInsight, yearReimbursementCount, t));
        setAiLoadedSignature(yearInsightSignature);
      } finally {
        if (active) {
          setAiSummaryLoading(false);
        }
      }
    };

    void loadAiSummary();

    return () => {
      active = false;
      controller.abort();
    };
  }, [
    aiLoadedSignature,
    aiSummary,
    currentYear,
    t,
    yearReimbursementCount,
    yearInsight,
    yearInsightPayload,
    yearInsightSignature,
  ]);

  return (
    <Box sx={{ width: '100%', height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {loadError ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {loadError}
        </Alert>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
          gridTemplateRows: { xs: 'auto', lg: 'repeat(2, minmax(0, 1fr))' },
          gap: 2.2,
          flex: 1,
          minHeight: { xs: 'auto', lg: 0 },
          height: { xs: 'auto', lg: '100%' },
          alignContent: 'stretch',
          alignItems: 'stretch',
        }}
      >
        <MyReimbursementsCard
          t={t}
          isDark={isDark}
          selectedMonths={selectedMonths}
          reimbursementMonthOptions={reimbursementMonthOptions}
          allMonthsSelected={allMonthsSelected}
          partiallySelected={partiallySelected}
          allMonthsValue={ALL_MONTHS_VALUE}
          handleMonthChange={handleMonthChange}
          kanbanBuckets={kanbanBuckets}
          rowKey={rowKey}
          projectLabelById={projectLabelById}
          readApprover={readApprover}
          reimbursementTotals={reimbursementTotals}
          openReimbursementCardDetail={openReimbursementCardDetail}
          myReimbursementsCount={myReimbursementsSorted.length}
          onTitleClick={() => router.push('/pc/reimbursements')}
          formatMoney={money}
        />

        <MyInvoicesCard
          t={t}
          isDark={isDark}
          invoiceStats={invoiceStats}
          myInvoicesLength={myInvoices.length}
          onTitleClick={() => router.push('/pc/invoices')}
          onQuickUpload={() => router.push('/pc/invoices?quickUpload=1')}
        />

        <MyInboxCard
          t={t}
          isDark={isDark}
          myInbox={myInbox}
          rowKey={rowKey}
          getStatusLabel={(row) => statusLabel(readRowStatus(row), t)}
          onTitleClick={() => {
            if (sessionUser.permissions?.isAdmin || sessionUser.permissions?.isProjectManager) {
              router.push('/pc/approve');
              return;
            }
            router.push('/pc/reimbursements');
          }}
        />

        <YearInsightCoverCard
          t={t}
          isDark={isDark}
          currentYear={currentYear}
          totalAmount={yearInsight.totalAmount}
          reimbursementCount={yearReimbursementCount}
          invoiceCount={yearInsight.invoiceCount}
          litCityCount={yearInsight.litCityCount}
          projectBreakdown={yearInsight.projectBreakdown}
          categoryBreakdown={yearInsight.categoryBreakdown}
          aiSummary={aiSummary || buildLocalPortraitSummary(yearInsight, currentYear, t)}
          aiTag={aiTag || buildLocalEnergyTag(yearInsight, yearReimbursementCount, t)}
          aiSummaryLoading={aiSummaryLoading}
        />
      </Box>

      {loading ? (
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ mt: 2 }}>
          <CircularProgress size={18} />
          <Typography sx={{ fontSize: 13, opacity: 0.76 }}>{t('loading_home_data', 'Loading home data...')}</Typography>
        </Stack>
      ) : null}

    </Box>
  );
}
