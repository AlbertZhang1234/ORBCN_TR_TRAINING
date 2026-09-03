import schema from '../../../Backend/InvoiceProcessing/tuning.schema.json';

export const recognitionFields = schema;
export type RecognitionSettings = {
  [K in keyof typeof schema]: (typeof schema)[K]['default'] extends boolean ? boolean : number;
};
export interface SystemConfigSnapshot {
  values: RecognitionSettings;
  version: number;
  updatedAt: string | null;
}
export const defaultRecognitionSettings = Object.fromEntries(
  Object.entries(schema).map(([key, field]) => [key, field.default]),
) as RecognitionSettings;

export function validateRecognitionSettings(input: unknown): RecognitionSettings {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('配置必须为对象 / Settings must be an object');
  const source = input as Record<string, unknown>;
  if (Object.keys(source).some((key) => !(key in schema))) throw new Error('包含未知配置项 / Unknown setting');
  const result = { ...defaultRecognitionSettings };
  for (const [key, field] of Object.entries(schema)) {
    const value = source[key] ?? field.default;
    const valid = typeof field.default === 'boolean' ? typeof value === 'boolean'
      : typeof value === 'number' && Number.isInteger(value) && 'min' in field && value >= field.min && value <= field.max;
    if (!valid || source[key] === null) throw new Error(`${field.zh} / ${field.en}: 无效值 / Invalid value`);
    Object.assign(result, { [key]: value });
  }
  if (result.model_timeout_seconds > result.total_timeout_seconds)
    throw new Error('单次模型超时不能超过总预算 / Model timeout exceeds the processing budget');
  return result;
}
