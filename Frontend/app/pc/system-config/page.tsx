'use client';
import { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import { useRouter } from 'next/navigation';
import { getSessionUser } from '../_components/session';
import { usePcI18n } from '../_components/PcI18nProvider';
import { PcContentLayout } from '../_components/PcContentLayout';
import { loadSystemConfig, saveSystemConfig } from '@/services/SystemConfig/client';
import { defaultRecognitionSettings, validateRecognitionSettings, type RecognitionSettings, type SystemConfigSnapshot } from '@/services/SystemConfig/model';
import { SettingsFields } from './SettingsFields';

export default function SystemConfigPage() {
  const router = useRouter();
  const { lang } = usePcI18n();
  const zh = lang === 'zh';
  const [snapshot, setSnapshot] = useState<SystemConfigSnapshot | null>(null);
  const [values, setValues] = useState<RecognitionSettings>({ ...defaultRecognitionSettings });
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const dirty = Boolean(snapshot && JSON.stringify(values) !== JSON.stringify(snapshot.values));
  const accept = (next: SystemConfigSnapshot) => { setSnapshot(next); setValues(next.values); setError(''); };
  const reload = async () => {
    setBusy(true); setSaved(false);
    try { accept(await loadSystemConfig()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load settings'); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    if (!getSessionUser()?.permissions?.isAdmin) { router.replace('/pc'); return; }
    void reload();
  }, [router]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const save = async () => {
    if (!snapshot) return;
    setBusy(true); setSaved(false); setError('');
    try { accept(await saveSystemConfig(validateRecognitionSettings(values), snapshot.version)); setSaved(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save settings'); }
    finally { setBusy(false); }
  };
  return <PcContentLayout><Box sx={{ maxWidth: 1040, mx: 'auto', p: { xs: 1, md: 3 } }}>
    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
      <Typography variant="h5" component="h1">{zh ? '系统配置' : 'System Configuration'}</Typography>
      <Button variant="contained" disabled={busy || !dirty} onClick={() => void save()}>{zh ? '保存配置' : 'Save settings'}</Button>
    </Stack>
    <Typography color="text.secondary" sx={{ mb: 2 }}>{zh
      ? '发票识别参数由所有用户共用。保存后对新任务生效，正在处理的任务继续使用开始时的参数。'
      : 'Invoice recognition settings apply to all users. Saved settings affect new tasks; active tasks keep their original parameters.'}</Typography>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {saved && <Alert severity="success" sx={{ mb: 2 }}>{zh ? '配置已保存' : 'Settings saved'}</Alert>}
    {busy && !snapshot ? <CircularProgress aria-label={zh ? '加载配置' : 'Loading settings'} /> : null}
    {snapshot && <Stack spacing={3}>
      {[['batch', zh ? '批量处理' : 'Batch processing'], ['timeout', zh ? '超时与重试' : 'Timeouts and retries'],
        ['image', zh ? '文件与图片' : 'Files and images']].map(([group, title]) => <Paper key={group} variant="outlined" sx={{ p: 3 }}>
          <Typography variant="h6" component="h2" sx={{ mb: 3 }}>{title}</Typography>
          <SettingsFields group={group} values={values} disabled={busy} lang={lang}
            change={(key, value) => { setValues((current) => ({ ...current, [key]: value })); setSaved(false); }} />
        </Paper>)}
      <Alert severity="info">{zh
        ? '识别日志统一保存到 Backend/log，记录排队、预处理、模型调用与总耗时。模型地址和密钥沿用服务端部署配置。'
        : 'Recognition logs are stored in Backend/log and include queue, preprocessing, model and total timings. Model endpoint and credentials use server deployment settings.'}</Alert>
    </Stack>}
    <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
      <Button disabled={busy} onClick={() => void reload()}>{zh ? '重新加载（放弃未保存修改）' : 'Reload (discard unsaved changes)'}</Button>
      <Button disabled={busy || !snapshot} onClick={() => { setValues({ ...defaultRecognitionSettings }); setSaved(false); }}>
        {zh ? '填入默认值' : 'Use default values'}</Button>
    </Stack>
  </Box></PcContentLayout>;
}
