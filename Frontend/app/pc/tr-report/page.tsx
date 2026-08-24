'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, CircularProgress } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  CAppPageLayout,
  CPivotTable,
  type PivotChartConfig,
  type PivotFieldDefinition,
  type PivotLayoutConfig,
  type PivotTablePreset,
  usePivotTable,
} from 'orbcafe-ui';
import { useRouter } from 'next/navigation';
import { usePcI18n } from '../_components/PcI18nProvider';
import { getSessionUser, type SessionUser } from '../_components/session';
import { buildPcMenuData, HeaderLogo } from '../_components/nav';
import { performClientLogout } from '../../../services/Auth/logoutClient';
import { listTravelReportRows, type TravelReportRow } from '../../../services/TravelReport/list';
import type { TrReportAiPlan, TrReportAiStage } from '../../../services/TravelReport/pivotAi';

const PRESET_STORAGE_KEY = 'pc_tr_report_pivot_presets_v1';
const AI_WORKFLOW_STAGES: TrReportAiStage[] = ['question_understanding', 'tool_analysis', 'tool_execution'];

type StageState = 'pending' | 'active' | 'done';

interface QueryStreamStatusEvent {
  type: 'status';
  stage: TrReportAiStage;
}

interface QueryStreamResultEvent {
  type: 'result';
  summary?: string;
  plan?: TrReportAiPlan;
}

interface QueryStreamErrorEvent {
  type: 'error';
  message?: string;
}

interface QueryStreamMessageDeltaEvent {
  type: 'message_delta';
  delta?: string;
}

type QueryStreamEvent =
  | QueryStreamStatusEvent
  | QueryStreamResultEvent
  | QueryStreamErrorEvent
  | QueryStreamMessageDeltaEvent
  | { type: 'message_start'; id?: string };

function toDateParts(value: string): { year: string; month: string; day: string } {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return { year: '', month: '', day: '' };
  }

  const normalized = raw.replace(/\//g, '-');
  const directMatch = normalized.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (directMatch) {
    const year = directMatch[1];
    const month = directMatch[2].padStart(2, '0');
    const day = directMatch[3].padStart(2, '0');
    return {
      year,
      month: `${year}-${month}`,
      day: `${year}-${month}-${day}`,
    };
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return { year: '', month: '', day: '' };
  }
  const year = String(parsed.getFullYear());
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return {
    year,
    month: `${year}-${month}`,
    day: `${year}-${month}-${day}`,
  };
}

function createStageMap(): Record<TrReportAiStage, StageState> {
  return {
    question_understanding: 'pending',
    tool_analysis: 'pending',
    tool_execution: 'pending',
  };
}

function createDoneStageMap(): Record<TrReportAiStage, StageState> {
  return {
    question_understanding: 'done',
    tool_analysis: 'done',
    tool_execution: 'done',
  };
}

function isTimeDimensionField(fieldId: string): boolean {
  return /(^|_)(year|month|day)$/.test(fieldId) || fieldId.includes('date');
}

function buildChartConfig(layout: {
  rows?: string[];
  columns?: string[];
  values?: Array<{ fieldId: string }>;
}): PivotChartConfig {
  const dimensionFieldId = layout.rows?.[0] || layout.columns?.[0] || '';
  const primaryValueFieldId = layout.values?.[0]?.fieldId ?? '';
  const secondaryValueFieldId = layout.values?.[1]?.fieldId ?? '';

  return {
    dimensionFieldId,
    primaryValueFieldId,
    secondaryValueFieldId,
    chartType: isTimeDimensionField(dimensionFieldId) ? 'line' : 'bar-vertical',
  };
}

