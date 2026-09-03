'use client';

import { Grid, Paper, TextField, Typography } from '@mui/material';
import type { SupplierInvoiceHeader } from '@/services/Invoice/supplier-edit-model';

export function AdditionalHeaderFields({ value, disabled, onChange }: {
  value: SupplierInvoiceHeader;
  disabled?: boolean;
  onChange: (patch: Partial<SupplierInvoiceHeader>) => void;
}) {
  const field = (key: 'userid' | 'travelid' | 'originalcurrency') => ({
    value: value[key], disabled, fullWidth: true,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange({ [key]: event.target.value }),
  });
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography fontWeight={700} sx={{ mb: 2 }}>管理信息</Typography>
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, md: 3 }}><TextField required label="用户 ID" {...field('userid')} /></Grid>
        <Grid size={{ xs: 12, md: 3 }}><TextField label="差旅 ID" {...field('travelid')} /></Grid>
        <Grid size={{ xs: 12, md: 2 }}><TextField fullWidth label="原币金额" type="number" disabled={disabled}
          value={value.originalamount ?? ''} onChange={(e) => onChange({ originalamount: e.target.value === '' ? null : Number(e.target.value) })} /></Grid>
        <Grid size={{ xs: 12, md: 2 }}><TextField label="原始币种" {...field('originalcurrency')} /></Grid>
        <Grid size={{ xs: 12, md: 2 }}><TextField fullWidth label="状态" value={value.status}
          slotProps={{ input: { readOnly: true } }} helperText="由提交、记账流程更新" /></Grid>
      </Grid>
    </Paper>
  );
}
