'use client';

import { Box } from '@mui/material';
import {
  CSmartFilter as UiCSmartFilter,
  type CSmartFilterProps,
  type FilterField,
  type FilterOperator,
  type FilterType,
  type FilterValue,
  type TextOperator,
  type NumberOperator,
  type DateOperator,
} from 'orbcafe-ui';

export const CSmartFilter = (props: CSmartFilterProps) => (
  <Box
    sx={{
      '& button.MuiButton-contained': {
        minWidth: 96,
        px: 2,
        whiteSpace: 'nowrap',
        writingMode: 'horizontal-tb',
        lineHeight: 1.1,
        textAlign: 'center',
      },
      '& button.MuiButton-contained .MuiButton-label, & button.MuiButton-contained span': {
        whiteSpace: 'nowrap',
      },
    }}
  >
    <UiCSmartFilter {...props} />
  </Box>
);

export type {
  CSmartFilterProps,
  FilterField,
  FilterOperator,
  FilterType,
  FilterValue,
  TextOperator,
  NumberOperator,
  DateOperator,
};
