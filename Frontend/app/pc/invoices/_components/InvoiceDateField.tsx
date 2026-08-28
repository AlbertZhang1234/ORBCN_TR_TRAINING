'use client';

import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

interface InvoiceDateFieldProps {
  label: string;
  lang: 'en' | 'zh';
  value: string;
  onChange: (value: string) => void;
}

export function InvoiceDateField({ label, lang, value, onChange }: InvoiceDateFieldProps) {
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={lang === 'zh' ? 'zh-cn' : 'en'}>
      <DatePicker
        label={label}
        value={value ? dayjs(value) : null}
        onChange={(date) => onChange(date?.format('YYYY-MM-DD') ?? '')}
        format={lang === 'zh' ? 'YYYY/MM/DD' : 'MM/DD/YYYY'}
        slotProps={{ textField: { fullWidth: true } }}
      />
    </LocalizationProvider>
  );
}