export default function TRReportPage() {
  const theme = useTheme();
  const router = useRouter();
  const { t, lang, changeLanguage } = usePcI18n();
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [rows, setRows] = useState<TravelReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [presets, setPresets] = useState<PivotTablePreset[] | undefined>(undefined);
  const [aiError, setAiError] = useState('');
  const [aiRunning, setAiRunning] = useState(false);
  const [aiStageProgress, setAiStageProgress] = useState<Record<TrReportAiStage, StageState>>(createStageMap());
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const user = getSessionUser();
    if (!user) {
      router.replace('/pc/login');
      return;
    }
    setSessionUser(user);
  }, [router]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const hasAccess = Boolean(sessionUser?.userid);

  const load = async () => {
    if (!sessionUser?.userid) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await listTravelReportRows(sessionUser.userid);
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('tr_report_failed_load', 'Failed to load report data'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionUser?.userid) {
      return;
    }
    void load();
  }, [sessionUser?.userid]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const raw = window.localStorage.getItem(PRESET_STORAGE_KEY);
      if (raw) {
        setPresets(JSON.parse(raw) as PivotTablePreset[]);
      }
    } catch {
      setPresets(undefined);
    }
  }, []);

  const handlePresetsChange = (nextPresets: PivotTablePreset[]) => {
    setPresets(nextPresets);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(nextPresets));
    }
  };

  const moneyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(lang === 'zh' ? 'zh-CN' : 'en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [lang],
  );

  const pivotRows = useMemo(
    () =>
      rows.map((row) => {
        const created = toDateParts(row.tr_created_at);
        const invoice = toDateParts(row.invoicedate);
        const travelFrom = toDateParts(row.travel_fromdate);
        const travelTo = toDateParts(row.travel_todate);
        return {
          ...row,
          tr_created_date: created.day,
          tr_created_year: created.year,
          tr_created_month: created.month,
          tr_created_day: created.day,
          invoicedate: invoice.day,
          invoicedate_year: invoice.year,
          invoicedate_month: invoice.month,
          invoicedate_day: invoice.day,
          travel_fromdate: travelFrom.day,
          travel_from_year: travelFrom.year,
          travel_from_month: travelFrom.month,
          travel_from_day: travelFrom.day,
          travel_todate: travelTo.day,
          travel_to_year: travelTo.year,
          travel_to_month: travelTo.month,
          travel_to_day: travelTo.day,
        };
      }),
    [rows],
  );

  const fields = useMemo<PivotFieldDefinition[]>(
    () => [
      { id: 'tr_id', label: t('reimbursement_id', 'Reimbursement ID'), type: 'number' },
      { id: 'trno', label: t('reimbursement_id', 'Reimbursement ID') },
      { id: 'tr_created_date', label: t('created_at', 'Created At'), type: 'date' },
      { id: 'tr_created_year', label: t('created_at', 'Created At') + ' ' + t('year', 'Year') },
      { id: 'tr_created_month', label: t('created_at', 'Created At') + ' ' + t('month', 'Month') },
      { id: 'tr_created_day', label: t('created_at', 'Created At') + ' ' + t('day', 'Day') },
      { id: 'tr_userid', label: t('applicant', 'Applicant') },
      { id: 'tr_user_name', label: t('applicant', 'Applicant') + ' Name' },
      { id: 'tr_projectid', label: t('project_id', 'Project ID') },
      { id: 'project_description', label: t('description', 'Description') },
      { id: 'customerid', label: t('customer_id', 'Customer ID') },
      { id: 'customername', label: t('customer_name', 'Customer Name') },
      { id: 'project_manager_userid', label: t('project_manager', 'Project Manager') + ' ID' },
      { id: 'project_manager_name', label: t('project_manager', 'Project Manager') + ' Name' },
      { id: 'approvalstatus', label: t('approval_status', 'Approval Status') },
      { id: 'bookingstatus', label: t('booking_status', 'Booking Status') },
      { id: 'approver_userid', label: t('approver', 'Approver') + ' ID' },
      { id: 'approver_name', label: t('approver', 'Approver') + ' Name' },
      { id: 'invoiceno', label: t('invoice_no', 'Invoice No') },
      { id: 'invoice_userid', label: t('user_id', 'User ID') + ' (Invoice)' },
      { id: 'invoice_user_name', label: t('user_id', 'User ID') + ' Name (Invoice)' },
      { id: 'travelid', label: t('travel_id', 'Travel ID') },
      { id: 'travel_destination', label: t('destination', 'Destination') },
      { id: 'travel_fromdate', label: t('from_date', 'From Date'), type: 'date' },
      { id: 'travel_from_year', label: t('from_date', 'From Date') + ' ' + t('year', 'Year') },
      { id: 'travel_from_month', label: t('from_date', 'From Date') + ' ' + t('month', 'Month') },
      { id: 'travel_from_day', label: t('from_date', 'From Date') + ' ' + t('day', 'Day') },
      { id: 'travel_todate', label: t('to_date', 'To Date'), type: 'date' },
      { id: 'travel_to_year', label: t('to_date', 'To Date') + ' ' + t('year', 'Year') },
      { id: 'travel_to_month', label: t('to_date', 'To Date') + ' ' + t('month', 'Month') },
      { id: 'travel_to_day', label: t('to_date', 'To Date') + ' ' + t('day', 'Day') },
      { id: 'invoicedate', label: t('invoice_date', 'Invoice Date'), type: 'date' },
      { id: 'invoicedate_year', label: t('invoice_date', 'Invoice Date') + ' ' + t('year', 'Year') },
      { id: 'invoicedate_month', label: t('invoice_date', 'Invoice Date') + ' ' + t('month', 'Month') },
      { id: 'invoicedate_day', label: t('invoice_date', 'Invoice Date') + ' ' + t('day', 'Day') },
      { id: 'bookingcode', label: t('booking_rule', 'Booking Rule') },
      { id: 'currency', label: t('currency', 'Currency') },
      { id: 'invoice_status', label: t('status', 'Status') + ' (Invoice)' },
      { id: 'invoice_supplier', label: t('supplier', 'Supplier') },
      { id: 'invoice_description', label: t('description', 'Description') + ' (Invoice)' },
      { id: 'invoice_comment', label: t('comment', 'Comment') + ' (Invoice)' },
      { id: 'line_trchargeable', label: t('tr_chargeable', 'TR Chargeable'), type: 'boolean' },
      { id: 'line_txchargeable', label: t('tx_chargeable', 'TX Chargeable'), type: 'boolean' },
      {
        id: 'tr_amount',
        label: t('reimbursement_amount', 'Reimbursement Amount'),
        type: 'number',
        formatValue: (value) => moneyFormatter.format(value),
      },
      {
        id: 'totalnetamount',
        label: t('net_amount', 'Net Amount'),
        type: 'number',
        formatValue: (value) => moneyFormatter.format(value),
      },
      {
        id: 'taxamount',
        label: t('tax_amount', 'Tax Amount'),
        type: 'number',
        formatValue: (value) => moneyFormatter.format(value),
      },
      {
        id: 'grossamount',
        label: t('gross_amount', 'Gross Amount'),
        type: 'number',
        formatValue: (value) => moneyFormatter.format(value),
      },
    ],
    [moneyFormatter, t],
  );

  const defaultPresets = useMemo<PivotTablePreset[]>(
    () => [
      {
        id: 'project_bookingcode',
        name: t('tr_report_menu', 'Reimbursement Report') + ' - Project x Booking Code',
        layout: {
          rows: ['tr_projectid', 'project_description', 'bookingcode'],
          columns: ['approvalstatus'],
          values: [{ fieldId: 'grossamount', aggregation: 'sum' }],
          filters: ['bookingstatus', 'currency'],
        },
        showGrandTotal: true,
        chart: {
          dimensionFieldId: 'tr_projectid',
          primaryValueFieldId: 'grossamount',
          secondaryValueFieldId: '',
          chartType: 'bar-vertical',
        },
      },
      {
        id: 'applicant_month',
        name: t('tr_report_menu', 'Reimbursement Report') + ' - Applicant x Month',
        layout: {
          rows: ['tr_userid', 'tr_user_name', 'tr_created_month'],
          columns: ['bookingstatus'],
          values: [{ fieldId: 'tr_amount', aggregation: 'sum' }],
          filters: ['approvalstatus', 'currency'],
        },
        showGrandTotal: true,
        chart: {
          dimensionFieldId: 'tr_created_month',
          primaryValueFieldId: 'tr_amount',
          secondaryValueFieldId: '',
          chartType: 'line',
        },
      },
    ],
    [t],
  );

  const initialLayout = useMemo<PivotLayoutConfig>(
    () => ({
      rows: ['tr_projectid', 'project_description'],
      columns: ['approvalstatus'],
      values: [{ fieldId: 'grossamount', aggregation: 'sum' }],
      filters: ['bookingstatus', 'currency'],
    }),
    [],
  );

  const initialChart = useMemo(() => buildChartConfig(initialLayout), [initialLayout]);

  const { model: pivotModel, actions: pivotActions } = usePivotTable({
    fields,
    initialLayout,
    initialShowGrandTotal: true,
    initialChart,
    initialChartCollapsed: false,
    initialTableCollapsed: false,
  });

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

  const stageLabels = useMemo<Record<TrReportAiStage, string>>(
    () =>
      lang === 'en'
        ? {
            question_understanding: 'Understand',
            tool_analysis: 'Plan',
            tool_execution: 'Apply',
          }
        : {
            question_understanding: '理解问题',
            tool_analysis: '分析工具',
            tool_execution: '执行配置',
          },
    [lang],
  );

  const isDark = theme.palette.mode === 'dark';

  const handleApplyAiPlan = (plan: TrReportAiPlan) => {
    pivotActions.setLayout({
      rows: plan.rows,
      columns: plan.columns,
      filters: plan.filters,
      values: plan.values,
    });
    const nextChart = buildChartConfig(plan);
    pivotActions.setChartDimension(nextChart.dimensionFieldId ?? '');
    pivotActions.setChartPrimaryValue(nextChart.primaryValueFieldId ?? '');
    pivotActions.setChartSecondaryValue(nextChart.secondaryValueFieldId ?? '');
    pivotActions.setChartType(nextChart.chartType ?? 'bar-vertical');
    pivotModel.setFilterSelections(plan.filterSelections);
    pivotModel.setShowGrandTotal(plan.showGrandTotal);
  };

  const submitAiQuery = async (value: string) => {
    const text = String(value ?? '').trim();
    const sessionId = String(sessionUser?.session_id ?? '').trim();
    if (!text || !sessionId) {
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const workflowStages = createStageMap();
    workflowStages.question_understanding = 'active';
    setAiError('');
    setAiRunning(true);
    setAiStageProgress({ ...workflowStages });

    const applyStage = (stage: TrReportAiStage) => {
      const currentIndex = AI_WORKFLOW_STAGES.indexOf(stage);
      for (const [index, workflowStage] of AI_WORKFLOW_STAGES.entries()) {
        if (index < currentIndex) {
          workflowStages[workflowStage] = 'done';
        } else if (index === currentIndex) {
          workflowStages[workflowStage] = 'active';
        } else if (workflowStages[workflowStage] !== 'done') {
          workflowStages[workflowStage] = 'pending';
        }
      }
      setAiStageProgress({ ...workflowStages });
    };

    try {
      const response = await fetch('/api/tr-report/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId,
        },
        body: JSON.stringify({ question: text, stream: true }),
        signal: controller.signal,
      });

      const contentType = String(response.headers.get('content-type') ?? '').toLowerCase();
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(String(payload.message ?? '').trim() || `Request failed (${response.status})`);
      }

      if (!response.body || !contentType.includes('application/x-ndjson')) {
        const payload = (await response.json().catch(() => ({}))) as { plan?: TrReportAiPlan; summary?: string };
        if (payload.plan) {
          handleApplyAiPlan(payload.plan);
        }
        setAiStageProgress(createDoneStageMap());
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const handleEvent = (event: QueryStreamEvent) => {
        if (event.type === 'status') {
          applyStage(event.stage);
          return;
        }
        if (event.type === 'result') {
          if (event.plan) {
            handleApplyAiPlan(event.plan);
          }
          setAiStageProgress(createDoneStageMap());
          return;
        }
        if (event.type === 'error') {
          throw new Error(String(event.message ?? '').trim() || 'TR report AI request failed');
        }
      };

      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) {
            continue;
          }
          handleEvent(JSON.parse(line) as QueryStreamEvent);
        }
      }

      const tail = buffer.trim();
      if (tail) {
        handleEvent(JSON.parse(tail) as QueryStreamEvent);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setAiError(err instanceof Error ? err.message : t('tr_report_ai_failed', 'TR report AI request failed'));
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setAiRunning(false);
      }
    }
  };

  if (!sessionUser) {
    return null;
  }

  return (
    <CAppPageLayout
      appTitle={t('tr_report_title', 'TRReport - Reimbursement Pivot')}
      menuData={menuData}
      logo={<HeaderLogo />}
      user={headerUser}
      locale={lang}
      onLocaleChange={(l) => changeLanguage(l as any)}
      localeOptions={['en', 'zh']}
      onSearch={(value) => void submitAiQuery(value)}
      onUserLogout={() => void performClientLogout({ router, replace: true })}
      contentSx={{ height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, width: '100%', height: '100%', minHeight: 0 }}>
        {hasAccess && (
          <>
            {error ? <Alert severity="error">{error}</Alert> : null}
            {aiError ? <Alert severity="error">{aiError}</Alert> : null}

            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                position: 'relative',
                borderRadius: '28px',
                p: '2px',
                background: aiRunning
                  ? 'linear-gradient(120deg, rgba(33,188,255,0.92), rgba(99,255,143,0.95), rgba(123,97,255,0.88), rgba(33,188,255,0.92))'
                  : 'linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06))',
                backgroundSize: '240% 240%',
                animation: aiRunning ? 'tr-report-ai-border 3.8s linear infinite' : 'none',
                boxShadow: aiRunning
                  ? '0 0 0 1px rgba(92, 241, 255, 0.34), 0 0 26px rgba(33, 188, 255, 0.18), 0 0 42px rgba(99, 255, 143, 0.10)'
                  : '0 0 0 1px rgba(255,255,255,0.08)',
                '@keyframes tr-report-ai-border': {
                  '0%': { backgroundPosition: '0% 50%' },
                  '50%': { backgroundPosition: '100% 50%' },
                  '100%': { backgroundPosition: '0% 50%' },
                },
              }}
            >
              <Box sx={{ position: 'relative', height: '100%', minHeight: 0, borderRadius: '26px', overflow: 'hidden' }}>
                {!loading && aiRunning ? (
                  <>
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 32,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 3,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        pointerEvents: 'none',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {AI_WORKFLOW_STAGES.map((stage) => {
                        const state = aiStageProgress[stage];
                        const dotColor =
                          state === 'active'
                            ? isDark
                              ? '#7dd3fc'
                              : '#2563eb'
                            : state === 'done'
                              ? isDark
                                ? '#86efac'
                                : '#16a34a'
                              : isDark
                                ? 'rgba(148, 163, 184, 0.82)'
                                : 'rgba(148, 163, 184, 0.92)';
                        return (
                          <Box
                            key={stage}
                            sx={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 0.75,
                            }}
                          >
                            <Box
                              sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '999px',
                                backgroundColor: dotColor,
                                boxShadow:
                                  state === 'active'
                                    ? isDark
                                      ? '0 0 0 3px rgba(125,211,252,0.18)'
                                      : '0 0 0 3px rgba(37,99,235,0.14)'
                                    : state === 'done'
                                      ? isDark
                                        ? '0 0 0 2px rgba(134,239,172,0.16)'
                                        : '0 0 0 2px rgba(22,163,74,0.12)'
                                      : 'none',
                              }}
                            />
                            <Box
                              component="span"
                              sx={{
                                fontSize: 13,
                                lineHeight: 1,
                                color:
                                  state === 'pending'
                                    ? isDark
                                      ? 'rgba(148,163,184,0.88)'
                                      : '#64748b'
                                    : isDark
                                      ? 'rgba(226,232,240,0.98)'
                                      : state === 'active'
                                        ? '#0f172a'
                                        : '#334155',
                                fontWeight: state === 'active' ? 600 : 500,
                                letterSpacing: 0,
                                opacity: 1,
                                textShadow: 'none',
                              }}
                            >
                              {stageLabels[stage]}
                            </Box>
                          </Box>
                        );
                      })}
                    </Box>
                  </>
                ) : null}

                {loading ? (
                  <Box sx={{ height: '100%', minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CircularProgress size={28} />
                  </Box>
                ) : (
                  <CPivotTable
                    title=" "
                    rows={pivotRows}
                    fields={fields}
                    initialChart={initialChart}
                    initialChartCollapsed={false}
                    initialTableCollapsed={false}
                    emptyText={t('tr_report_empty', 'No reimbursement report data')}
                    model={pivotModel}
                    enablePresetManagement
                    presets={presets}
                    defaultPresets={defaultPresets}
                    onPresetsChange={handlePresetsChange}
                    maxPreviewHeight="64vh"
                  />
                )}
              </Box>
            </Box>
          </>
        )}
      </Box>
    </CAppPageLayout>
  );
}
