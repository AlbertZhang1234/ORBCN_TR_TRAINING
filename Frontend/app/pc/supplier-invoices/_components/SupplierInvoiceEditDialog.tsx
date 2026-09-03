'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack } from '@mui/material';
import { supplierInvoiceEditApi } from '@/services/Invoice/supplier-edit';
import type { SupplierInvoiceDetail } from '@/services/Invoice/supplier-edit-model';
import { reconciliationWarnings, validateDraft } from '@/services/Invoice/supplier-draft-model';
import { isBookedStatus, isSubmittedStatus } from '@/services/_core/locks';
import { HeaderEditor } from '../../supplier-invoice-recognition/_components/HeaderEditor';
import { LineEditor } from '../../supplier-invoice-recognition/_components/LineEditor';
import InvoicePreviewDialog from '../../invoices/_components/InvoicePreviewDialog';
import { AdditionalHeaderFields } from './AdditionalHeaderFields';

export default function SupplierInvoiceEditDialog({ invoiceNo, onClose, onSaved, t }: {
  invoiceNo: string;
  onClose: () => void;
  onSaved: () => void;
  t: (key: string, fallback: string) => string;
}) {
  const [detail, setDetail] = useState<SupplierInvoiceDetail>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const [reload, setReload] = useState(0);
  const locked = detail && (isBookedStatus(detail.header.status) || isSubmittedStatus(detail.header.status));

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setDetail(undefined);
    supplierInvoiceEditApi.load(invoiceNo, controller.signal).then((value) => {
      if (!controller.signal.aborted) setDetail(value);
    }).catch((err) => {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : '加载发票失败');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [invoiceNo, reload]);

  const save = async () => {
    if (!detail || locked || savingRef.current) return;
    const errors = validateDraft(detail);
    if (errors.length) { setError(errors.join('；')); return; }
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      await supplierInvoiceEditApi.save(invoiceNo, detail);
      onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : '保存发票失败'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const close = () => { if (!savingRef.current) onClose(); };
  const patchHeader = (patch: Partial<SupplierInvoiceDetail['header']>) => {
    setDetail((current) => current && { ...current, header: { ...current.header, ...patch } });
  };

  return (
    <Dialog open onClose={close} fullWidth maxWidth="xl" aria-labelledby="supplier-invoice-edit-title"
      PaperProps={{ sx: { height: '90vh' } }}>
      <DialogTitle id="supplier-invoice-edit-title" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        {t('edit_invoice', 'Edit Invoice')} · {invoiceNo}
        <Button variant="outlined" onClick={() => setPreview(true)}>查看原始文件</Button>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          {error && <Alert severity="error" action={!detail && !loading
            ? <Button color="inherit" onClick={() => setReload((value) => value + 1)}>重试</Button> : undefined}>{error}</Alert>}
          {loading ? <Box sx={{ p: 6, textAlign: 'center' }}><CircularProgress aria-label="加载发票" /></Box> : detail && <>
            {locked && <Alert severity="warning">已提交或已记账的发票不能修改。</Alert>}
            {reconciliationWarnings(detail).map((warning) => <Alert key={warning} severity="warning">{warning}</Alert>)}
            <HeaderEditor value={detail.header} disabled={saving || locked} onChange={patchHeader} />
            <AdditionalHeaderFields value={detail.header} disabled={saving || locked} onChange={patchHeader} />
            <LineEditor lines={detail.lines} disabled={saving || locked}
              onChange={(lines) => setDetail((current) => current && { ...current, lines })} />
          </>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={close} disabled={saving}>{t('cancel', 'Cancel')}</Button>
        <Button variant="contained" onClick={() => void save()} disabled={loading || saving || !detail || locked}>
          {saving ? '保存中…' : t('save', 'Save')}
        </Button>
      </DialogActions>
      <InvoicePreviewDialog open={preview} onClose={() => setPreview(false)} invoiceNo={invoiceNo} t={t}
        sourceUrl={`/api/supplier-invoices/source?invoiceNo=${encodeURIComponent(invoiceNo)}`} />
    </Dialog>
  );
}
