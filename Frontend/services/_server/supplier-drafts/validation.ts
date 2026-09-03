import { ServiceError } from '../../_core/error';
import { emptyHeader, type EditableHeader, type EditableLine } from '../../Invoice/supplier-draft-model';

export function requireDraftId(value: string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value))
    throw new ServiceError('Invalid draft ID', { status: 400 });
  return value;
}
export function draftContent(input: { header?: EditableHeader; lines?: EditableLine[] }) {
  if (!input?.header || !['01','02'].includes(input.header.businesstype))
    throw new ServiceError('供应商发票业务类型只能是 01 或 02', { status: 400 });
  if (!Array.isArray(input.lines) || input.lines.length > 1000)
    throw new ServiceError('行项目格式错误或超过 1000 行', { status: 400 });
  const header = emptyHeader(input.header.businesstype);
  for (const key of Object.keys(header) as Array<keyof EditableHeader>) {
    const value = input.header[key];
    (header as any)[key] = ['totalnetamount','taxamount','grossamount'].includes(key)
      ? numeric(value) : String(value ?? '').slice(0, 4000);
  }
  const lines = input.lines.map((line, index) => ({
    key: String(line?.key || `line-${index + 1}`).slice(0,100),
    description: String(line?.description ?? '').slice(0,4000), spec_model: String(line?.spec_model ?? '').slice(0,4000),
    unit_price: numeric(line?.unit_price), quantity: numeric(line?.quantity),
    amount_excl_tax: numeric(line?.amount_excl_tax), amount_incl_tax: numeric(line?.amount_incl_tax),
    tax_rate: String(line?.tax_rate ?? '').slice(0,100),
  }));
  return { header, lines };
}
function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new ServiceError('金额和数量必须是有效数字', { status: 400 });
  return value;
}
