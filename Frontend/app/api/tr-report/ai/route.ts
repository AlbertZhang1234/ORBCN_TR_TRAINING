import { NextResponse } from 'next/server';
import { ServiceError } from '../../../../services/_core/error';
import { loadRequestAuthContext } from '../../../../services/_server/requestAuth';
import { resolveTravelReportAccess } from '../../../../services/TravelReport/server';
import type { TrReportAiStage } from '../../../../services/TravelReport/pivotAi';
import { runTrReportAi, splitMessageChunks } from './runtime';

export const runtime = 'nodejs';

interface QueryRequestBody {
  question?: string;
  stream?: boolean;
}

type StreamEvent =
  | {
      type: 'status';
      stage: TrReportAiStage;
      message: string;
      detail?: string;
      timestamp: string;
    }
  | {
      type: 'result';
      id: string;
      toolName: string;
      summary: string;
      plan: {
        rows: string[];
        columns: string[];
        filters: string[];
        values: Array<{ fieldId: string; aggregation?: string }>;
        filterSelections: Record<string, string[]>;
        showGrandTotal: boolean;
      };
    }
  | {
      type: 'message_start';
      id: string;
    }
  | {
      type: 'message_delta';
      id: string;
      delta: string;
    }
  | {
      type: 'error';
      message: string;
    };

function json<T>(payload: T, status = 200) {
  return NextResponse.json(payload, { status });
}

function toText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeErrorMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message : 'TR report AI request failed';
  if (/LLM request failed/i.test(detail)) {
    return `TR report AI planning failed. ${detail}`;
  }
  return detail;
}

export async function POST(request: Request) {
  let body: QueryRequestBody = {};
  try {
    body = (await request.json()) as QueryRequestBody;
  } catch {
    return json({ message: 'Invalid payload' }, 400);
  }

  const question = toText(body.question);
  if (!question) {
    return json({ message: 'Question is required' }, 400);
  }

  const stream = body.stream !== false;

  if (stream) {
    const encoder = new TextEncoder();
    const send = (controller: ReadableStreamDefaultController<Uint8Array>, event: StreamEvent) => {
      controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
    };

    const responseStream = new ReadableStream<Uint8Array>({
      start(controller) {
        void (async () => {
          try {
            const auth = await loadRequestAuthContext(request);
            const access = resolveTravelReportAccess(auth, auth.userid);
            const messageId = `tr-report-ai-${Date.now()}`;
            const result = await runTrReportAi(question, access, {
              onProgress: (event) => {
                send(controller, { type: 'status', ...event });
              },
            });

            send(controller, {
              type: 'result',
              id: messageId,
              toolName: result.toolName,
              summary: result.summary,
              plan: result.plan,
            });
            send(controller, {
              type: 'message_start',
              id: messageId,
            });

            for (const chunk of splitMessageChunks(result.summary)) {
              send(controller, {
                type: 'message_delta',
                id: messageId,
                delta: chunk,
              });
              await new Promise((resolve) => setTimeout(resolve, 10));
            }
          } catch (error) {
            send(controller, {
              type: 'error',
              message: normalizeErrorMessage(error),
            });
          } finally {
            controller.close();
          }
        })();
      },
    });

    return new Response(responseStream, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  }

  try {
    const auth = await loadRequestAuthContext(request);
    const access = resolveTravelReportAccess(auth, auth.userid);
    const result = await runTrReportAi(question, access);
    return json({
      id: `tr-report-ai-${Date.now()}`,
      toolName: result.toolName,
      summary: result.summary,
      plan: result.plan,
    });
  } catch (error) {
    const detail = normalizeErrorMessage(error);
    const status = error instanceof ServiceError && error.status ? error.status : 500;
    return json({ message: detail }, status);
  }
}
