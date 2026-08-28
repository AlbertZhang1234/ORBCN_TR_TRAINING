
import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
} from '@mui/material';
import { saveInvoice } from '../../../../services/Invoice/save';
import type { InvoiceRecord } from '../../../../services/Invoice/_shared';
import type { InvoiceListRow } from '../../../../services/Invoice/list';
import { useBookingRuleOptions } from '../../../../services/Invoice/useBookingRuleOptions';
import { formatBookingRuleOption } from '../../../../services/Invoice/booking-rules';
import {
  BUSINESS_TYPE_OPTIONS,
  DEFAULT_BUSINESS_TYPE,
  formatBusinessTypeOption,
} from '../../../../services/Invoice/business-types';
import { readStatus } from './shared';
import { useMessageBox } from '../../_components/useMessageBox';
import { InvoiceDateField } from './InvoiceDateField';

interface Option {
  value: string;
  label: string;
}

interface InvoiceEditDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  userOptions: Option[];
  travelOptions: Option[];
  t: (key: string, fallback: string) => string;
  lang: 'en' | 'zh';
  initialData: InvoiceListRow | null;
}

export default function InvoiceEditDialog({
  open,
  onClose,
  onSuccess,
  userOptions,
  travelOptions,
  t,
  lang,
  initialData,
}: InvoiceEditDialogProps) {
  const { showError, showSuccess, messageBox } = useMessageBox(t);
  const [invoiceNo, setInvoiceNo] = useState('');
  const [userId, setUserId] = useState('');
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
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const { options: bookingRuleOptions } = useBookingRuleOptions(bookingCode);

  const reportError = (message: string) => {
    setError(message);
    showError(message);
  };

  useEffect(() => {
    if (open && initialData) {
      setInvoiceNo(String(initialData.invoiceno ?? ''));
      setUserId(String(initialData.userid ?? ''));
      setBusinessType(String(initialData.businesstype ?? DEFAULT_BUSINESS_TYPE));
      setTravelId(String(initialData.travelid ?? ''));
      setInvoiceDate(String(initialData.invoicedate ?? ''));
      setTotalNetAmount(
        initialData.totalnetamount === null || initialData.totalnetamount === undefined
          ? ''
          : String(initialData.totalnetamount),
      );
      setTaxAmount(
        initialData.taxamount === null || initialData.taxamount === undefined
          ? ''
          : String(initialData.taxamount),
      );
      setGrossAmount(
        initialData.grossamount === null || initialData.grossamount === undefined
          ? ''
          : String(initialData.grossamount),
      );
      setBookingCode(String(initialData.bookingcode ?? ''));
      setCurrency(String(initialData.currency ?? 'CNY'));
      setOriginalAmount(
        initialData.originalamount === null || initialData.originalamount === undefined
          ? ''
          : String(initialData.originalamount),
      );
      setOriginalCurrency(String(initialData.originalcurrency ?? initialData.currency ?? 'CNY'));
      setStatus(readStatus(initialData) || 'open');
      setDescription(String(initialData.description ?? ''));
      setComment(String(initialData.comment ?? ''));
      setError('');
    }
  }, [open, initialData]);

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
    setSaving(true);
    setError('');
    try {
      await saveInvoice(buildSavePayload());
      await onSuccess();
      showSuccess(t('invoice_saved_success', 'Invoice saved successfully'));
      onClose();
    } catch (err) {
      reportError(err instanceof Error ? err.message : t('failed_change_invoice', 'Failed to change invoice'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('edit_invoice', 'Edit Invoice')}</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
          {error && <Box sx={{ color: 'error.main', mb: 1 }}>{error}</Box>}
          <TextField label={t('invoice_no', 'Invoice No')} value={invoiceNo} fullWidth disabled />
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
