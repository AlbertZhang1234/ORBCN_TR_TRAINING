import { useState, useEffect, useMemo } from 'react';
import {
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
  Typography,
} from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { BusyTable } from '../_components/TableLoadingMarquee';
import { usePcI18n } from '../_components/PcI18nProvider';
import { createTravelReimbursement } from '../../../services/TravelReimbursement/create';
import { changeTravelReimbursement } from '../../../services/TravelReimbursement/change';
import { listReimbursementLines, type ReimbursementListRow } from '../../../services/TravelReimbursement/list';
import {
  normalizeChargeableFlag,
  normalizeLineAmount,
  assertInvoiceSaveCurrencyConsistency,
} from '../../../services/TravelReimbursement/_shared';
import type { ProjectListRow } from '../../../services/Projects/list';
import type { TravelEntryListRow } from '../../../services/TravelEntry/list';
import type { InvoiceListRow } from '../../../services/Invoice/list';
import type { SessionUser } from '../_components/session';
import {
  toFilter,
  readInvoiceAmountText,
  readInvoiceOriginalAmountText,
  readInvoiceStatus,
  readInvoiceOriginalCurrency,
  readInvoiceCurrency,
  isInvoiceLockedForSelection,
  type SelectableInvoiceRow,
} from './helpers';
import { normalizeWorkflowStatus } from '../../../services/_core/locks';
import { useMessageBox } from '../_components/useMessageBox';

interface ReimbursementEditorProps {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  targetRow: ReimbursementListRow | null;
  sessionUser: SessionUser | null;
  projects: ProjectListRow[];
  travelEntries: TravelEntryListRow[];
  invoices: InvoiceListRow[];
  prefillData?: {
    invoiceNos: string[];
    applicant?: string;
    travelFilterId?: string;
  } | null;
  onSaved: () => void;
}

