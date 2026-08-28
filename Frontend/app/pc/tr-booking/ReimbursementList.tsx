import { useMemo } from 'react';
import SharedReimbursementList from '../reimbursements/ReimbursementList';
import {
  listReimbursementLines,
  type ReimbursementListRow,
} from '../../../services/TravelReimbursement/list';
import type { ProjectListRow } from '../../../services/Projects/list';
import { listInvoices } from '../../../services/Invoice/list';
import { normalizeWorkflowStatus } from '../../../services/_core/locks';
import {
  readApprovalStatus,
  readApprover,
  readBookingStatus,
  readCreatedAt,
  toFilter,
} from './helpers';

function statusLabel(
  status: ReturnType<typeof normalizeWorkflowStatus>,
  t: (key: string, fallback: string) => string,
  rawStatus?: string,
): string {
  if (String(rawStatus ?? '').trim() === '已回传SAP系统') {
    return t('booking_status_sap_posted', '已回传SAP系统');
  }
  if (status === 'WAIT FOR APPROVAL') {
    return t('stat_wait_approval', 'Waiting');
  }
  if (status === 'APPROVED' || status === 'BOOKED') {
    return t('stat_approved', 'Approved');
  }
  if (status === 'REJECTED') {
    return t('rejected', 'Rejected');
  }
  if (status === 'SUBMITTED') {
    return t('submitted', 'Submitted');
  }
  return t('pending', 'Pending');
}

function parseAmount(value: unknown): number | '' {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const numeric = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(numeric) ? numeric : '';
}

function formatBoolean(value: unknown, t: (key: string, fallback: string) => string): string {
  if (value === true || value === 1 || value === '1') {
    return t('yes', 'Yes');
  }
  if (value === false || value === 0 || value === '0') {
    return t('no', 'No');
  }
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['true', 't', 'yes', 'y', '是'].includes(normalized)) {
    return t('yes', 'Yes');
  }
  if (['false', 'f', 'no', 'n', '否'].includes(normalized)) {
    return t('no', 'No');
  }
  return '';
}

function toExportTimestamp(now: Date): string {
  const pad = (num: number) => String(num).padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');
}

type BookingRow = ReimbursementListRow & {
  _bookingstatus: string;
  _approvalstatus: string;
  _approver: string;
  _createdAt: string;
  _key: string;
};

interface ReimbursementListProps {
  rows: ReimbursementListRow[];
  projects: ProjectListRow[];
  loading: boolean;
  selected: string[];
  onSelectionChange: (ids: string[]) => void;
  onBook: () => void;
  onSapBook: () => void;
  onDetail: (row: ReimbursementListRow) => void;
  t: (key: string, defaultVal: string) => string;
}

