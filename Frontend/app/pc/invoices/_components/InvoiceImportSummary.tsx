import React, { useMemo } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import type { ImportInvoiceDraft } from './shared';
import { formatImportAmount, importAmountFields, summarizeImportAmounts } from './invoice-import-summary';

interface InvoiceImportSummaryProps {
  rows: ImportInvoiceDraft[];
  t: (key: string, fallback: string) => string;
  lang: 'en' | 'zh';
}

export default function InvoiceImportSummary({ rows, t, lang }: InvoiceImportSummaryProps) {
  const groups = useMemo(() => summarizeImportAmounts(rows), [rows]);
  const count = groups.reduce((total, group) => total + group.count, 0);
  const labels = {
    totalnetamount: t('net_amount', 'Net Amount'),
    taxamount: t('tax_amount', 'Tax Amount'),
    grossamount: t('gross_amount', 'Gross Amount'),
  };
  const incomplete = groups.some((group) => importAmountFields.some((field) => group.amounts[field] === undefined));

  if (rows.length === 0) {
    return null;
  }

  return (
    <Box component="section" aria-label={t('import_amount_summary', 'Amount Summary')}
      sx={{ mx: 3, px: 2, py: 1.25, flexShrink: 0, borderTop: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
      <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1} alignItems="baseline">
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {t('import_amount_summary_count', 'Recognized total · {0} invoice(s)').replace('{0}', String(count))}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('import_amount_summary_hint', 'By original currency; failed and skipped invoices excluded. Before currency conversion.')}
        </Typography>
      </Stack>
      <Box sx={{ maxHeight: '18vh', overflowY: 'auto', mt: 0.75 }}>
        {groups.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('import_amount_summary_empty', 'No successfully recognized, non-skipped invoices to total.')}
          </Typography>
        ) : groups.map((group) => (
          <Box key={group.currency} sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 3, rowGap: 0.5, py: 0.25 }}>
            <Typography variant="body2" sx={{ minWidth: 112, fontWeight: 600 }}>
              {group.currency || t('import_amount_summary_unknown_currency', 'Unknown currency')}
              {' · '}{t('import_amount_summary_invoices', '{0} invoice(s)').replace('{0}', String(group.count))}
            </Typography>
            {importAmountFields.map((field) => (
              <Typography key={field} variant="body2" sx={{ fontWeight: field === 'grossamount' ? 600 : 400, fontVariantNumeric: 'tabular-nums' }}>
                {labels[field]}: {formatImportAmount(group.amounts[field], group.currency, lang)}
              </Typography>
            ))}
          </Box>
        ))}
      </Box>
      {incomplete && (
        <Typography variant="caption" color="text.secondary">
          {t('import_amount_summary_incomplete', '— means an amount is missing or invalid; that total is unavailable.')}
        </Typography>
      )}
    </Box>
  );
}
