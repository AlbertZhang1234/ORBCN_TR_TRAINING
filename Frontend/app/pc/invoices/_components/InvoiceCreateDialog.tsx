
import { type ChangeEvent, type DragEvent, useEffect, useState } from 'react';
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
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import { saveInvoice } from '../../../../services/Invoice/save';
import { saveInvoiceSourceFile } from '../../../../services/Invoice/source';
import type { InvoiceRecord } from '../../../../services/Invoice/_shared';
import { useBookingRuleOptions } from '../../../../services/Invoice/useBookingRuleOptions';
import { formatBookingRuleOption } from '../../../../services/Invoice/booking-rules';
import {
  BUSINESS_TYPE_OPTIONS,
  DEFAULT_BUSINESS_TYPE,
  formatBusinessTypeOption,
} from '../../../../services/Invoice/business-types';
import { useMessageBox } from '../../_components/useMessageBox';
import { InvoiceDateField } from './InvoiceDateField';

interface Option {
  value: string;
  label: string;
}

interface InvoiceCreateDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  userOptions: Option[];
  travelOptions: Option[];
  t: (key: string, fallback: string) => string;
  lang: 'en' | 'zh';
  onOpenImport: () => void;
  defaultUserId?: string;
}

export default function InvoiceCreateDialog({
  open,
  onClose,
  onSuccess,
  userOptions,
  travelOptions,
  t,
  lang,
  onOpenImport,
  defaultUserId = '',
}: InvoiceCreateDialogProps) {
  const { showError, showSuccess, messageBox } = useMessageBox(t);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [userId, setUserId] = useState(defaultUserId);
  const [businessType, setBusinessType] = useState(DEFAULT_BUSINESS_TYPE);
  const [travelId, setTravelId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [totalNetAmount, setTotalNetAmount] = useState('');
  const [taxAmount, setTaxAmount] = useState('');
  const [grossAmount, setGrossAmount] = useState('');
  const [bookingCode, setBookingCode] = useState('');
  const [currency, setCurrency] = useState('CNY');
  const [originalAmount, setOriginalAmount] = useState('');
  const [originalCurrency, setOriginalCurrency] = useState('CNY');
  const [status, setStatus] = useState('open');
  const [description, setDescription] = useState('');
  const [comment, setComment] = useState('');
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceDragActive, setSourceDragActive] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const { options: bookingRuleOptions } = useBookingRuleOptions(bookingCode);

  const reportError = (message: string) => {
    setError(message);
    showError(message);
  };

  useEffect(() => {
    if (open) {
      setInvoiceNo('');
      setUserId(defaultUserId);
      setBusinessType(DEFAULT_BUSINESS_TYPE);
      setTravelId('');
      setInvoiceDate('');
      setTotalNetAmount('');
      setTaxAmount('');
      setGrossAmount('');
      setBookingCode('');
      setCurrency('CNY');
      setOriginalAmount('');
      setOriginalCurrency('CNY');
      setStatus('open');
      setDescription('');
      setComment('');
      setSourceFile(null);
      setSourceDragActive(false);
      setError('');
    }
  }, [open, defaultUserId]);

  const isSupportedSourceFile = (file: File) =>
    file.type === 'application/pdf' ||
    file.type.startsWith('image/') ||
    file.name.toLowerCase().endsWith('.pdf');

  const selectSourceFile = (file: File | undefined) => {
    if (!file) {
      return;
    }
    if (!isSupportedSourceFile(file)) {
      reportError(t('invoice_source_file_type_error', 'Please upload a PDF or image file'));
      return;
    }
    setSourceFile(file);
    setError('');
  };

  const handleSourceFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    selectSourceFile(event.target.files?.[0]);
    event.target.value = '';
  };

  const handleSourceDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setSourceDragActive(false);
    selectSourceFile(Array.from(event.dataTransfer.files ?? [])[0]);
  };

  const handleSourceDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!saving) {
      setSourceDragActive(true);
    }
  };

  const handleSourceDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setSourceDragActive(false);
    }
  };

  const buildSavePayload = (): InvoiceRecord => {
    const payload: InvoiceRecord = {
      invoiceno: invoiceNo.trim(),
      userid: userId.trim(),
      businesstype: businessType,
    };
    if (travelId.trim()) {
      payload.travelid = travelId.trim();
    }
    if (invoiceDate.trim()) {
      payload.invoicedate = invoiceDate.trim();
    }
    if (totalNetAmount.trim()) {
      payload.totalnetamount = Number(totalNetAmount);
    }
    if (taxAmount.trim()) {
      payload.taxamount = Number(taxAmount);
    }
    if (grossAmount.trim()) {
      payload.grossamount = Number(grossAmount);
    }
    if (bookingCode.trim()) {
      payload.bookingcode = bookingCode.trim();
    }
    payload.currency = currency.trim().toUpperCase() || 'CNY';
    if (originalAmount.trim()) {
      payload.originalamount = Number(originalAmount);
    }
    payload.originalcurrency = originalCurrency.trim().toUpperCase() || payload.currency || 'CNY';
    if (status.trim()) {
      payload.status = status.trim();
    }
    if (description.trim()) {
      payload.description = description.trim();
    }
    if (comment.trim()) {
      payload.comment = comment.trim();
    }
    return payload;
  };

  const handleSave = async () => {
    if (!invoiceNo.trim()) {
      reportError(t('please_enter_invoice_no', 'Please enter Invoice No'));
      return;
    }
    if (!userId.trim()) {
      reportError(t('please_enter_user_id', 'Please enter User ID'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = buildSavePayload();
      await saveInvoice(payload);
      if (sourceFile) {
        await saveInvoiceSourceFile(sourceFile, payload.invoiceno);
      }
      await onSuccess();
      showSuccess(t('invoice_created_success', 'Invoice created successfully'));
      handleClose();
    } catch (err) {
      reportError(err instanceof Error ? err.message : t('failed_create_invoice', 'Failed to create invoice'));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    onClose();
    // Optional: reset state after close animation?
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('create_invoice', 'Create Invoice')}</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
          {error && (
            <Box sx={{ color: 'error.main', mb: 1 }}>{error}</Box>
          )}
          <TextField
            label={t('invoice_no', 'Invoice No')}
            value={invoiceNo}
            onChange={(e) => setInvoiceNo(e.target.value)}
            fullWidth
            autoFocus
          />
          <TextField
            label={t('user_id', 'User ID')}
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            fullWidth
            select
            disabled={userOptions.length === 0}
            helperText={userOptions.length === 0 ? t('no_users_available', 'No users available, please create a user first') : undefined}
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
          >
            {BUSINESS_TYPE_OPTIONS.map((option) => (
              <MenuItem key={option.code} value={option.code}>
                {formatBusinessTypeOption(option, t)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={t('travel_id', 'Travel ID')}
            value={travelId}
            onChange={(e) => setTravelId(e.target.value)}
            fullWidth
            select
            disabled={travelOptions.length === 0}
            helperText={travelOptions.length === 0 ? t('no_travel_available', 'No travel entries available, please create a travel entry first') : undefined}
          >
            <MenuItem value="">{t('none', '(None)')}</MenuItem>
            {travelOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <InvoiceDateField
            label={t('invoice_date', 'Invoice Date')}
            value={invoiceDate}
            onChange={setInvoiceDate}
            lang={lang}
          />
          <TextField
            label={t('net_amount', 'Net Amount')}
            type="number"
            value={totalNetAmount}
            onChange={(e) => setTotalNetAmount(e.target.value)}
            fullWidth
            inputProps={{ step: '0.01' }}
          />
          <TextField
            label={t('tax_amount', 'Tax Amount')}
            type="number"
            value={taxAmount}
            onChange={(e) => setTaxAmount(e.target.value)}
            fullWidth
            inputProps={{ step: '0.01' }}
          />
          <TextField
            label={t('gross_amount', 'Gross Amount')}
            type="number"
            value={grossAmount}
            onChange={(e) => setGrossAmount(e.target.value)}
            fullWidth
            inputProps={{ step: '0.01' }}
          />
          <TextField
            label={t('booking_rule', 'Booking Rule')}
            value={bookingCode}
            onChange={(e) => setBookingCode(e.target.value)}
            fullWidth
            select
          >
            <MenuItem value="">{t('none', '(None)')}</MenuItem>
            {bookingRuleOptions.map((option) => (
              <MenuItem key={option.code} value={option.code}>
                {formatBookingRuleOption(option, lang)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={t('description', 'Description')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
          />
          <TextField
            label={t('comment', 'Comment')}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            fullWidth
          />
          <TextField
            label={t('currency', 'Currency')}
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            fullWidth
            helperText={t('invoice_currency_hint', 'Target currency for saving. Different original currencies are converted using the exchange rate.')}
          />
          <TextField
            label={t('original_amount', 'Original Amount')}
            type="number"
            value={originalAmount}
            onChange={(e) => setOriginalAmount(e.target.value)}
            fullWidth
            inputProps={{ step: '0.01' }}
          />
          <TextField
            label={t('original_currency', 'Original Currency')}
            value={originalCurrency}
            onChange={(e) => setOriginalCurrency(e.target.value.toUpperCase())}
            fullWidth
            helperText={t('original_currency_hint', 'Original currency shown on the invoice, for example CNY/EUR/USD/JPY')}
          />
          <TextField label={t('status', 'Status')} value={status} onChange={(e) => setStatus(e.target.value)} fullWidth />
          <Box
            sx={{
              border: sourceDragActive ? '2px dashed #1976d2' : '1px dashed rgba(25, 118, 210, 0.38)',
              borderRadius: 1,
              p: 1.5,
              bgcolor: sourceDragActive ? 'rgba(25, 118, 210, 0.08)' : 'rgba(25, 118, 210, 0.03)',
              transition: 'all 0.15s ease',
            }}
            onDrop={handleSourceDrop}
            onDragOver={handleSourceDragOver}
            onDragLeave={handleSourceDragLeave}
          >
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
                    {t('invoice_source_file', 'Invoice Source File')}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                    {t('invoice_source_file_hint', 'Upload one PDF or image for preview and reimbursement attachment')}
                  </Typography>
                </Box>
                <Button component="label" size="small" variant="outlined" startIcon={<UploadFileRoundedIcon />} disabled={saving}>
                  {t('select_file', 'Select File')}
                  <input hidden type="file" accept=".pdf,application/pdf,image/*" onChange={handleSourceFileChange} />
                </Button>
              </Stack>
              {sourceFile ? (
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{
                    minHeight: 36,
                    px: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    bgcolor: 'background.paper',
                  }}
                >
                  <InsertDriveFileRoundedIcon fontSize="small" color="action" />
                  <Typography sx={{ flex: 1, minWidth: 0, fontSize: 13 }} noWrap>
                    {sourceFile.name}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                    {(sourceFile.size / 1024).toFixed(1)} KB
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => setSourceFile(null)}
                    disabled={saving}
                    aria-label={t('remove_file', 'Remove file')}
                  >
                    <DeleteRoundedIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ) : (
                <Alert severity="info" sx={{ py: 0.25, '& .MuiAlert-message': { fontSize: 12 } }}>
                  {t('invoice_source_drop_hint', 'Drag a PDF or image here, or select a file manually.')}
                </Alert>
              )}
            </Stack>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onOpenImport} disabled={saving} startIcon={<UploadFileRoundedIcon />}>
          {t('import_invoices', 'Import Invoices')}
        </Button>
        <Button onClick={handleClose} disabled={saving}>
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
