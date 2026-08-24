import { NextResponse } from 'next/server';

interface InsightSummaryRow {
  name?: string;
  amount?: number;
  ratio?: number;
  count?: number;
}

interface InsightSummaryPayload {
  year?: number;
  totalAmount?: number;
  reimbursementCount?: number;
  invoiceCount?: number;
  cities?: InsightSummaryRow[];
  customers?: InsightSummaryRow[];
  projects?: InsightSummaryRow[];
  categories?: InsightSummaryRow[];
}

function toFiniteNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function normalizeRows(input: unknown): Array<{ name: string; amount: number; ratio: number; count: number }> {
  if (!Array.isArray(input)) {
    return [];
  }
  return input
    .map((row) => {
      const obj = (row ?? {}) as InsightSummaryRow;
      const name = String(obj.name ?? '').trim();
      if (!name) {
        return null;
      }
      return {
        name,
        amount: Math.max(0, toFiniteNumber(obj.amount)),
        ratio: Math.max(0, toFiniteNumber(obj.ratio)),
        count: Math.max(0, Math.trunc(toFiniteNumber(obj.count))),
      };
    })
    .filter((row): row is { name: string; amount: number; ratio: number; count: number } => Boolean(row));
}

function normalizePayload(raw: unknown): InsightSummaryPayload {
  const payload = (raw ?? {}) as InsightSummaryPayload;
  return {
    year: Math.trunc(toFiniteNumber(payload.year)) || new Date().getFullYear(),
    totalAmount: Math.max(0, toFiniteNumber(payload.totalAmount)),
    reimbursementCount: Math.max(0, Math.trunc(toFiniteNumber(payload.reimbursementCount))),
    invoiceCount: Math.max(0, Math.trunc(toFiniteNumber(payload.invoiceCount))),
    cities: normalizeRows(payload.cities),
    customers: normalizeRows(payload.customers),
    projects: normalizeRows(payload.projects),
    categories: normalizeRows(payload.categories),
  };
}

function money(value: number): string {
  return `¥${value.toFixed(2)}`;
}

function buildFallbackResult(payload: InsightSummaryPayload): { tag: string; summary: string } {
  const year = payload.year ?? new Date().getFullYear();
  const totalAmount = Math.max(0, toFiniteNumber(payload.totalAmount));
  const reimbursementCount = Math.max(0, Math.trunc(toFiniteNumber(payload.reimbursementCount)));
  const invoiceCount = Math.max(0, Math.trunc(toFiniteNumber(payload.invoiceCount)));
  const litCityCount = (payload.cities ?? []).filter((city) => city.name !== 'Unknown City' && city.name !== '未知城市').length;

  if (totalAmount <= 0 || invoiceCount <= 0) {
    return {
      tag: '蓄势待发',
      summary: `${year}，新的旅程已经开启。每一次提交都在积累你的闪光轨迹，继续加油。`,
    };
  }

  const topCustomer = payload.customers?.[0]?.name ?? '主要客户';
  const topProject = payload.projects?.[0]?.name ?? '重点项目';
  const topCategory = payload.categories?.[0]?.name ?? '主要类别';
  const topCategoryRatio = Number(payload.categories?.[0]?.ratio ?? 0).toFixed(1);
  const tag =
    litCityCount >= 4
      ? '城市开拓者'
      : reimbursementCount >= 6
        ? '执行力在线'
        : '稳扎稳打';

  return {
    tag,
    summary:
      `${year}累计报销${reimbursementCount}次、发票${invoiceCount}张、金额${money(totalAmount)}，点亮${litCityCount}座城市。` +
      `你在「${topCustomer}」与「${topProject}」上持续发力，${topCategory}占比${topCategoryRatio}%。继续发光。`,
  };
}

function cleanModelOutput(text: string): string {
  const merged = text.replace(/\s+/g, ' ').trim();
  if (!merged) {
    return '';
  }
  if (merged.length > 90) {
    return `${merged.slice(0, 86)}...`;
  }
  return merged;
}

function containsNegativeOptimization(text: string): boolean {
  return /(优化|降本|控制成本|节省|压缩预算|减少开支)/.test(text);
}

function parseModelResult(text: string): { tag: string; summary: string } | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  const jsonText = jsonMatch?.[0] ?? trimmed;
  try {
    const parsed = JSON.parse(jsonText) as { tag?: string; cheer?: string; summary?: string };
    const tag = String(parsed.tag ?? '').trim().replace(/^#+/, '');
    const summaryRaw = String(parsed.cheer ?? parsed.summary ?? '').trim();
    const summary = cleanModelOutput(summaryRaw);
    if (tag && summary) {
      return { tag, summary };
    }
  } catch {
    // ignore
  }

  const tagMatch = trimmed.match(/(?:标签|关键词|tag)[:：]\s*#?([^\n，。,.]{2,16})/i);
  const cheerMatch = trimmed.match(/(?:鼓励|加油|文案|cheer|summary)[:：]\s*([^\n]+)/i);
  const tag = String(tagMatch?.[1] ?? '').trim().replace(/^#+/, '');
  const summary = cleanModelOutput(String(cheerMatch?.[1] ?? '').trim());
  if (tag && summary) {
    return { tag, summary };
  }

  return null;
}

function getLlmConfig(): { baseUrl: string; model: string; apiKey: string } | null {
  const baseUrl = String(process.env.NEXT_PUBLIC_LLM_BASEURL ?? '').trim().replace(/\/+$/, '');
  const apiKey = String(process.env.NEXT_PUBLIC_LLM_APIKEY ?? '').trim();
  const model = String(process.env.NEXT_PUBLIC_LLM_MODEL ?? '').trim();
  if (!baseUrl || !apiKey || !model) {
    return null;
  }
  return { baseUrl, model, apiKey };
}

export async function POST(request: Request) {
  let payload: InsightSummaryPayload;

  try {
    payload = normalizePayload(await request.json());
  } catch {
    return NextResponse.json({ message: 'Invalid payload' }, { status: 400 });
  }

  const fallback = buildFallbackResult(payload);
  const llm = getLlmConfig();
  if (!llm) {
    return NextResponse.json({ summary: fallback.summary, tag: fallback.tag, source: 'fallback' }, { status: 200 });
  }

  try {
    const response = await fetch(`${llm.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${llm.apiKey}`,
      },
      body: JSON.stringify({
        model: llm.model,
        temperature: 0.55,
        max_tokens: 220,
        messages: [
          {
            role: 'system',
            content:
              '你是企业报销系统的年度鼓励助手。请基于数据生成 JSON：{"tag":"2-8字中文关键词，不带#","cheer":"30-60字积极鼓励文案"}。内容需覆盖城市/项目/类别，不可虚构，不要给优化建议。',
          },
          {
            role: 'user',
            content: `请基于以下年度数据生成总结：${JSON.stringify(payload)}`,
          },
        ],
      }),
    });

    const result = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      const errMessage = String(result?.error?.message ?? '').trim();
      throw new Error(errMessage || `LLM request failed: ${response.status}`);
    }

    const raw = String(result?.choices?.[0]?.message?.content ?? '').trim();
    const parsed = parseModelResult(raw);
    if (!parsed || containsNegativeOptimization(parsed.summary)) {
      return NextResponse.json({ summary: fallback.summary, tag: fallback.tag, source: 'fallback' }, { status: 200 });
    }

    return NextResponse.json({ summary: parsed.summary, tag: parsed.tag, source: 'llm' }, { status: 200 });
  } catch {
    return NextResponse.json({ summary: fallback.summary, tag: fallback.tag, source: 'fallback' }, { status: 200 });
  }
}