export default function ReimbursementEditor({
  open,
  onClose,
  mode,
  targetRow,
  sessionUser,
  projects,
  travelEntries,
  invoices,
  prefillData = null,
  onSaved,
}: ReimbursementEditorProps) {
  const { t } = usePcI18n();
  const { showError, messageBox } = useMessageBox(t);
  const [applicant, setApplicant] = useState('');
  const [projectId, setProjectId] = useState('');
  const [travelFilterId, setTravelFilterId] = useState('');
  const [selectedInvoiceNos, setSelectedInvoiceNos] = useState<string[]>([]);
  const [lineAmounts, setLineAmounts] = useState<Record<string, string>>({});
  const [lineTrChargeable, setLineTrChargeable] = useState<Record<string, boolean>>({});
  const [lineTxChargeable, setLineTxChargeable] = useState<Record<string, boolean>>({});
  const [leftSelected, setLeftSelected] = useState<string[]>([]);
  const [rightSelected, setRightSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const reportError = (message: string) => {
    setError(message);
    showError(message);
  };

  // Computed Maps
  const travelProjectMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const travel of travelEntries) {
      const travelId = String(travel.travelid ?? '').trim();
      if (!travelId) continue;
      map.set(travelId, String(travel.projectid ?? '').trim());
    }
    return map;
  }, [travelEntries]);

  const allInvoiceMap = useMemo(() => {
    const map = new Map<string, InvoiceListRow>();
    for (const invoice of invoices) {
      const key = String(invoice.invoiceno ?? '').trim();
      if (!key) continue;
      map.set(key, invoice);
    }
    return map;
  }, [invoices]);

  const readDefaultAmountByInvoiceNo = (invoiceNo: string): string => {
    const row = allInvoiceMap.get(invoiceNo);
    return readInvoiceAmountText(row);
  };

  const projectChargeableDefaultsMap = useMemo(() => {
    const map = new Map<string, { trchargeable: boolean; txchargeable: boolean }>();
    for (const project of projects) {
      const key = String(project.projectid ?? '').trim();
      if (!key) {
        continue;
      }
      const trDefault = normalizeChargeableFlag(project.trchargeable) ?? false;
      const txDefault = normalizeChargeableFlag(project.txchargeable) ?? false;
      map.set(key, { trchargeable: trDefault, txchargeable: txDefault });
    }
    return map;
  }, [projects]);

  const readProjectChargeableDefaults = (projectIdValue: string) => {
    return (
      projectChargeableDefaultsMap.get(projectIdValue.trim()) ?? {
        trchargeable: false,
        txchargeable: false,
      }
    );
  };

  useEffect(() => {
    if (!open) return;

    const init = async () => {
      setLoading(true);
      setError('');
      try {
        if (mode === 'create') {
          const user = sessionUser?.userid ?? '';
          const prefillApplicant = String(prefillData?.applicant ?? '').trim();
          const prefillTravelFilterId = String(prefillData?.travelFilterId ?? '').trim();
          const prefillInvoiceNos = Array.isArray(prefillData?.invoiceNos)
            ? prefillData.invoiceNos.map((item) => String(item).trim()).filter(Boolean)
            : [];

          setApplicant(prefillApplicant || user);
          setProjectId('');
          setTravelFilterId(prefillTravelFilterId);
          setSelectedInvoiceNos(prefillInvoiceNos);
          setLineAmounts({});
          setLineTrChargeable({});
          setLineTxChargeable({});
          setLeftSelected([]);
          setRightSelected([]);
        } else {
          if (!targetRow) {
             throw new Error('No target row for edit');
          }
          const filter = toFilter(targetRow);
          const lines = await listReimbursementLines(filter);
          const user = String(targetRow.userid ?? '').trim() || sessionUser?.userid || '';
          const proj = String(targetRow.projectid ?? '').trim();
          
          const amounts: Record<string, string> = {};
          const trChargeableByInvoice: Record<string, boolean> = {};
          const txChargeableByInvoice: Record<string, boolean> = {};
          const nos = lines.map((line) => line.invoiceno);
          for (const line of lines) {
            const normalized = normalizeLineAmount(line.tr_amount);
            if (normalized !== undefined) {
              amounts[line.invoiceno] = normalized;
            } else {
              const fallback = readDefaultAmountByInvoiceNo(line.invoiceno);
              if (fallback) {
                amounts[line.invoiceno] = fallback;
              }
            }
            const trChargeable = normalizeChargeableFlag(line.trchargeable);
            if (trChargeable !== undefined) {
              trChargeableByInvoice[line.invoiceno] = trChargeable;
            }
            const txChargeable = normalizeChargeableFlag(line.txchargeable);
            if (txChargeable !== undefined) {
              txChargeableByInvoice[line.invoiceno] = txChargeable;
            }
          }

          setApplicant(user);
          setProjectId(proj);
          setTravelFilterId('');
          setSelectedInvoiceNos(nos);
          setLineAmounts(amounts);
          setLineTrChargeable(trChargeableByInvoice);
          setLineTxChargeable(txChargeableByInvoice);
          setLeftSelected([]);
          setRightSelected([]);
        }
      } catch (err) {
        reportError(err instanceof Error ? err.message : 'Failed to initialize editor');
      } finally {
        setLoading(false);
      }
    };
    
    void init();
  }, [open, mode, targetRow, sessionUser, allInvoiceMap, prefillData]); // Careful with dependencies

  // Logic for Lists
  const availableInvoiceRows = useMemo<SelectableInvoiceRow[]>(() => {
    const currentApplicant = applicant.trim();
    const currentProject = projectId.trim();
    if (!currentApplicant || !currentProject) {
      return [];
    }

    const rowsForLeft: SelectableInvoiceRow[] = [];
    for (const invoice of invoices) {
      const invoiceNo = String(invoice.invoiceno ?? '').trim();
      if (!invoiceNo) continue;

      const invoiceUser = String(invoice.userid ?? '').trim();
      if (invoiceUser !== currentApplicant) continue;

      if (isInvoiceLockedForSelection(invoice) && !selectedInvoiceNos.includes(invoiceNo)) {
        continue;
      }

      const travelId = String(invoice.travelid ?? '').trim();
      const hasTravelId = travelId.length > 0;
      const travelProject = travelProjectMap.get(travelId) ?? '';
      const invoiceProject = String(invoice.projectid ?? invoice.project_id ?? '').trim();
      const resolvedProject = travelProject || invoiceProject;

      if (hasTravelId) {
        if (resolvedProject !== currentProject) continue;
      } else {
        // New rule: invoices without travel id can still be selected
        // when they are still pending/open and belong to current user.
        const workflowStatus = normalizeWorkflowStatus(readInvoiceStatus(invoice));
        if (workflowStatus !== 'PENDING') continue;
      }

      if (travelFilterId.trim() && travelId !== travelFilterId.trim()) {
        continue;
      }

      rowsForLeft.push({
        invoiceno: invoiceNo,
        description: String(invoice.description ?? ''),
        amount: readInvoiceAmountText(invoice),
        currency: readInvoiceCurrency(invoice),
        originalamount: readInvoiceOriginalAmountText(invoice),
        originalcurrency: readInvoiceOriginalCurrency(invoice),
        travelid: travelId,
        projectid: resolvedProject || currentProject,
      });
    }

    return rowsForLeft
      .filter((row) => !selectedInvoiceNos.includes(row.invoiceno))
      .sort((a, b) => a.invoiceno.localeCompare(b.invoiceno));
  }, [applicant, projectId, travelFilterId, selectedInvoiceNos, invoices, travelProjectMap]);

  const selectedInvoiceRows = useMemo<SelectableInvoiceRow[]>(() => {
    const rowsForRight: SelectableInvoiceRow[] = [];
    const currentProjectDefaults = readProjectChargeableDefaults(projectId);
    for (const invoiceNo of selectedInvoiceNos) {
      const invoice = allInvoiceMap.get(invoiceNo);
      const travelId = String(invoice?.travelid ?? '').trim();
      const travelProject = travelProjectMap.get(travelId) ?? String(invoice?.projectid ?? '').trim();
      const invoiceAmount = readInvoiceAmountText(invoice);
      const hasLineAmount = Object.prototype.hasOwnProperty.call(lineAmounts, invoiceNo);
      const trAmount = hasLineAmount
        ? String(lineAmounts[invoiceNo] ?? '')
        : invoiceAmount;
      const hasTrChargeable = Object.prototype.hasOwnProperty.call(lineTrChargeable, invoiceNo);
      const hasTxChargeable = Object.prototype.hasOwnProperty.call(lineTxChargeable, invoiceNo);
      const trChargeable = hasTrChargeable
        ? lineTrChargeable[invoiceNo]
        : currentProjectDefaults.trchargeable;
      const txChargeable = hasTxChargeable
        ? lineTxChargeable[invoiceNo]
        : currentProjectDefaults.txchargeable;

      rowsForRight.push({
        invoiceno: invoiceNo,
        description: String(invoice?.description ?? ''),
        amount: invoiceAmount,
        currency: readInvoiceCurrency(invoice),
        originalamount: readInvoiceOriginalAmountText(invoice),
        tr_amount: trAmount,
        trchargeable: trChargeable,
        txchargeable: txChargeable,
        originalcurrency: readInvoiceOriginalCurrency(invoice),
        travelid: travelId,
        projectid: travelProject,
      });
    }

    return rowsForRight.sort((a, b) => a.invoiceno.localeCompare(b.invoiceno));
  }, [
    selectedInvoiceNos,
    allInvoiceMap,
    travelProjectMap,
    lineAmounts,
    lineTrChargeable,
    lineTxChargeable,
    projectId,
    projectChargeableDefaultsMap,
  ]);

  const travelFilterOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: Array<{ value: string; label: string }> = [];
    for (const row of availableInvoiceRows) {
      if (!row.travelid || seen.has(row.travelid)) {
        continue;
      }
      seen.add(row.travelid);
      options.push({ value: row.travelid, label: row.travelid });
    }
    return options.sort((a, b) => a.value.localeCompare(b.value));
  }, [availableInvoiceRows]);

  const projectOptions = useMemo(
    () =>
      projects.map((project) => ({
        value: String(project.projectid ?? ''),
        label: `${String(project.projectid ?? '')} - ${String(project.description ?? '').trim()}`,
      })),
    [projects],
  );

  const moveToRight = () => {
    if (leftSelected.length === 0) return;
    const currentProjectDefaults = readProjectChargeableDefaults(projectId);
    setLineAmounts((prev) => {
      const next = { ...prev };
      for (const invoiceNo of leftSelected) {
        if (!Object.prototype.hasOwnProperty.call(next, invoiceNo)) {
          next[invoiceNo] = readDefaultAmountByInvoiceNo(invoiceNo);
        }
      }
      return next;
    });
    setLineTrChargeable((prev) => {
      const next = { ...prev };
      for (const invoiceNo of leftSelected) {
        if (!Object.prototype.hasOwnProperty.call(next, invoiceNo)) {
          next[invoiceNo] = currentProjectDefaults.trchargeable;
        }
      }
      return next;
    });
    setLineTxChargeable((prev) => {
      const next = { ...prev };
      for (const invoiceNo of leftSelected) {
        if (!Object.prototype.hasOwnProperty.call(next, invoiceNo)) {
          next[invoiceNo] = currentProjectDefaults.txchargeable;
        }
      }
      return next;
    });
    setSelectedInvoiceNos((prev) => {
      const merged = new Set([...prev, ...leftSelected]);
      return Array.from(merged);
    });
    setLeftSelected([]);
  };

  const moveToLeft = () => {
    if (rightSelected.length === 0) return;
    setLineAmounts((prev) => {
      const next = { ...prev };
      for (const invoiceNo of rightSelected) {
        delete next[invoiceNo];
      }
      return next;
    });
    setLineTrChargeable((prev) => {
      const next = { ...prev };
      for (const invoiceNo of rightSelected) {
        delete next[invoiceNo];
      }
      return next;
    });
    setLineTxChargeable((prev) => {
      const next = { ...prev };
      for (const invoiceNo of rightSelected) {
        delete next[invoiceNo];
      }
      return next;
    });
    setSelectedInvoiceNos((prev) => prev.filter((x) => !rightSelected.includes(x)));
    setRightSelected([]);
  };

  const handleSave = async () => {
    const currentProject = projectId.trim();
    if (!applicant.trim()) {
      reportError(t('applicant_empty_error', 'Applicant is empty, please re-login'));
      return;
    }
    if (!currentProject) {
      reportError(t('please_select_project_id', 'Please select Project ID'));
      return;
    }
    if (selectedInvoiceNos.length === 0) {
      reportError(t('please_select_at_least_one_invoice', 'Please select at least one invoice'));
      return;
    }
    try {
      assertInvoiceSaveCurrencyConsistency(
        selectedInvoiceNos.map((invoiceNo) => allInvoiceMap.get(invoiceNo) ?? {}),
      );
    } catch {
      reportError(
        t(
          'mixed_save_currency_not_allowed',
          'Invoices with different save currencies cannot be submitted in one reimbursement.',
        ),
      );
      return;
    }

    const currentProjectDefaults = readProjectChargeableDefaults(currentProject);
    const lines = selectedInvoiceNos.map((invoiceNo) => {
      const rawAmount = String(lineAmounts[invoiceNo] ?? '').trim();
      const hasRawAmount =
        Object.prototype.hasOwnProperty.call(lineAmounts, invoiceNo) &&
        rawAmount.length > 0;
      const fallbackAmount = readDefaultAmountByInvoiceNo(invoiceNo);
      const normalizedInputAmount = hasRawAmount ? normalizeLineAmount(rawAmount) : undefined;
      if (hasRawAmount && !normalizedInputAmount) {
        throw new Error(`Invalid reimbursement amount for invoice ${invoiceNo}`);
      }
      const normalizedAmount = normalizedInputAmount ?? normalizeLineAmount(fallbackAmount);
      const hasTrChargeable = Object.prototype.hasOwnProperty.call(lineTrChargeable, invoiceNo);
      const hasTxChargeable = Object.prototype.hasOwnProperty.call(lineTxChargeable, invoiceNo);
      return {
        invoiceno: invoiceNo,
        tr_amount: normalizedAmount,
        trchargeable: hasTrChargeable
          ? lineTrChargeable[invoiceNo]
          : currentProjectDefaults.trchargeable,
        txchargeable: hasTxChargeable
          ? lineTxChargeable[invoiceNo]
          : currentProjectDefaults.txchargeable,
      };
    });

    setSaving(true);
    setError('');
    try {
      if (mode === 'create') {
        await createTravelReimbursement({
          header: {
            userid: applicant.trim(),
            projectid: currentProject,
          },
          lines,
        });
      } else {
        if (!targetRow) throw new Error('No target row');
        await changeTravelReimbursement({
          filter: toFilter(targetRow),
          headerPatch: {
            userid: applicant.trim(),
            projectid: currentProject,
          },
          lines,
        });
      }
      onSaved();
    } catch (err) {
      reportError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const availableInvoiceColumns = useMemo<any[]>(
    () => [
      { id: 'invoiceno', label: t('invoice_no', 'Invoice No'), minWidth: 160 },
      { id: 'description', label: t('invoice_description', 'Invoice Description'), minWidth: 220 },
      { id: 'amount', label: t('save_amount', 'Save Amount'), minWidth: 120 },
      { id: 'currency', label: t('save_currency', 'Save Currency'), minWidth: 120 },
      { id: 'originalamount', label: t('original_amount', 'Original Amount'), minWidth: 140 },
      { id: 'originalcurrency', label: t('original_currency', 'Original Currency'), minWidth: 140 },
      { id: 'travelid', label: t('travel_id', 'Travel ID'), minWidth: 140 },
    ],
    [t],
  );

  const selectedInvoiceColumns = useMemo<any[]>(
    () => [
      { id: 'invoiceno', label: t('invoice_no', 'Invoice No'), minWidth: 160 },
      { id: 'description', label: t('invoice_description', 'Invoice Description'), minWidth: 220 },
      {
        id: 'tr_amount',
        label: t('reimbursement_amount_col', 'Reimbursement Amount'),
        minWidth: 180,
        render: (_value: unknown, row: SelectableInvoiceRow) => (
          <TextField
            size="small"
            type="number"
            value={String(row.tr_amount ?? '')}
            onChange={(event) => {
              const next = event.target.value;
              setLineAmounts((prev) => ({ ...prev, [row.invoiceno]: next }));
            }}
            onClick={(event) => event.stopPropagation()}
            onFocus={(event) => event.stopPropagation()}
            placeholder={row.amount || '0'}
            fullWidth
            inputProps={{
              step: '0.01',
              style: { fontSize: '0.8rem', paddingTop: 6, paddingBottom: 6 },
            }}
          />
        ),
      },
      { id: 'currency', label: t('save_currency', 'Save Currency'), minWidth: 120 },
      { id: 'amount', label: t('save_amount', 'Save Amount'), minWidth: 120 },
      { id: 'originalamount', label: t('original_amount', 'Original Amount'), minWidth: 140 },
      { id: 'originalcurrency', label: t('original_currency', 'Original Currency'), minWidth: 140 },
      {
        id: 'trchargeable',
        label: t('tr_chargeable', 'TR Chargeable'),
        minWidth: 150,
        render: (_value: unknown, row: SelectableInvoiceRow) => (
          <TextField
            size="small"
            select
            value={row.trchargeable ? 'true' : 'false'}
            onChange={(event) => {
              const next = event.target.value === 'true';
              setLineTrChargeable((prev) => ({ ...prev, [row.invoiceno]: next }));
            }}
            onClick={(event) => event.stopPropagation()}
            onFocus={(event) => event.stopPropagation()}
            fullWidth
            sx={{
              '& .MuiInputBase-input, & .MuiSelect-select': {
                fontSize: '0.8rem',
                paddingTop: '6px',
                paddingBottom: '6px',
              },
            }}
          >
            <MenuItem value="true">{t('yes', 'Yes')}</MenuItem>
            <MenuItem value="false">{t('no', 'No')}</MenuItem>
          </TextField>
        ),
      },
      {
        id: 'txchargeable',
        label: t('tx_chargeable', 'TX Chargeable'),
        minWidth: 150,
        render: (_value: unknown, row: SelectableInvoiceRow) => (
          <TextField
            size="small"
            select
            value={row.txchargeable ? 'true' : 'false'}
            onChange={(event) => {
              const next = event.target.value === 'true';
              setLineTxChargeable((prev) => ({ ...prev, [row.invoiceno]: next }));
            }}
            onClick={(event) => event.stopPropagation()}
            onFocus={(event) => event.stopPropagation()}
            fullWidth
            sx={{
              '& .MuiInputBase-input, & .MuiSelect-select': {
                fontSize: '0.8rem',
                paddingTop: '6px',
                paddingBottom: '6px',
              },
            }}
          >
            <MenuItem value="true">{t('yes', 'Yes')}</MenuItem>
            <MenuItem value="false">{t('no', 'No')}</MenuItem>
          </TextField>
        ),
      },
      { id: 'travelid', label: t('travel_id', 'Travel ID'), minWidth: 140 },
    ],
    [t],
  );

  const invoicePickTableSx = {
    '& .MuiTableCell-root': {
      fontSize: '0.8rem',
      py: 0.7,
    },
    '& .MuiTableSortLabel-root': {
      fontSize: '0.8rem',
    },
    '& .MuiCheckbox-root': {
      p: 0.4,
    },
    '& .MuiTableHead-root .MuiTableCell-paddingCheckbox': {
      py: 1,
      pl: 1,
      pr: 0.5,
      verticalAlign: 'middle',
    },
    '& .MuiTableHead-root .MuiCheckbox-root': {
      p: 0.5,
      mt: '1px',
    },
    '& .MuiTableBody-root .MuiTableCell-paddingCheckbox': {
      pl: 1,
      pr: 0.5,
      verticalAlign: 'middle',
    },
  };

  const selectMenuProps = {
    PaperProps: {
      sx: {
        maxHeight: 'min(48vh, 360px)',
        maxWidth: 'calc(100vw - 64px)',
      },
    },
    MenuListProps: {
      sx: {
        py: 0.5,
      },
    },
  } as const;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth={false}
      PaperProps={{
        sx: {
          width: 'min(96vw, 1760px)',
          maxHeight: '92vh',
        },
      }}
    >
      <DialogTitle>{mode === 'create' ? t('create_reimbursement', 'Create Reimbursement') : t('edit_reimbursement', 'Edit Reimbursement')}</DialogTitle>
      <DialogContent sx={{ pt: 1, overflowX: 'hidden' }}>
        <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
          {error && <Typography color="error">{error}</Typography>}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
            <TextField label={t('applicant', 'Applicant')} value={applicant} fullWidth disabled helperText={t('applicant_helper', 'Current login user')} />
          </Box>

          <TextField
            label={t('project_id', 'Project ID')}
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              setTravelFilterId('');
              setLeftSelected([]);
            }}
            fullWidth
            select
            SelectProps={{ MenuProps: selectMenuProps }}
            disabled={projectOptions.length === 0}
            helperText={projectOptions.length === 0 ? t('no_projects_available', 'No projects available, please create a project first') : undefined}
          >
            {projectOptions.map((option) => (
              <MenuItem
                key={option.value}
                value={option.value}
                sx={{
                  whiteSpace: 'normal',
                  wordBreak: 'break-word',
                  lineHeight: 1.3,
                }}
              >
                {option.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label={t('travel_id_filter', 'Travel ID Filter (Optional)')}
            value={travelFilterId}
            onChange={(e) => {
              setTravelFilterId(e.target.value);
              setLeftSelected([]);
            }}
            fullWidth
            select
            SelectProps={{ MenuProps: selectMenuProps }}
            disabled={!projectId}
            helperText={!projectId ? t('please_select_project_first', 'Please select project first') : undefined}
          >
            <MenuItem value="">{t('all_travels', '(All Travels)')}</MenuItem>
            {travelFilterOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>

          <Typography variant="subtitle2" sx={{ color: 'text.secondary', mt: 1 }}>
            {t('invoice_pick_hint', 'Left: Available invoices (Current User + Project). Right: Invoices to be saved.')}
          </Typography>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: '1fr auto 1fr' },
              gap: 2,
              alignItems: 'center',
              width: '100%',
              minWidth: 0,
            }}
          >
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ px: 1, py: 0.5, fontSize: '0.8rem' }}>
                {t('available_invoices', 'Available Invoices')}
              </Typography>
              <Box
                sx={{
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  width: '100%',
                  minWidth: 0,
                  '& .MuiToolbar-root': { display: 'none' },
                  ...invoicePickTableSx,
                }}
              >
                <BusyTable
                  appId="pc-reimbursements"
                  busy={loading}
                  title={t('available_invoices', 'Available Invoices')}
                  columns={availableInvoiceColumns}
                  rows={availableInvoiceRows}
                  rowKey="invoiceno"
                  tableKey="reimbursement_invoice_picker_available"
                  showToolbar={false}
                  rowsPerPage={Math.max(availableInvoiceRows.length, 1)}
                  fullWidth
                  selectionMode="multiple"
                  selected={leftSelected}
                  onSelectionChange={(rowsSelected: unknown[]) =>
                    setLeftSelected(rowsSelected.map((x) => String(x)))
                  }
                />
              </Box>
            </Box>

            <Box sx={{ display: 'grid', gap: 1 }}>
              <Tooltip title={t('add', 'Add')}>
                <span>
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={moveToRight}
                    disabled={leftSelected.length === 0}
                    aria-label={t('add', 'Add')}
                    sx={{
                      width: 32,
                      height: 32,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                    }}
                  >
                    <ArrowForwardRoundedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={t('remove', 'Remove')}>
                <span>
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={moveToLeft}
                    disabled={rightSelected.length === 0}
                    aria-label={t('remove', 'Remove')}
                    sx={{
                      width: 32,
                      height: 32,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                    }}
                  >
                    <ArrowBackRoundedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>

            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ px: 1, py: 0.5, fontSize: '0.8rem' }}>
                {t('selected_invoices', 'Selected Invoices')}
              </Typography>
              <Box
                sx={{
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  width: '100%',
                  minWidth: 0,
                  '& .MuiToolbar-root': { display: 'none' },
                  ...invoicePickTableSx,
                }}
              >
                <BusyTable
                  appId="pc-reimbursements"
                  busy={loading}
                  title={t('selected_invoices', 'Selected Invoices')}
                  columns={selectedInvoiceColumns}
                  rows={selectedInvoiceRows}
                  rowKey="invoiceno"
                  tableKey="reimbursement_invoice_picker_selected"
                  showToolbar={false}
                  rowsPerPage={Math.max(selectedInvoiceRows.length, 1)}
                  fullWidth
                  selectionMode="multiple"
                  selected={rightSelected}
                  onSelectionChange={(rowsSelected: unknown[]) =>
                    setRightSelected(rowsSelected.map((x) => String(x)))
                  }
                />
              </Box>
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={saving}>
          {t('save', 'Save')}
        </Button>
      </DialogActions>
      {messageBox}
    </Dialog>
  );
}
