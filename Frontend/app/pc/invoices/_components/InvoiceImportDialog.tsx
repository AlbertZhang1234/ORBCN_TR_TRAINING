
import { type ChangeEvent, type DragEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import { BusyTable } from '../../_components/TableLoadingMarquee';
import { parseInvoice, type InvoiceParseResult } from '../../../../services/Invoice/parse';
import { saveInvoice } from '../../../../services/Invoice/save';
import { saveInvoiceSourceFile } from '../../../../services/Invoice/source';
import type { InvoiceRecord } from '../../../../services/Invoice/_shared';
import { listInvoices } from '../../../../services/Invoice/list';
import { useBookingRuleOptions } from '../../../../services/Invoice/useBookingRuleOptions';
import { formatBookingRuleOption } from '../../../../services/Invoice/booking-rules';
import {
  BUSINESS_TYPE_OPTIONS,
  DEFAULT_BUSINESS_TYPE,
  formatBusinessTypeOption,
} from '../../../../services/Invoice/business-types';
import { normalizeWorkflowStatus } from '../../../../services/_core/locks';
import {
  type ImportInvoiceDraft,
  normalizeImportDrafts,
  statusLabel,
  toNumberOrUndefined,
  toTrimmedString,
} from './shared';
import { useMessageBox } from '../../_components/useMessageBox';
import { useRouter } from 'next/navigation';
import InvoiceImportSummary from './InvoiceImportSummary';

interface Option {
  value: string;
  label: string;
}

interface InvoiceImportDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  userOptions: Option[];
  travelOptions: Option[];
  t: (key: string, fallback: string) => string;
  lang: 'en' | 'zh';
  defaultUserId?: string;
  existingInvoiceNoSet: Set<string>;
}

const bookingRuleLowConfidenceThreshold = 0.7;
const REIMBURSEMENT_PREFILL_STORAGE_KEY = 'pc_reimbursement_create_prefill';

function toInputString(value: unknown): string {
  return String(value ?? '');
}

