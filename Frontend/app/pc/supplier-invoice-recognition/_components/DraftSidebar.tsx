'use client';

import { Box, Chip, List, ListItemButton, ListItemText, Paper, Typography } from '@mui/material';
import type { SupplierInvoiceDraft } from './model';

const labels = {
  queued: ['排队中', 'info'],
  recognizing: ['识别中', 'info'], ready: ['待检查', 'warning'], editing: ['编辑中', 'primary'],
  confirmed: ['已确认', 'success'], saving: ['保存中', 'info'], saved: ['已保存', 'success'], error: ['有错误', 'error'],
} as const;

export function DraftSidebar({ drafts, selectedId, onSelect }: {
  drafts: SupplierInvoiceDraft[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <Paper variant="outlined" sx={{ width: 270, flexShrink: 0, overflow: 'auto' }}>
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography fontWeight={700}>发票任务（{drafts.length}）</Typography>
        <Typography variant="caption" color="text.secondary">未完成 {drafts.filter((row) => row.status !== 'saved').length} · 最近已保存 {drafts.filter((row) => row.status === 'saved').length}</Typography>
      </Box>
      <List disablePadding>
        {drafts.map((draft) => {
          const label = labels[draft.status];
          return (
            <ListItemButton key={draft.id} selected={draft.id === selectedId} onClick={() => onSelect(draft.id)}>
              <ListItemText
                primary={draft.header.invoiceno || draft.filename}
                secondary={draft.filename}
                primaryTypographyProps={{ noWrap: true, fontWeight: 600 }}
                secondaryTypographyProps={{ noWrap: true }}
              />
              <Chip size="small" label={label[0]} color={label[1]} />
            </ListItemButton>
          );
        })}
      </List>
    </Paper>
  );
}
