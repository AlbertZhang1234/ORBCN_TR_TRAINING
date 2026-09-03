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
      sx={{ mx: 3, px: 1.25, py: 0.5, flexShrink: 0, borderTop: 1, borderColor: 'divider', bgcolor: 'action.hover',
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right',
        fontSize: '0.75rem', lineHeight: 1.4 }}>
      <Stack direction="row" useFlexGap flexWrap="wrap" spacing={0.75} alignItems="baseline" justifyContent="flex-end">
        <Typography sx={{ fontSize: 'inherit', lineHeight: 'inherit', fontWeight: 600 }}>
          {t('import_amount_summary_count', 'Recognized total · {0} invoice(s)').replace('{0}', String(count))}
        </Typography>
        <Typography color="text.secondary" sx={{ fontSize: '0.6875rem', lineHeight: 1.4 }}>
          {t('import_amount_summary_hint', 'By original currency; failed and skipped invoices excluded. Before currency conversion.')}
        </Typography>
      </Stack>
      <Box sx={{ maxWidth: '100%', maxHeight: 'min(12vh, 96px)', overflow: 'auto', mt: 0.25 }}>
        {groups.length === 0 ? (
          <Typography color="text.secondary" sx={{ fontSize: 'inherit', lineHeight: 'inherit' }}>
            {t('import_amount_summary_empty', 'No successfully recognized, non-skipped invoices to total.')}
          </Typography>
        ) : <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, max-content)', columnGap: 1.5,
          rowGap: 0.125, width: 'max-content', ml: 'auto', alignItems: 'baseline' }}>
          {groups.map((group) => (
            <React.Fragment key={group.currency}>
              <Typography sx={{ fontSize: 'inherit', lineHeight: 'inherit', fontWeight: 600 }}>
                {group.currency || t('import_amount_summary_unknown_currency', 'Unknown currency')}
                {' · '}{t('import_amount_summary_invoices', '{0} invoice(s)').replace('{0}', String(group.count))}
              </Typography>
              {importAmountFields.map((field) => (
                <Typography key={field} sx={{ fontSize: 'inherit', lineHeight: 'inherit',
                  fontWeight: field === 'grossamount' ? 600 : 400, fontVariantNumeric: 'tabular-nums' }}>
                  {labels[field]}: {formatImportAmount(group.amounts[field], group.currency, lang)}
                </Typography>
              ))}
            </React.Fragment>
          ))}
        </Box>}
      </Box>
      {incomplete && (
        <Typography color="text.secondary" sx={{ fontSize: '0.6875rem', lineHeight: 1.4 }}>
          {t('import_amount_summary_incomplete', '— means an amount is missing or invalid; that total is unavailable.')}
        </Typography>
      )}
    </Box>
  );
}
