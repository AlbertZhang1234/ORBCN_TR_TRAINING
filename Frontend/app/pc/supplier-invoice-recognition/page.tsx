'use client';

import { useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { useSupplierDrafts } from '../_components/SupplierDraftProvider';
import { usePcI18n } from '../_components/PcI18nProvider';
import InvoicePreviewDialog from '../invoices/_components/InvoicePreviewDialog';
import { DraftSidebar } from './_components/DraftSidebar';
import { HeaderEditor } from './_components/HeaderEditor';
import { LineEditor } from './_components/LineEditor';
import { nextEditableIndex, reconciliationWarnings, type SupplierBusinessType } from './_components/model';

export default function SupplierInvoiceRecognitionPage() {
  const input = useRef<HTMLInputElement>(null);
  const { t } = usePcI18n();
  const { store, drafts, busy, dirty, uploading, loading, error } = useSupplierDrafts();
  const [selectedId, setSelectedId] = useState<string>();
  const [uploadType, setUploadType] = useState<SupplierBusinessType>('01');
  const [preview, setPreview] = useState(false);
  const [notice, setNotice] = useState('');
  const [savingAll, setSavingAll] = useState(false);
  const selected = drafts.find((row) => row.id === selectedId) ?? drafts[0];
  const recognizing = selected && ['queued','recognizing'].includes(selected.status);
  const disabled = savingAll || !selected || recognizing || selected.status === 'saved' || busy.includes(selected.id);

  const act = async (action: 'confirm'|'save'|'retry') => {
    if (!selected) return;
    if (action === 'retry' && !window.confirm('重新识别会替换当前草稿中的抬头和行项目，是否继续？')) return;
    try {
      await store.action(selected.id, action);
      setNotice(action === 'save' ? '发票及行项目已正式保存，原文件可在管理页查看。'
        : action === 'retry' ? '已重新加入识别队列。' : '当前发票已确认并保存草稿。');
      if (action === 'confirm') {
        const rows = store.getSnapshot().drafts;
        setSelectedId(rows[nextEditableIndex(rows, rows.findIndex((row) => row.id === selected.id))]?.id);
      }
    } catch { /* The shared store displays the server error, including after navigation. */ }
  };
  const saveAll = async () => {
    setSavingAll(true);
    let saved = 0;
    const targets = drafts.filter((row) => row.status === 'confirmed');
    for (const row of targets) {
      if (store.getSnapshot().drafts.find((item) => item.id === row.id)?.status !== 'confirmed') continue;
      try { await store.action(row.id, 'save'); saved += 1; } catch { /* Continue independent invoices. */ }
    }
    setSavingAll(false);
    setNotice(`已保存 ${saved} / ${targets.length} 张已确认发票。`);
  };
  return (
    <Stack spacing={1.5} sx={{ height: '100%', minHeight: 0 }}>
      <Paper variant="outlined" sx={{ p: 1.5 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
          <Typography fontWeight={700} sx={{ mr: 'auto' }}>供应商发票上传与识别</Typography>
          <TextField select size="small" label="上传业务类型" value={uploadType} onChange={(e) => setUploadType(e.target.value as SupplierBusinessType)} sx={{ minWidth: 190 }}>
            <MenuItem value="01">01 标准采购发票</MenuItem><MenuItem value="02">02 运费/后续借记</MenuItem>
          </TextField>
          <input ref={input} hidden multiple type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            void store.upload(files, uploadType);
          }} />
          <Button variant="contained" startIcon={<CloudUploadRoundedIcon />} onClick={() => input.current?.click()}>批量上传识别</Button>
          <Button startIcon={<SaveRoundedIcon />} disabled={savingAll || !drafts.some((row) => row.status === 'confirmed')} onClick={() => void saveAll()}>保存全部已确认</Button>
        </Stack>
      </Paper>
      <Alert severity={uploading || dirty.length ? 'warning' : 'info'}>
        {uploading ? `正在上传 ${uploading} 个文件，请勿刷新或关闭浏览器；切换功能页面不影响上传。`
          : dirty.length ? '草稿正在同步到服务器，请勿刷新或关闭浏览器；可以切换功能页面。'
          : '上传成功的文件、识别状态和草稿已保存到服务器，可以安全切换页面或刷新。'}
      </Alert>
      {notice && <Alert severity="success" onClose={() => setNotice('')}>{notice}</Alert>}
      {error && selected && <Alert severity="error" action={<Button color="inherit" onClick={() => {
        if (window.confirm('将放弃这张发票尚未同步的本地改动，加载服务器草稿，是否继续？')) void store.reload(selected.id);
      }}>重新加载草稿</Button>}>{error}</Alert>}
      <Box sx={{ display: 'flex', gap: 1.5, flex: 1, minHeight: 0 }}>
        <DraftSidebar drafts={drafts} selectedId={selected?.id} onSelect={setSelectedId} />
        <Box sx={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
          {!selected ? <Paper variant="outlined" sx={{ p: 6, textAlign: 'center' }}>
            {loading ? <CircularProgress /> : <Typography color="text.secondary">请先上传发票文件</Typography>}
          </Paper> : <Stack spacing={1.5}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography sx={{ flex: 1 }}>{selected.filename}</Typography>
              <Button variant="outlined" onClick={() => setPreview(true)}>查看原始文件</Button>
            </Stack>
            {selected.error && <Alert severity="error">{selected.error}</Alert>}
            {recognizing ? <Paper variant="outlined" sx={{ p: 6, textAlign: 'center' }}>
              <CircularProgress size={30} /><Typography sx={{ mt: 2 }}>{selected.status === 'queued' ? '已上传，等待后台识别' : '后台正在识别'}，可以离开此页面。</Typography>
            </Paper> : <>
              {reconciliationWarnings(selected).map((warning) => <Alert key={warning} severity="warning">{warning}</Alert>)}
              <HeaderEditor value={selected.header} disabled={disabled} onChange={(patch) => store.edit(selected.id, { header: { ...selected.header, ...patch } })} />
              <LineEditor lines={selected.lines} disabled={disabled} onChange={(lines) => store.edit(selected.id, { lines })} />
              <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ pb: 2 }}>
                <Typography sx={{ mr: 'auto', alignSelf: 'center' }} color="text.secondary">{dirty.includes(selected.id) ? '草稿同步中…' : selected.status === 'saved' ? '已正式保存' : '草稿已自动保存'}</Typography>
                <Button disabled={disabled} onClick={() => void act('retry')}>重新识别</Button>
                <Button disabled={disabled} onClick={() => void act('save')}>保存当前</Button>
                <Button variant="contained" disabled={disabled} onClick={() => void act('confirm')}>确认并下一张</Button>
              </Stack>
            </>}
          </Stack>}
        </Box>
      </Box>
      <InvoicePreviewDialog open={preview && Boolean(selected)} onClose={() => setPreview(false)}
        invoiceNo={selected?.header.invoiceno || selected?.filename || ''} t={t}
        sourceUrl={selected ? `/api/supplier-invoices/source?draftId=${encodeURIComponent(selected.id)}` : undefined} />
    </Stack>
  );
}
