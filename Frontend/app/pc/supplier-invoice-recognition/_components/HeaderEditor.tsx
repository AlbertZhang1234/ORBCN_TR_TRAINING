'use client';

import { Grid, MenuItem, Paper, TextField, Typography } from '@mui/material';
import type { EditableHeader } from './model';

export function HeaderEditor({ value, disabled, onChange }: {
  value: EditableHeader;
  disabled?: boolean;
  onChange: (patch: Partial<EditableHeader>) => void;
}) {
  const field = (key: keyof EditableHeader) => ({
    value: value[key] ?? '', disabled,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange({ [key]: event.target.value }),
  });
  const numberField = (key: 'totalnetamount' | 'taxamount' | 'grossamount') => ({
    value: value[key] ?? '', disabled, type: 'number' as const,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange({
      [key]: event.target.value === '' ? null : Number(event.target.value),
    }),
  });
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography fontWeight={700} sx={{ mb: 2 }}>发票抬头</Typography>
      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth required label="发票号码" {...field('invoiceno')} /></Grid>
        <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="供应商" {...field('supplier')} /></Grid>
        <Grid size={{ xs: 12, md: 2 }}><TextField fullWidth label="发票日期" type="date" slotProps={{ inputLabel: { shrink: true } }} {...field('invoicedate')} /></Grid>
        <Grid size={{ xs: 12, md: 2 }}>
          <TextField fullWidth select label="业务类型" {...field('businesstype')}>
            <MenuItem value="01">01 标准采购发票</MenuItem><MenuItem value="02">02 运费/后续借记</MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="描述" {...field('description')} /></Grid>
        <Grid size={{ xs: 12, md: 2 }}><TextField fullWidth label="记账规则" {...field('bookingcode')} /></Grid>
        <Grid size={{ xs: 12, md: 2 }}><TextField fullWidth label="币种" {...field('currency')} /></Grid>
        <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="备注" {...field('comment')} /></Grid>
        <Grid size={{ xs: 12, md: 2 }}><TextField fullWidth label="未税金额" {...numberField('totalnetamount')} /></Grid>
        <Grid size={{ xs: 12, md: 2 }}><TextField fullWidth label="税额" {...numberField('taxamount')} /></Grid>
        <Grid size={{ xs: 12, md: 2 }}><TextField fullWidth label="含税金额" {...numberField('grossamount')} /></Grid>
      </Grid>
    </Paper>
  );
}
