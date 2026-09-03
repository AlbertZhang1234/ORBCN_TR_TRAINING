'use client';

import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import { Box, Button, IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import type { EditableLine } from './model';

const newKey = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
const emptyLine = (): EditableLine => ({ key: newKey(), description: '', spec_model: '', unit_price: null, quantity: null, amount_excl_tax: null, tax_rate: '', amount_incl_tax: null });
const numberValue = (value: string) => value === '' ? null : Number(value);

export function LineEditor({ lines, disabled, onChange }: {
  lines: EditableLine[];
  disabled?: boolean;
  onChange: (lines: EditableLine[]) => void;
}) {
  const patch = (index: number, next: Partial<EditableLine>) => onChange(lines.map((line, i) => i === index ? { ...line, ...next } : line));
  const numberInput = (index: number, key: keyof EditableLine, value: number | null) => (
    <TextField size="small" type="number" value={value ?? ''} disabled={disabled}
      onChange={(event) => patch(index, { [key]: numberValue(event.target.value) })} />
  );
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography fontWeight={700}>发票行项目</Typography>
        <Button size="small" startIcon={<AddRoundedIcon />} disabled={disabled} onClick={() => onChange([...lines, emptyLine()])}>新增行</Button>
      </Box>
      <TableContainer>
        <Table size="small" sx={{ minWidth: 1050 }}>
          <TableHead><TableRow>
            <TableCell width={55}>序号</TableCell><TableCell>项目名称</TableCell><TableCell>规格型号</TableCell>
            <TableCell>数量</TableCell><TableCell>单价</TableCell><TableCell>未税金额</TableCell>
            <TableCell>税率</TableCell><TableCell>含税金额</TableCell><TableCell width={90}>操作</TableCell>
          </TableRow></TableHead>
          <TableBody>{lines.map((line, index) => (
            <TableRow key={line.key}>
              <TableCell>{index + 1}</TableCell>
              <TableCell><TextField required size="small" value={line.description} disabled={disabled} onChange={(e) => patch(index, { description: e.target.value })} /></TableCell>
              <TableCell><TextField size="small" value={line.spec_model} disabled={disabled} onChange={(e) => patch(index, { spec_model: e.target.value })} /></TableCell>
              <TableCell>{numberInput(index, 'quantity', line.quantity)}</TableCell>
              <TableCell>{numberInput(index, 'unit_price', line.unit_price)}</TableCell>
              <TableCell>{numberInput(index, 'amount_excl_tax', line.amount_excl_tax)}</TableCell>
              <TableCell><TextField size="small" value={line.tax_rate} disabled={disabled} onChange={(e) => patch(index, { tax_rate: e.target.value })} /></TableCell>
              <TableCell>{numberInput(index, 'amount_incl_tax', line.amount_incl_tax)}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                <IconButton size="small" disabled={disabled} onClick={() => onChange([...lines.slice(0, index + 1), { ...line, key: newKey() }, ...lines.slice(index + 1)])}><ContentCopyRoundedIcon fontSize="small" /></IconButton>
                <IconButton size="small" color="error" disabled={disabled} onClick={() => onChange(lines.filter((_, i) => i !== index))}><DeleteRoundedIcon fontSize="small" /></IconButton>
              </TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
