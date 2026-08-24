import { NextResponse } from 'next/server';
import { ServiceError } from '../../../../services/_core/error';
import { loadRequestAuthContext } from '../../../../services/_server/requestAuth';
import { resolveTravelReportAccess } from '../../../../services/TravelReport/server';
import { getLlmConfig, runOttoNaturalLanguageQuery, type OttoProgressEvent } from './ottoVTrAllTool';

export const runtime = 'nodejs';

interface QueryRequestBody {
  question?: string;
  stream?: boolean;
}

type StreamEvent =
  | ({ type: 'status' } & OttoProgressEvent)
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
      type: 'result';
      id: string;
      plan: unknown;
      meta: {
        rowCount: number;
        reimbursementCount: number;
        invoiceCount: number;
      };
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

function normalizeQueryErrorMessage(error: unknown): string {
  const detail = error instanceof Error ? error.message : 'Query failed';
  if (/Database host could not be resolved/i.test(detail) || /getaddrinfo\s+ENOTFOUND/i.test(detail)) {
    return 'AI query data source is unavailable. DATABASE_URL host cannot be resolved. Check Frontend/.env.local.';
  }
  return detail;
}

function splitMessageChunks(message: string, chunkSize = 48): string[] {
  const text = message.trim();
  if (!text) {
    return [];
  }
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += chunkSize) {
    chunks.push(text.slice(index, index + chunkSize));
  }
  return chunks;
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

  const stream = body.stream === true;

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
            const llm = getLlmConfig();
            const messageId = `ai-query-${Date.now()}`;
            let didStartMessage = false;
            let streamedAnswer = '';
            const result = await runOttoNaturalLanguageQuery(question, access, llm, {
              onProgress: (event) => {
                send(controller, { type: 'status', ...event });
              },
              onAnswerStart: () => {
                if (didStartMessage) {
                  return;
                }
                didStartMessage = true;
                send(controller, {
                  type: 'message_start',
                  id: messageId,
                });
              },
              onAnswerDelta: (delta) => {
                if (!didStartMessage) {
                  didStartMessage = true;
                  send(controller, {
                    type: 'message_start',
                    id: messageId,
                  });
                }
                if (!delta) {
                  return;
                }
                streamedAnswer += delta;
                send(controller, {
                  type: 'message_delta',
                  id: messageId,
                  delta,
                });
              },
            });
            if (!streamedAnswer.trim()) {
              if (!didStartMessage) {
                send(controller, {
                  type: 'message_start',
                  id: messageId,
                });
              }
              for (const chunk of splitMessageChunks(result.message)) {
                send(controller, {
                  type: 'message_delta',
                  id: messageId,
                  delta: chunk,
                });
                await new Promise((resolve) => setTimeout(resolve, 10));
              }
            }
            send(controller, {
              type: 'result',
              id: messageId,
              plan: result.plan,
              meta: {
                rowCount: result.result.aggregate.rowCount,
                reimbursementCount: result.result.aggregate.reimbursementCount,
                invoiceCount: result.result.aggregate.invoiceCount,
              },
            });
          } catch (error) {
            const detail = normalizeQueryErrorMessage(error);
            send(controller, { type: 'error', message: detail });
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
    const llm = getLlmConfig();
    const result = await runOttoNaturalLanguageQuery(question, access, llm);
    return json({
      id: `ai-query-${Date.now()}`,
      message: result.message,
      plan: result.plan,
      meta: {
        rowCount: result.result.aggregate.rowCount,
        reimbursementCount: result.result.aggregate.reimbursementCount,
        invoiceCount: result.result.aggregate.invoiceCount,
      },
    });
  } catch (error) {
    const detail = normalizeQueryErrorMessage(error);
    const status = error instanceof ServiceError && error.status ? error.status : 500;
    return json({ message: detail }, status);
  }
}
