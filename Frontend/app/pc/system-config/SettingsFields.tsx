'use client';
import { Box, FormControlLabel, Switch, TextField, Typography } from '@mui/material';
import { recognitionFields, type RecognitionSettings } from '@/services/SystemConfig/model';

interface Props {
  group: string;
  values: RecognitionSettings;
  disabled: boolean;
  lang: 'en' | 'zh';
  change: (key: keyof RecognitionSettings, value: number | boolean) => void;
}
export function SettingsFields({ group, values, disabled, lang, change }: Props) {
  return <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
    {Object.entries(recognitionFields).filter(([, field]) => field.group === group).map(([name, field]) => {
      const key = name as keyof RecognitionSettings;
      const label = lang === 'zh' ? field.zh : field.en;
      const hint = lang === 'zh' ? field.hint_zh : field.hint_en;
      return typeof field.default === 'boolean' ? <Box key={key}>
        <FormControlLabel label={label} control={<Switch disabled={disabled} checked={Boolean(values[key])}
          onChange={(_, checked) => change(key, checked)} />} />
        <Typography variant="caption" color="text.secondary" display="block">{hint}</Typography>
      </Box> : <TextField key={key} label={label} type="number" fullWidth disabled={disabled}
        value={Number.isNaN(values[key]) ? '' : values[key]}
        inputProps={{ min: 'min' in field ? field.min : undefined, max: 'max' in field ? field.max : undefined, step: 1 }}
        helperText={`${hint} ${'min' in field ? `${field.min}–${field.max}` : ''}`}
        onChange={(event) => change(key, event.target.value === '' ? NaN : Number(event.target.value))} />;
    })}
  </Box>;
}
