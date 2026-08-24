import type React from 'react';
import type {
  CTableProps as OrbcafeCTableProps,
  CTableBodyProps as OrbcafeCTableBodyProps,
  CTableCellProps as OrbcafeCTableCellProps,
  CTableContainerProps as OrbcafeCTableContainerProps,
  CTableHeadProps as OrbcafeCTableHeadProps,
  CTableRowProps as OrbcafeCTableRowProps,
  CSmartFilterProps,
} from 'orbcafe-ui';

export interface HeadCell {
  id: string;
  label: string;
  minWidth?: number;
  width?: number;
  align?: 'right' | 'left' | 'center';
  numeric?: boolean;
  render?: (value: any, row: any) => React.ReactNode;
  renderCell?: (row: any) => React.ReactNode;
  getGroupValue?: (row: any) => string | number;
}

export interface GroupNode {
  key: string;
  field: string;
  value: any;
  children: GroupNode[] | any[];
  count: number;
  id: string;
  level: number;
  isGroup: true;
  aggregates?: Record<string, number>;
}

export interface TableLayout {
  visibleColumns: string[];
  order: 'asc' | 'desc';
  orderBy: string;
  grouping: string[];
  showSummary: boolean;
  summaryColumns?: string[];
}

export type CTableProps = OrbcafeCTableProps & {
  filterConfig?: CSmartFilterProps;
  layout?: TableLayout | null;
  onLayoutSave?: (layout: TableLayout) => void;
};

export type CTableBodyProps = OrbcafeCTableBodyProps;
export type CTableCellProps = OrbcafeCTableCellProps;
export type CTableContainerProps = OrbcafeCTableContainerProps;
export type CTableHeadProps = OrbcafeCTableHeadProps;
export type CTableRowProps = OrbcafeCTableRowProps;