export default function ReimbursementList({
  rows,
  projects,
  loading,
  selected,
  onSelectionChange,
  onBook,
  onSapBook,
  onDetail,
  t,
}: ReimbursementListProps) {
  const selectedRows = useMemo<BookingRow[]>(
    () => {
      const keySet = new Set(selected.map((item) => String(item)));
      return rows
        .map((row) => ({
          ...row,
          _bookingstatus: readBookingStatus(row),
          _approvalstatus: readApprovalStatus(row),
          _approver: readApprover(row),
          _createdAt: readCreatedAt(row),
          _key: String(row.id ?? row.trno ?? ''),
        }))
        .filter((row) => keySet.has(row._key));
    },
    [rows, selected],
  );

  const exportData = async () => {
    if (typeof window === 'undefined' || selectedRows.length === 0) {
      return;
    }

    const { Workbook } = await import('exceljs');
    const summaryColumns = [
      { label: t('id', 'ID'), read: (row: BookingRow) => row.id ?? '' },
      { label: t('reimbursement_id', 'Reimbursement ID'), read: (row: BookingRow) => row.trno ?? '' },
      { label: t('applicant', 'Applicant'), read: (row: BookingRow) => row.userid ?? '' },
      { label: t('created_at', 'Created At'), read: (row: BookingRow) => row._createdAt },
      {
        label: t('booking_status', 'Booking Status'),
        read: (row: BookingRow) => statusLabel(normalizeWorkflowStatus(row._bookingstatus), t, row._bookingstatus),
      },
      {
        label: t('approval_status', 'Approval Status'),
        read: (row: BookingRow) => statusLabel(normalizeWorkflowStatus(row._approvalstatus), t),
      },
      { label: t('approver', 'Approver'), read: (row: BookingRow) => row._approver },
      { label: t('reimbursement_amount', 'Reimbursement Amount'), read: (_row: BookingRow) => '' },
    ] as const;

    const workbook = new Workbook();
    workbook.creator = 'ORBIS TR';
    workbook.created = new Date();

    const summarySheet = workbook.addWorksheet(t('tr_booking_title', 'TR Booking & Archive'));
    summarySheet.columns = [
      { key: 'c1', width: 10 },
      { key: 'c2', width: 18 },
      { key: 'c3', width: 16 },
      { key: 'c4', width: 24 },
      { key: 'c5', width: 14 },
      { key: 'c6', width: 14 },
      { key: 'c7', width: 16 },
      { key: 'c8', width: 18 },
    ];

    const title = t('tr_booking_title', 'TR Booking & Archive');
    summarySheet.mergeCells(1, 1, 1, summaryColumns.length);
    const titleCell = summarySheet.getCell(1, 1);
    titleCell.value = title;
    titleCell.font = { bold: true, size: 16, color: { argb: 'FF1F4E78' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    summarySheet.getRow(1).height = 28;

    summarySheet.mergeCells(2, 1, 2, summaryColumns.length);
    const metaCell = summarySheet.getCell(2, 1);
    metaCell.value = `${t('export_data', 'Export Data')}: ${new Date().toLocaleString()} | ${t('reimbursements', 'Reimbursement Management')}: ${selectedRows.length}`;
    metaCell.font = { size: 11, color: { argb: 'FF5A6B7B' } };
    metaCell.alignment = { vertical: 'middle', horizontal: 'left' };
    summarySheet.getRow(2).height = 20;

    const invoiceRows = await listInvoices();
    const invoiceMap = new Map(
      invoiceRows
        .map((row) => [String(row.invoiceno ?? '').trim(), row] as const)
        .filter(([no]) => no.length > 0),
    );

    const lineBundles = await Promise.all(
      selectedRows.map(async (row) => ({
        row,
        lines: await listReimbursementLines(toFilter(row)),
      })),
    );

    const totalByRow = new Map<string, number>();
    const invoiceFieldKeys = new Set<string>();
    const detailRows: Array<Record<string, unknown>> = [];

    for (const bundle of lineBundles) {
      const rowKey = bundle.row._key;
      let totalAmount = 0;

      for (const line of bundle.lines) {
        const invoiceNo = String(line.invoiceno ?? '').trim();
        const invoice = invoiceMap.get(invoiceNo) ?? {};
        Object.keys(invoice).forEach((key) => invoiceFieldKeys.add(key));

        const lineAmount = parseAmount(line.tr_amount);
        const fallbackAmount = parseAmount(
          (invoice as Record<string, unknown>).grossamount ??
            (invoice as Record<string, unknown>).totalnetamount ??
            (invoice as Record<string, unknown>).taxamount,
        );
        const numericAmount =
          typeof lineAmount === 'number'
            ? lineAmount
            : typeof fallbackAmount === 'number'
              ? fallbackAmount
              : 0;
        totalAmount += numericAmount;

        detailRows.push({
          reimbursement_id: bundle.row.id ?? '',
          reimbursement_no: bundle.row.trno ?? '',
          reimbursement_userid: bundle.row.userid ?? '',
          reimbursement_created_at: bundle.row._createdAt ?? '',
          reimbursement_booking_status: statusLabel(normalizeWorkflowStatus(bundle.row._bookingstatus), t, bundle.row._bookingstatus),
          reimbursement_approval_status: statusLabel(normalizeWorkflowStatus(bundle.row._approvalstatus), t),
          reimbursement_approver: bundle.row._approver ?? '',
          invoiceno: invoiceNo,
          tr_amount: typeof lineAmount === 'number' ? lineAmount : '',
          trchargeable: formatBoolean(line.trchargeable, t),
          txchargeable: formatBoolean(line.txchargeable, t),
          invoice_raw: invoice,
        });
      }

      totalByRow.set(rowKey, totalAmount);
    }

    const headerRowIndex = 4;
    const headerRow = summarySheet.getRow(headerRowIndex);
    headerRow.values = summaryColumns.map((col) => col.label);
    headerRow.height = 22;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F75B5' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFDEE6F0' } },
        left: { style: 'thin', color: { argb: 'FFDEE6F0' } },
        bottom: { style: 'thin', color: { argb: 'FFDEE6F0' } },
        right: { style: 'thin', color: { argb: 'FFDEE6F0' } },
      };
    });

    summarySheet.views = [{ state: 'frozen', ySplit: headerRowIndex }];
    summarySheet.autoFilter = {
      from: { row: headerRowIndex, column: 1 },
      to: { row: headerRowIndex, column: summaryColumns.length },
    };

    let currentRowIndex = headerRowIndex + 1;
    for (const row of selectedRows) {
      const values = summaryColumns.map((col) => col.read(row));
      values[summaryColumns.length - 1] = totalByRow.get(row._key) ?? 0;
      const excelRow = summarySheet.getRow(currentRowIndex);
      excelRow.values = values;
      excelRow.height = 20;

      const isEven = currentRowIndex % 2 === 0;
      excelRow.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE6EDF5' } },
          left: { style: 'thin', color: { argb: 'FFE6EDF5' } },
          bottom: { style: 'thin', color: { argb: 'FFE6EDF5' } },
          right: { style: 'thin', color: { argb: 'FFE6EDF5' } },
        };
        cell.alignment = {
          horizontal: colNumber === summaryColumns.length ? 'right' : 'left',
          vertical: 'middle',
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isEven ? 'FFF8FBFF' : 'FFFFFFFF' },
        };
      });

      const amountCell = excelRow.getCell(summaryColumns.length);
      if (typeof amountCell.value === 'number') {
        amountCell.numFmt = '#,##0.00';
      }

      currentRowIndex += 1;
    }

    const detailSheet = workbook.addWorksheet(t('related_invoices', 'Invoice Line Details'));
    const invoiceKeys = Array.from(invoiceFieldKeys)
      .filter((key) => key !== 'invoiceno')
      .sort((a, b) => a.localeCompare(b));

    const detailColumns = [
      { key: 'reimbursement_id', header: t('id', 'ID'), width: 10 },
      { key: 'reimbursement_no', header: t('reimbursement_id', 'Reimbursement ID'), width: 16 },
      { key: 'reimbursement_userid', header: t('applicant', 'Applicant'), width: 16 },
      { key: 'reimbursement_created_at', header: t('created_at', 'Created At'), width: 24 },
      { key: 'reimbursement_booking_status', header: t('booking_status', 'Booking Status'), width: 14 },
      { key: 'reimbursement_approval_status', header: t('approval_status', 'Approval Status'), width: 14 },
      { key: 'reimbursement_approver', header: t('approver', 'Approver'), width: 16 },
      { key: 'invoiceno', header: t('invoice_no', 'Invoice No'), width: 22 },
      { key: 'tr_amount', header: 'tr_amount', width: 14 },
      { key: 'trchargeable', header: 'trchargeable', width: 12 },
      { key: 'txchargeable', header: 'txchargeable', width: 12 },
      ...invoiceKeys.map((key) => ({
        key: `invoice__${key}`,
        header: `invoice.${key}`,
        width: 18,
      })),
    ];
    detailSheet.columns = detailColumns;

    const detailHeaderRow = detailSheet.getRow(1);
    detailHeaderRow.values = detailColumns.map((col) => col.header);
    detailHeaderRow.height = 22;
    detailHeaderRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFDEE6F0' } },
        left: { style: 'thin', color: { argb: 'FFDEE6F0' } },
        bottom: { style: 'thin', color: { argb: 'FFDEE6F0' } },
        right: { style: 'thin', color: { argb: 'FFDEE6F0' } },
      };
    });

    detailSheet.views = [{ state: 'frozen', ySplit: 1 }];
    detailSheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: detailColumns.length },
    };

    let detailRowIndex = 2;
    for (const row of detailRows) {
      const invoiceRaw = (row.invoice_raw ?? {}) as Record<string, unknown>;
      const payload: Record<string, unknown> = {
        reimbursement_id: row.reimbursement_id,
        reimbursement_no: row.reimbursement_no,
        reimbursement_userid: row.reimbursement_userid,
        reimbursement_created_at: row.reimbursement_created_at,
        reimbursement_booking_status: row.reimbursement_booking_status,
        reimbursement_approval_status: row.reimbursement_approval_status,
        reimbursement_approver: row.reimbursement_approver,
        invoiceno: row.invoiceno,
        tr_amount: row.tr_amount,
        trchargeable: row.trchargeable,
        txchargeable: row.txchargeable,
      };
      for (const key of invoiceKeys) {
        payload[`invoice__${key}`] = invoiceRaw[key] ?? '';
      }

      const excelRow = detailSheet.getRow(detailRowIndex);
      excelRow.values = detailColumns.map((col) => payload[col.key] ?? '') as any[];
      excelRow.height = 20;

      const isEven = detailRowIndex % 2 === 0;
      excelRow.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE6EDF5' } },
          left: { style: 'thin', color: { argb: 'FFE6EDF5' } },
          bottom: { style: 'thin', color: { argb: 'FFE6EDF5' } },
          right: { style: 'thin', color: { argb: 'FFE6EDF5' } },
        };
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isEven ? 'FFF8FBFF' : 'FFFFFFFF' },
        };
      });

      const trAmountCell = excelRow.getCell(9);
      if (typeof trAmountCell.value === 'number') {
        trAmountCell.numFmt = '#,##0.00';
        trAmountCell.alignment = { horizontal: 'right', vertical: 'middle' };
      }

      detailRowIndex += 1;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tr-booking-${toExportTimestamp(new Date())}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <SharedReimbursementList
      rows={rows}
      projects={projects}
      loading={loading}
      selected={selected}
      onSelectionChange={onSelectionChange}
      onOpenCreate={() => undefined}
      onOpenEdit={() => undefined}
      onDelete={() => undefined}
      onApprove={() => undefined}
      onDetail={onDetail}
      t={t}
      showManageActions={false}
      onBook={onBook}
      onSapBook={onSapBook}
      onExport={() => void exportData()}
      selectionMode="multiple"
      pageTitle={t('tr_booking_title', 'TR Booking & Archive')}
      appId="pc-tr-booking"
      tableKey="otto_v_tr_all"
      layoutStorageKey="pc_tr_booking_default_layout_v2"
    />
  );
}
