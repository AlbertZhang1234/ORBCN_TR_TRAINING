import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/services/_server/apiAuth';

export const runtime = 'nodejs';

type DestinationClass = 'domestic' | 'overseas';

interface ClassifyPayload {
  destinations?: unknown;
}

interface ClassificationResult {
  destination: string;
  classification: DestinationClass;
  confidence: number;
}

interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

function toText(value: unknown): string {
  return String(value ?? '').trim();
}

function getLlmConfig(): LlmConfig | null {
  const baseUrl = toText(process.env.NEXT_PUBLIC_LLM_BASEURL).replace(/\/+$/, '');
  const apiKey = toText(process.env.NEXT_PUBLIC_LLM_APIKEY);
  const model = toText(process.env.NEXT_PUBLIC_LLM_MODEL);
  if (!baseUrl || !apiKey || !model) {
    return null;
  }
  return { baseUrl, apiKey, model };
}

function normalizeDestinations(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(
    new Set(
      value
        .map((item) => toText(item))
        .filter((item) => item.length > 0)
        .slice(0, 200),
    ),
  );
}

function heuristicClassify(destination: string): DestinationClass {
  const text = destination.trim().toLowerCase();
  if (!text) {
    return 'domestic';
  }

  const overseasPattern =
    /(香港|hong kong|澳门|澳門|macau|台湾|台灣|taiwan|德国|德國|germany|deutschland|法国|法國|france|美国|美國|usa|united states|英国|英國|uk|united kingdom|日本|japan|韩国|韓國|korea|新加坡|singapore|泰国|泰國|thailand|越南|vietnam|印度|india|意大利|義大利|italy|西班牙|spain|荷兰|荷蘭|netherlands|瑞士|switzerland|奥地利|奧地利|austria|澳大利亚|澳大利亞|australia|加拿大|canada|海外|国外|國外|overseas|foreign)/i;
  if (overseasPattern.test(destination)) {
    return 'overseas';
  }

  const domesticPattern =
    /(中国|中國|china|prc|国内|國內|北京|上海|广州|廣州|深圳|苏州|蘇州|杭州|南京|无锡|無錫|常州|宁波|寧波|成都|重庆|重慶|武汉|武漢|西安|天津|青岛|青島|厦门|廈門|临港|臨港|太仓|太倉|昆山|珠海|佛山|东莞|東莞|合肥|长沙|長沙|郑州|鄭州|济南|濟南|沈阳|瀋陽|大连|大連)/i;
  if (domesticPattern.test(destination)) {
    return 'domestic';
  }

  return /[\u4e00-\u9fff]/.test(destination) ? 'domestic' : 'overseas';
}

function fallbackResults(destinations: string[]): ClassificationResult[] {
  return destinations.map((destination) => ({
    destination,
    classification: heuristicClassify(destination),
    confidence: 0.55,
  }));
}

function extractJsonArray(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }
  const blockMatch = trimmed.match(/```json\s*([\s\S]*?)```/i);
  if (blockMatch?.[1]) {
    return blockMatch[1].trim();
  }
  const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
  return arrayMatch?.[0]?.trim() ?? '';
}

function normalizeClassification(value: unknown): DestinationClass {
  const text = toText(value).toLowerCase();
  return text === 'overseas' || text === 'foreign' || text === '国外' || text === '海外'
    ? 'overseas'
    : 'domestic';
}

function parseLlmResults(raw: string, destinations: string[]): ClassificationResult[] | null {
  const json = extractJsonArray(raw);
  if (!json) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) {
    return null;
  }

  const allowed = new Set(destinations);
  const byDestination = new Map<string, ClassificationResult>();
  for (const item of parsed) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const row = item as Record<string, unknown>;
    const destination = toText(row.destination);
    if (!allowed.has(destination)) {
      continue;
    }
    const confidence = Number(row.confidence);
    byDestination.set(destination, {
      destination,
      classification: normalizeClassification(row.classification),
      confidence: Number.isFinite(confidence) ? Math.min(Math.max(confidence, 0), 1) : 0.8,
    });
  }

  if (byDestination.size === 0) {
    return null;
  }

  return destinations.map((destination) => {
    const classified = byDestination.get(destination);
    if (classified) {
      return classified;
    }
    return {
      destination,
      classification: heuristicClassify(destination),
      confidence: 0.55,
    };
  });
}

async function classifyWithLlm(config: LlmConfig, destinations: string[]): Promise<ClassificationResult[] | null> {
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0,
      max_tokens: Math.min(1600, 180 + destinations.length * 36),
      messages: [
        {
          role: 'system',
          content:
            'You classify travel destinations for a China travel reimbursement system. Return strict JSON array only. classification must be "domestic" for mainland China destinations and "overseas" for destinations outside mainland China. Use city/place/country clues. Do not add markdown.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: 'Classify each destination as domestic or overseas.',
            outputSchema: [
              {
                destination: 'same string as input',
                classification: 'domestic | overseas',
                confidence: 'number from 0 to 1',
              },
            ],
            destinations,
          }),
        },
      ],
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  if (!response.ok) {
    return null;
  }
  return parseLlmResults(toText(payload?.choices?.[0]?.message?.content), destinations);
}

export async function POST(request: Request) {
  const auth = await requireApiAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  let payload: ClassifyPayload = {};
  try {
    payload = (await request.json()) as ClassifyPayload;
  } catch {
    return NextResponse.json({ message: 'Invalid payload' }, { status: 400 });
  }

  const destinations = normalizeDestinations(payload.destinations);
  if (destinations.length === 0) {
    return NextResponse.json({ results: [], source: 'empty' }, { status: 200 });
  }

  const llm = getLlmConfig();
  if (llm) {
    const llmResults = await classifyWithLlm(llm, destinations).catch(() => null);
    if (llmResults) {
      return NextResponse.json({ results: llmResults, source: 'llm' }, { status: 200 });
    }
  }

  return NextResponse.json({ results: fallbackResults(destinations), source: 'fallback' }, { status: 200 });
}