export default function InvoiceImportDialog({
  open,
  onClose,
  onSuccess,
  userOptions,
  travelOptions,
  t,
  lang,
  defaultUserId = '',
  existingInvoiceNoSet,
}: InvoiceImportDialogProps) {
  const router = useRouter();
  const { showError, showSuccess, showWarning, showInfo, messageBox } = useMessageBox(t);
  const [importRows, setImportRows] = useState<ImportInvoiceDraft[]>([]);
  const [importUserId, setImportUserId] = useState(defaultUserId);
  const [businessType, setBusinessType] = useState(DEFAULT_BUSINESS_TYPE);
  const [importTravelId, setImportTravelId] = useState('');
  const [importDragActive, setImportDragActive] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [importParsing, setImportParsing] = useState(false);
  const [savingImport, setSavingImport] = useState(false);
  const [error, setError] = useState('');
  const { options: bookingRuleOptions } = useBookingRuleOptions();

  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setImportRows([]);
      setImportMessage('');
      setImportUserId(defaultUserId);
      setBusinessType(DEFAULT_BUSINESS_TYPE);
      setImportTravelId('');
      setImportDragActive(false);
      setError('');
    }
  }, [open, defaultUserId]);

  const closeImportDialog = () => {
    if (importParsing || savingImport) {
      return;
    }
    onClose();
  };

  const buildImportDraft = (
    file: File,
    parsed?: InvoiceParseResult,
    parseError?: string,
  ): ImportInvoiceDraft => {
    const originalCurrency = toTrimmedString(parsed?.currency).toUpperCase() || 'CNY';
    const originalAmount = toNumberOrUndefined(parsed?.amount_incl_tax);
    const payload: InvoiceRecord = {
      invoiceno: toTrimmedString(parsed?.invoice_number),
      userid: importUserId.trim(),
      businesstype: businessType,
      invoicedate: toTrimmedString(parsed?.issue_date),
      totalnetamount: toNumberOrUndefined(parsed?.amount_excl_tax),
      taxamount: toNumberOrUndefined(parsed?.tax_amount),
      grossamount: toNumberOrUndefined(parsed?.amount_incl_tax),
      bookingcode: toTrimmedString(parsed?.category_code).toUpperCase(),
      supplier: toTrimmedString(parsed?.seller_name || parsed?.buyer_name),
      description: '',
      comment: toTrimmedString(parsed?.remark),
      currency: originalCurrency,
      originalcurrency: originalCurrency,
      originalamount: originalAmount,
      status: 'open',
    };

    const travel = importTravelId.trim();
    if (travel) {
      payload.travelid = travel;
    }

    return {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      fileName: file.name,
      sourceFile: file,
      payload,
      raw: parsed,
      parseError,
    };
  };

  const processImportFiles = async (files: File[]) => {
    if (files.length === 0) {
      return;
    }

    setImportParsing(true);
    setImportMessage(t('parsing_files', 'Parsing files...'));
    try {
      const parsedDrafts = await Promise.all(
        files.map(async (file) => {
          try {
            const parsed = await parseInvoice(file, file.name);
            return buildImportDraft(file, parsed);
          } catch (err) {
            return buildImportDraft(
              file,
              undefined,
              err instanceof Error ? err.message : '解析失败',
            );
          }
        }),
      );

      const nextRows = normalizeImportDrafts(
        [...importRows, ...parsedDrafts],
        existingInvoiceNoSet,
        t
      );
      setImportRows(nextRows);

      const failed = parsedDrafts.filter((x) => x.parseError).length;
      const success = parsedDrafts.length - failed;
      const missingDateCount = parsedDrafts.filter(
        (row) => !row.parseError && !toTrimmedString(row.raw?.issue_date),
      ).length;
      setImportMessage(
        t('parsing_completed', 'Parsing completed: Success {0}, Failed {1}')
          .replace('{0}', String(success))
          .replace('{1}', String(failed))
      );
      if (missingDateCount > 0) {
        showWarning(
          t(
            'invoice_date_not_recognized_warning',
            '{0} receipt(s) had no recognizable invoice date. The upload date was filled in by default. Please check and edit the Invoice Date before saving; generated receipt numbers will update with the date.',
          ).replace('{0}', String(missingDateCount)),
        );
      }
    } finally {
      setImportParsing(false);
    }
  };

  const handleImportFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    await processImportFiles(files);
  };

  const handleImportDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setImportDragActive(false);
    const files = Array.from(event.dataTransfer.files ?? []).filter(
      (file) =>
        file.type === 'application/pdf' ||
        file.type.startsWith('image/') ||
        file.name.toLowerCase().endsWith('.pdf'),
    );
    await processImportFiles(files);
  };

  const handleImportDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!importParsing && !savingImport) {
      setImportDragActive(true);
    }
  };

  const handleImportDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setImportDragActive(false);
    }
  };

  const saveImportedInvoices = async (nextAction: 'saveOnly' | 'saveAndCreateReimbursement' = 'saveOnly') => {
    if (importRows.length === 0) {
      const msg = t('please_import_files_first', 'Please import files first');
      setImportMessage(msg);
      showInfo(msg);
      return;
    }

    setSavingImport(true);
    setImportMessage(t('validating_and_saving', 'Validating and saving...'));
    setError('');
    try {
      // Re-fetch latest invoices to ensure duplicate check is up-to-date
      const latestRows = await listInvoices();
      const latestSet = new Set(
        latestRows
          .map((row) => toTrimmedString(row.invoiceno))
          .filter((x) => x.length > 0),
      );

      const normalized = normalizeImportDrafts(importRows, latestSet, t);
      setImportRows(normalized);

      const toSave = normalized.filter((row) => !row.skipReason);
      const skipped = normalized.length - toSave.length;
      if (toSave.length === 0) {
        const msg = t('no_savable_invoices', 'No savable invoices, skipped {0} duplicate/abnormal records')
          .replace('{0}', String(skipped));
        setImportMessage(msg);
        showWarning(msg);
        return;
      }

      const missingDescriptionRows = toSave.filter(
        (row) => toTrimmedString(row.payload.description).length === 0,
      );
      if (missingDescriptionRows.length > 0) {
        const sample = missingDescriptionRows
          .slice(0, 5)
          .map((row) => toTrimmedString(row.payload.invoiceno) || row.fileName)
          .join('，');
        const msg =
          t(
            'description_required_before_save',
            'Description is required before save. Please fill all descriptions.',
          ) + ` (${sample})`;
        setError(msg);
        showError(msg);
        setImportMessage(
          t(
            'description_required_before_save_short',
            'Description is mandatory. Save blocked.',
          ),
        );
        return;
      }

      let saved = 0;
      const savedInvoiceNos: string[] = [];
      const failed: string[] = [];
      for (const row of toSave) {
        try {
          await saveInvoice(row.payload);
          await saveInvoiceSourceFile(row.sourceFile, row.payload.invoiceno);
          saved += 1;
          if (row.payload.invoiceno) {
            savedInvoiceNos.push(row.payload.invoiceno);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : t('save_failed', 'Save failed');
          failed.push(`${row.payload.invoiceno || row.fileName}: ${msg}`);
        }
      }

      await onSuccess();
      const summary = t('import_completed', 'Import completed: Saved {0}, Skipped {1}')
        .replace('{0}', String(saved))
        .replace('{1}', String(skipped)) +
        (failed.length > 0 ? `，${t('failed', 'Failed')} ${failed.length}` : '');
      setImportMessage(summary);
      if (failed.length > 0) {
        const msg =
          t('partial_save_failed', 'Partial save failed: {0}')
            .replace('{0}', failed.slice(0, 3).join('；'));
        setError(msg);
        showWarning(msg);
      }
      if (saved > 0 && failed.length === 0) {
        setImportRows([]);
        showSuccess(t('import_save_success', 'Import saved successfully'));
      }

      if (nextAction === 'saveAndCreateReimbursement' && savedInvoiceNos.length > 0) {
        const payload = {
          invoiceNos: savedInvoiceNos,
          applicant: importUserId.trim(),
          travelFilterId: importTravelId.trim() || null,
          source: 'invoice-import',
          createdAt: Date.now(),
        };
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(REIMBURSEMENT_PREFILL_STORAGE_KEY, JSON.stringify(payload));
        }
        onClose();
        router.push('/pc/reimbursements?quickCreate=1');
      }
    } finally {
      setSavingImport(false);
    }
  };

  // Effect to update importRows when user/travel selection changes in the dialog
  useEffect(() => {
    if (!open || importRows.length === 0) {
      return;
    }

    setImportRows((prev) =>
      normalizeImportDrafts(
        prev.map((row) => {
          const nextPayload: InvoiceRecord = {
            ...row.payload,
            userid: importUserId.trim(),
            businesstype: businessType,
            status: 'open',
          };
          const travel = importTravelId.trim();
          if (travel) {
            nextPayload.travelid = travel;
          } else {
            delete nextPayload.travelid;
          }
          return { ...row, payload: nextPayload };
        }),
        existingInvoiceNoSet,
        t
      ).map((row) => {
         if (row.skipReason === 'Invoice No exists') {
            return { ...row, skipReason: t('invoice_no_exists', 'Invoice No exists') };
        }
        return row;
      })
    );
  }, [
    open,
    importRows.length, // Only re-run if length changes or deps change. Wait, this might be too aggressive if we edit rows.
    // Actually the original code had `importOpen` and `importRows.length` dependency.
    // But we also want to update when `importUserId` changes.
    // The original code re-normalized on EVERY render if dependencies changed?
    // No, `useEffect` runs when deps change.
    importUserId,
    businessType,
    importTravelId,
    existingInvoiceNoSet,
    t,
  ]);
  // Wait, if I edit a description in the table, `updateImportDraftPayload` updates `importRows`.
  // If `importRows` is a dependency, this effect runs again and might overwrite manual changes?
  // `prev.map` constructs new payload using `importUserId`.
  // If I manually changed description, it is preserved in `row.payload`.
  // `nextPayload` spreads `...row.payload` so manual changes are kept.
  // BUT `userid` and `travelid` are forcefully overwritten by the top-level selectors.
  // This seems to be the intended behavior in the original code: top-level selectors apply to ALL rows.

  const updateImportDraftPayload = useCallback(
    (rowId: string, patch: Partial<InvoiceRecord>) => {
      setImportRows((prev) =>
        prev.map((row) =>
          row.id === rowId ? { ...row, payload: { ...row.payload, ...patch } } : row,
        ),
      );
    },
    [],
  );

  const updateImportDraftDate = useCallback(
    (rowId: string, value: string) => {
      setImportRows((prev) =>
        normalizeImportDrafts(
          prev.map((row) =>
            row.id === rowId
              ? { ...row, payload: { ...row.payload, invoicedate: value } }
              : row,
          ),
          existingInvoiceNoSet,
          t,
        ),
      );
    },
    [existingInvoiceNoSet, t],
  );

  const importStats = useMemo(() => {
    const skipped = importRows.filter((row) => row.skipReason).length;
    return {
      total: importRows.length,
      skipped,
      savable: importRows.length - skipped,
    };
  }, [importRows]);

  const importTableRows = useMemo(
    () =>
      importRows.map((row) => {
        const hasIssue = Boolean(row.skipReason);
        const confidence =
          typeof row.raw?.confidence === 'number' && Number.isFinite(row.raw.confidence)
            ? row.raw.confidence
            : undefined;
        const isLowConfidence =
          confidence !== undefined && confidence < bookingRuleLowConfidenceThreshold;
        const cell = (value: unknown) => (
          <Typography
            component="span"
            sx={{
              color: hasIssue ? 'error.main' : 'inherit',
              fontWeight: hasIssue ? 600 : 400,
              fontSize: '0.82rem',
            }}
          >
            {toTrimmedString(value) || '-'}
          </Typography>
        );

        return {
          id: row.id,
          fileName: cell(row.fileName),
          invoiceno: cell(row.payload.invoiceno),
          description: (
            <TextField
              value={toInputString(row.payload.description)}
              onChange={(event) =>
                updateImportDraftPayload(row.id, { description: event.target.value })
              }
              size="small"
              fullWidth
              disabled={importParsing || savingImport}
              required
              error={toTrimmedString(row.payload.description).length === 0}
              sx={{
                minWidth: 200,
                '& .MuiInputBase-input': { fontSize: '0.82rem', py: 0.8 },
              }}
            />
          ),
          bookingcode: (
            <TextField
              value={toTrimmedString(row.payload.bookingcode)}
              onChange={(event) =>
                updateImportDraftPayload(row.id, { bookingcode: event.target.value })
              }
              size="small"
              fullWidth
              select
              disabled={importParsing || savingImport}
              sx={{
                minWidth: 180,
                '& .MuiInputBase-input': {
                  fontSize: '0.82rem',
                  py: 0.8,
                  color: isLowConfidence ? 'error.main' : 'inherit',
                },
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: isLowConfidence ? 'error.main' : undefined,
                },
              }}
            >
              <MenuItem value="">{t('none', '(None)')}</MenuItem>
              {bookingRuleOptions.map((option) => (
                <MenuItem key={option.code} value={option.code}>
                  {formatBookingRuleOption(option, lang)}
                </MenuItem>
              ))}
            </TextField>
          ),
          businesstype: cell(row.payload.businesstype),
          userid: cell(row.payload.userid),
          travelid: cell(row.payload.travelid),
          invoicedate: row.generatedInvoiceNo ? (
            <TextField
              type="date"
              value={toInputString(row.payload.invoicedate)}
              onChange={(event) => updateImportDraftDate(row.id, event.target.value)}
              size="small"
              fullWidth
              disabled={importParsing || savingImport}
              required
              InputLabelProps={{ shrink: true }}
              sx={{
                minWidth: 150,
                '& .MuiInputBase-input': { fontSize: '0.82rem', py: 0.8 },
              }}
            />
          ) : (
            cell(row.payload.invoicedate)
          ),
          totalnetamount: cell(row.payload.totalnetamount),
          taxamount: cell(row.payload.taxamount),
          grossamount: cell(row.payload.grossamount),
          currency: (
            <TextField
              value={toInputString(row.payload.currency).toUpperCase()}
              onChange={(event) =>
                updateImportDraftPayload(row.id, { currency: event.target.value.toUpperCase() })
              }
              size="small"
              fullWidth
              disabled={importParsing || savingImport}
              sx={{
                minWidth: 120,
                '& .MuiInputBase-input': { fontSize: '0.82rem', py: 0.8 },
              }}
            />
          ),
          originalamount: cell(row.payload.originalamount),
          supplier: cell(row.payload.supplier),
          comment: cell(row.payload.comment),
          originalcurrency: cell(row.payload.originalcurrency),
          status: cell(row.payload.status),
          checkResult: row.skipReason
            ? <Typography component="span" sx={{ color: 'error.main', fontWeight: 700, fontSize: '0.82rem' }}>{row.skipReason}</Typography>
            : <Typography component="span" sx={{ color: 'success.main', fontWeight: 700, fontSize: '0.82rem' }}>{t('ready_to_save', 'Ready to save')}</Typography>,
        };
      }),
    [
      importRows,
      importParsing,
      savingImport,
      updateImportDraftPayload,
      updateImportDraftDate,
      bookingRuleOptions,
      lang,
      t,
    ],
  );

  const importColumns = useMemo<any[]>(
    () => [
      { id: 'fileName', label: t('file', 'File'), minWidth: 180 },
      { id: 'invoiceno', label: t('invoice_no', 'Invoice No'), minWidth: 170 },
      { id: 'description', label: `${t('description', 'Description')} *`, minWidth: 220 },
      { id: 'bookingcode', label: t('booking_rule', 'Booking Rule'), minWidth: 180 },
      { id: 'businesstype', label: t('business_type', 'Business Type'), minWidth: 150 },
      { id: 'userid', label: t('user_id', 'User ID'), minWidth: 140 },
      { id: 'travelid', label: t('travel_id', 'Travel ID'), minWidth: 140 },
      { id: 'invoicedate', label: t('invoice_date', 'Invoice Date'), minWidth: 130 },
      { id: 'totalnetamount', label: t('net_amount', 'Net Amount'), minWidth: 120 },
      { id: 'taxamount', label: t('tax_amount', 'Tax Amount'), minWidth: 120 },
      { id: 'grossamount', label: t('gross_amount', 'Gross Amount'), minWidth: 120 },
      { id: 'originalamount', label: t('original_amount', 'Original Amount'), minWidth: 130 },
      { id: 'originalcurrency', label: t('original_currency', 'Original Currency'), minWidth: 130 },
      { id: 'currency', label: t('save_currency', 'Save Currency'), minWidth: 130 },
      { id: 'supplier', label: t('supplier', 'Supplier'), minWidth: 180 },
      { id: 'comment', label: t('comment', 'Comment'), minWidth: 180 },
      {
        id: 'status',
        label: t('status', 'Status'),
        minWidth: 100,
        render: (value: string) => statusLabel(normalizeWorkflowStatus(value), t),
      },
      { id: 'checkResult', label: t('check', 'Check'), minWidth: 180 },
    ],
    [t],
  );

  return (
    <Dialog
      open={open}
      onClose={closeImportDialog}
      fullWidth
      maxWidth={false}
      PaperProps={{
        sx: {
          width: 'min(1400px, 96vw)',
          height: 'min(88vh, 900px)',
          maxHeight: 'calc(100vh - 32px)',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <DialogTitle sx={{ flexShrink: 0 }}>
        {t('import_invoices_title', 'Bulk Import Invoices (PDF/Images)')}
      </DialogTitle>
      <DialogContent
        sx={{
          pt: 1,
          flex: '1 1 auto',
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Box
            sx={{
              border: importDragActive ? '2px dashed #1976d2' : '1px dashed rgba(25, 118, 210, 0.38)',
              borderRadius: 1.5,
              p: 2,
              bgcolor: importDragActive ? 'rgba(25, 118, 210, 0.08)' : 'rgba(25, 118, 210, 0.03)',
              transition: 'all 0.15s ease',
            }}
            onDrop={handleImportDrop}
            onDragOver={handleImportDragOver}
            onDragLeave={handleImportDragLeave}
          >
            <Stack spacing={1.5}>
              <Button component="label" variant="outlined" startIcon={<UploadFileRoundedIcon />} disabled={importParsing || savingImport}>
                {t('choose_invoice_files', 'Choose Invoice Files (Multiple)')}
                <input
                  hidden
                  type="file"
                  accept=".pdf,application/pdf,image/*"
                  multiple
                  onChange={handleImportFiles}
                />
              </Button>
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                {t('import_files_hint', 'Drag PDF or image files here. The system uses InvoiceProcessing to extract information.')}
              </Typography>
              <TextField
                label={t('user_id', 'User ID')}
                value={importUserId}
                onChange={(e) => setImportUserId(e.target.value)}
                fullWidth
                select
                disabled={userOptions.length === 0 || importParsing || savingImport}
                helperText={userOptions.length === 0 ? t('no_users_available', 'No users available, please create a user first') : t('apply_to_all_imported_invoices', 'Applied to all imported invoices')}
              >
                {userOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label={t('business_type', 'Business Type')}
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                fullWidth
                select
                required
                disabled={importParsing || savingImport}
                helperText={t('apply_to_all_imported_invoices', 'Applied to all imported invoices')}
              >
                {BUSINESS_TYPE_OPTIONS.map((option) => (
                  <MenuItem key={option.code} value={option.code}>
                    {formatBusinessTypeOption(option, t)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label={t('travel_id', 'Travel ID')}
                value={importTravelId}
                onChange={(e) => setImportTravelId(e.target.value)}
                fullWidth
                select
                disabled={travelOptions.length === 0 || importParsing || savingImport}
                helperText={travelOptions.length === 0 ? t('no_travel_available_import', 'No travel entries are available. You may import without one.') : t('optional_apply_to_all_imported_invoices', 'Optional. Applied to all imported invoices.')}
              >
                <MenuItem value="">{t('none', '(None)')}</MenuItem>
                {travelOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>
            <Typography sx={{ mt: 1.2, fontSize: 13, color: 'text.secondary' }}>
              {t('import_skippable_rows_hint', 'Upload files above. The system extracts information with InvoiceProcessing; red rows are skipped during saving.')}
            </Typography>
          </Box>

          <Alert severity="info">
            {t('import_stats', 'Total {0}; ready to save {1}; skipped {2}')
              .replace('{0}', String(importStats.total))
              .replace('{1}', String(importStats.savable))
              .replace('{2}', String(importStats.skipped))}
            {importMessage ? `；${importMessage}` : ''}
          </Alert>

          <Box
            sx={{
              height: 'min(48vh, 520px)',
              minHeight: 320,
              flex: '0 0 auto',
              minWidth: 0,
              overflow: 'hidden',
              '& .MuiToolbar-root': { display: 'none' },
            }}
          >
            <BusyTable
              appId="pc-invoices"
              busy={importParsing || savingImport}
              title={t('import_preview', 'Import Preview')}
              columns={importColumns}
              rows={importTableRows}
              rowKey="id"
              fullWidth
              fitContainer
              maxHeight="100%"
            />
          </Box>
        </Stack>
      </DialogContent>
      <InvoiceImportSummary rows={importRows} t={t} lang={lang} />
      <DialogActions>
        <Button onClick={closeImportDialog} disabled={importParsing || savingImport}>
          {t('close', 'Close')}
        </Button>
        <Button onClick={() => void saveImportedInvoices('saveOnly')} variant="contained" disabled={importParsing || savingImport}>
          {t('save_invoices_only', 'Save Invoices Only')}
        </Button>
        <Button
          onClick={() => void saveImportedInvoices('saveAndCreateReimbursement')}
          variant="contained"
          color="secondary"
          disabled={importParsing || savingImport}
        >
          {t('save_and_create_reimbursement', 'Save and Create Reimbursement')}
        </Button>
      </DialogActions>
      {messageBox}
    </Dialog>
  );
}
