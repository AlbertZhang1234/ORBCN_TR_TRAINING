'use client';

import { startTransition, useEffect, useRef, useState } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import {
  Box,
  IconButton,
  InputBase,
  useTheme,
} from '@mui/material';
import {
  AgentPanel,
  type AgentUICardHooks,
  type ChatMessage,
} from 'orbcafe-ui';
import type { SessionUser } from '../_components/session';

interface HomeAiAssistantRequest {
  id: string;
  text: string;
}

interface HomeAiAssistantProps {
  open: boolean;
  onClose: () => void;
  request: HomeAiAssistantRequest | null;
  sessionUser: SessionUser;
  lang: 'zh' | 'en';
}

interface QueryResponse {
  message?: string;
  plan?: unknown;
  meta?: {
    rowCount?: number;
    reimbursementCount?: number;
    invoiceCount?: number;
  };
}

type WorkflowStage =
  | 'question_understanding'
  | 'tool_selection'
  | 'parameter_decision'
  | 'tool_execution'
  | 'data_organization';

type StageState = 'pending' | 'active' | 'done';

interface QueryStreamStatusEvent {
  type: 'status';
  stage: WorkflowStage;
  message?: string;
  detail?: string;
  timestamp?: string;
}

interface QueryStreamResultEvent {
  type: 'result';
  id?: string;
  plan?: unknown;
  meta?: {
    rowCount?: number;
    reimbursementCount?: number;
    invoiceCount?: number;
  };
}

interface QueryStreamErrorEvent {
  type: 'error';
  message?: string;
}

interface QueryStreamMessageStartEvent {
  type: 'message_start';
  id: string;
}

interface QueryStreamMessageDeltaEvent {
  type: 'message_delta';
  id: string;
  delta?: string;
}

type QueryStreamEvent =
  | QueryStreamStatusEvent
  | QueryStreamResultEvent
  | QueryStreamErrorEvent
  | QueryStreamMessageStartEvent
  | QueryStreamMessageDeltaEvent;

const WORKFLOW_STAGES: WorkflowStage[] = [
  'question_understanding',
  'tool_selection',
  'parameter_decision',
  'tool_execution',
  'data_organization',
];

const WORKFLOW_STAGE_LABELS: Record<WorkflowStage, string> = {
  question_understanding: '问题理解',
  tool_selection: '工具选择',
  parameter_decision: '参数决定',
  tool_execution: '工具执行',
  data_organization: '数据整理',
};

function createMessage(type: ChatMessage['type'], content: string, isStreaming = false): ChatMessage {
  return {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    type,
    content,
    timestamp: new Date(),
    isStreaming,
  };
}

function createStageMap(): Record<WorkflowStage, StageState> {
  return {
    question_understanding: 'pending',
    tool_selection: 'pending',
    parameter_decision: 'pending',
    tool_execution: 'pending',
    data_organization: 'pending',
  };
}

function buildDoneStageMap(): Record<WorkflowStage, StageState> {
  return {
    question_understanding: 'done',
    tool_selection: 'done',
    parameter_decision: 'done',
    tool_execution: 'done',
    data_organization: 'done',
  };
}

function nextAgentStatusByStage(stage: WorkflowStage): 'pending' | 'running' {
  if (stage === 'question_understanding') {
    return 'pending';
  }
  return 'running';
}

function getUiText(lang: 'zh' | 'en') {
  if (lang === 'en') {
    return {
        title: 'Intelligent Analysis',
        description: 'Analyze reimbursements and invoices with natural language.',
        placeholder: 'Ask about reimbursements, invoices, projects, approval, booking...',
      waiting: 'Waiting for task start...',
      noStream: 'The server did not return streamed stages. Fallback response was used.',
      done: 'All stages completed.',
      queryFailed: 'Query failed:',
      retryHint: 'Try another phrasing, or narrow the scope and retry.',
    };
  }

  return {
    title: '智能分析',
    description: '用自然语言分析报销、发票和项目数据。',
    placeholder: '问我报销、发票、项目、审批、记账等问题...',
    waiting: '等待任务启动...',
    noStream: '服务端未开启流式阶段回传，已使用普通返回。',
    done: '全部阶段已完成。',
    queryFailed: '查询失败：',
    retryHint: '请换个问法，或者缩小条件范围后再试。',
  };
}

export default function HomeAiAssistant({
  open,
  onClose,
  request,
  sessionUser,
  lang,
}: HomeAiAssistantProps) {
  const theme = useTheme();
  const uiText = getUiText(lang);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isResponding, setIsResponding] = useState(false);
  const [agentStatus, setAgentStatus] = useState<'idle' | 'running' | 'success' | 'error' | 'pending'>('idle');
  const [stageProgress, setStageProgress] = useState<Record<WorkflowStage, StageState>>(createStageMap());
  const [stageVisible, setStageVisible] = useState(false);
  const [draft, setDraft] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const processedRequestIdRef = useRef<string>('');
  const abortRef = useRef<AbortController | null>(null);
  const lastSubmittedQueryRef = useRef<string>('');

  const submitQuery = async (question: string) => {
    const text = question.trim();
    const sessionId = String(sessionUser.session_id ?? '').trim();
    if (!text || !sessionId) {
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    lastSubmittedQueryRef.current = text;

    const workflowStages = createStageMap();
    workflowStages.question_understanding = 'active';
    setStageProgress({ ...workflowStages });
    setStageVisible(true);

    const userMessage = createMessage('user', text);
    startTransition(() => {
      setMessages((prev) => [...prev, userMessage]);
    });
    setIsResponding(true);
    setAgentStatus('pending');

    const applyStage = (stage: WorkflowStage) => {
      const stageIndex = WORKFLOW_STAGES.indexOf(stage);
      WORKFLOW_STAGES.forEach((item, index) => {
        if (index < stageIndex) {
          workflowStages[item] = 'done';
        } else if (index === stageIndex) {
          workflowStages[item] = 'active';
        } else if (workflowStages[item] !== 'done') {
          workflowStages[item] = 'pending';
        }
      });
      setAgentStatus(nextAgentStatusByStage(stage));
      setStageProgress({ ...workflowStages });
    };

    try {
      const response = await fetch('/api/home/ai-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId,
        },
        body: JSON.stringify({ question: text, stream: true }),
        signal: controller.signal,
      });
      const contentType = String(response.headers.get('content-type') ?? '').toLowerCase();

      if (!response.ok) {
        let payload: QueryResponse = {};
        try {
          payload = (await response.json()) as QueryResponse;
        } catch {
          payload = {};
        }
        throw new Error(String(payload.message ?? '').trim() || `Request failed (${response.status})`);
      }

      if (!response.body || !contentType.includes('application/x-ndjson')) {
        let payload: QueryResponse = {};
        try {
          payload = (await response.json()) as QueryResponse;
        } catch {
          payload = {};
        }
        const textContent = String(payload.message ?? '').trim() || 'No response content.';
        WORKFLOW_STAGES.forEach((stage) => {
          workflowStages[stage] = 'done';
        });
        setStageProgress({ ...workflowStages });
        startTransition(() => {
          setMessages((prev) => [...prev, createMessage('assistant', textContent, true)]);
        });
        setAgentStatus('idle');
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let resultMessageId = '';
      let resultMessage = '';

      const handleEvent = (event: QueryStreamEvent) => {
        if (event.type === 'status') {
          applyStage(event.stage);
          return;
        }
        if (event.type === 'error') {
          throw new Error(String(event.message ?? '').trim() || 'AI query failed');
        }
        if (event.type === 'message_start') {
          const messageId = String(event.id ?? '').trim();
          if (!messageId) {
            return;
          }
          resultMessageId = messageId;
          startTransition(() => {
            setMessages((prev) => {
              if (prev.some((message) => message.id === messageId)) {
                return prev;
              }
              return [
                ...prev,
                {
                  id: messageId,
                  type: 'assistant',
                  content: '',
                  timestamp: new Date(),
                  isStreaming: false,
                },
              ];
            });
          });
          return;
        }
        if (event.type === 'message_delta') {
          const messageId = String(event.id ?? '').trim();
          const delta = String(event.delta ?? '');
          if (!messageId || !delta) {
            return;
          }
          resultMessageId = messageId;
          resultMessage += delta;
          startTransition(() => {
            setMessages((prev) =>
              prev.map((message) =>
                message.id === messageId
                  ? {
                      ...message,
                      content: `${String(message.content ?? '')}${delta}`,
                      timestamp: new Date(),
                      isStreaming: false,
                    }
                  : message,
              ),
            );
          });
          return;
        }
        if (event.type === 'result') {
          WORKFLOW_STAGES.forEach((stage) => {
            workflowStages[stage] = 'done';
          });
          setStageProgress({ ...workflowStages });
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) {
            continue;
          }
          handleEvent(JSON.parse(line) as QueryStreamEvent);
        }
      }

      const tail = buffer.trim();
      if (tail) {
        handleEvent(JSON.parse(tail) as QueryStreamEvent);
      }

      if (!resultMessageId || !resultMessage.trim()) {
        throw new Error('No result message from streaming response');
      }

      startTransition(() => {
        setMessages((prev) =>
          prev.map((message) =>
                message.id === resultMessageId
              ? {
                  ...message,
                  content: resultMessage,
                  timestamp: new Date(),
                  isStreaming: false,
                }
              : message,
          ),
        );
      });
      setAgentStatus('idle');
    } catch (error) {
      if (controller.signal.aborted) {
        setAgentStatus('idle');
        setStageProgress(createStageMap());
        setStageVisible(false);
        return;
      }

      const message = error instanceof Error ? error.message : 'AI query failed';
      startTransition(() => {
        setMessages((prev) => [
          ...prev,
          createMessage(
            'assistant',
            `${uiText.queryFailed}${message}\n\n${uiText.retryHint}`,
          ),
        ]);
      });
      setAgentStatus('error');
      setStageProgress(buildDoneStageMap());
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setIsResponding(false);
    }
  };

  useEffect(() => {
    if (!request || !open) {
      return;
    }
    if (processedRequestIdRef.current === request.id) {
      return;
    }
    processedRequestIdRef.current = request.id;
    void submitQuery(request.text);
  }, [open, request]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (open) {
      return;
    }
    setDraft('');
    setIsComposing(false);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  const cardHooks: AgentUICardHooks = {
    onCardEvent: (event) => {
      if (event.action !== 'suggestion-click') {
        return;
      }
      const payload = (event.payload ?? {}) as { suggestion?: unknown };
      const suggestion = String(payload.suggestion ?? '').trim();
      if (!suggestion) {
        return;
      }
      void submitQuery(suggestion);
    },
  };

  if (!open) {
    return null;
  }

  return (
    <Box
      onClick={onClose}
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: theme.zIndex.modal + 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: { xs: 1, sm: 2, md: 3 },
        py: { xs: 1, sm: 2, md: 3 },
        bgcolor: theme.palette.mode === 'dark' ? 'rgba(2, 6, 14, 0.6)' : 'rgba(15, 23, 42, 0.22)',
        backdropFilter: 'blur(3px)',
      }}
    >
      <Box
        onClick={(event) => event.stopPropagation()}
        sx={{
          width: { xs: 'calc(100vw - 16px)', md: 'min(1200px, 92vw)' },
          height: { xs: 'calc(100vh - 16px)', md: 'min(860px, 90vh)' },
          minHeight: { xs: 560, md: 640 },
          position: 'relative',
          borderRadius: '28px',
          overflow: 'hidden',
          border: '1px solid',
          borderColor: theme.palette.mode === 'dark' ? 'rgba(56,189,248,0.28)' : 'rgba(14,165,233,0.22)',
          '@keyframes aiStagePulse': {
            '0%, 100%': { transform: 'scale(1)', opacity: 0.82 },
            '50%': { transform: 'scale(1.18)', opacity: 1 },
          },
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            borderRadius: '28px',
            padding: '1px',
            background: theme.palette.mode === 'dark'
              ? 'linear-gradient(135deg, rgba(56,189,248,0.3), rgba(125,211,252,0.12), rgba(56,189,248,0.28))'
              : 'linear-gradient(135deg, rgba(14,165,233,0.24), rgba(56,189,248,0.12), rgba(14,165,233,0.22))',
            WebkitMask:
              'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            pointerEvents: 'none',
            zIndex: 2,
          },
          filter:
            theme.palette.mode === 'dark'
              ? 'drop-shadow(0 24px 48px rgba(2, 6, 14, 0.45)) drop-shadow(0 0 18px rgba(56,189,248,0.14))'
              : 'drop-shadow(0 24px 48px rgba(15, 23, 42, 0.18)) drop-shadow(0 0 12px rgba(14,165,233,0.1))',
          '& *': {
            scrollbarWidth: 'thin',
            scrollbarColor:
              theme.palette.mode === 'dark'
                ? 'rgba(148, 163, 184, 0.28) rgba(15, 23, 42, 0.08)'
                : 'rgba(100, 116, 139, 0.35) rgba(148, 163, 184, 0.14)',
          },
          '& *::-webkit-scrollbar': {
            width: 10,
            height: 10,
          },
          '& *::-webkit-scrollbar-track': {
            background:
              theme.palette.mode === 'dark'
                ? 'rgba(15, 23, 42, 0.08)'
                : 'rgba(148, 163, 184, 0.14)',
            borderRadius: 999,
          },
          '& *::-webkit-scrollbar-thumb': {
            background:
              theme.palette.mode === 'dark'
                ? 'rgba(148, 163, 184, 0.28)'
                : 'rgba(100, 116, 139, 0.35)',
            borderRadius: 999,
            border: theme.palette.mode === 'dark'
              ? '2px solid rgba(15, 23, 42, 0.08)'
              : '2px solid rgba(148, 163, 184, 0.14)',
          },
          '& *::-webkit-scrollbar-thumb:hover': {
            background:
              theme.palette.mode === 'dark'
                ? 'rgba(148, 163, 184, 0.42)'
                : 'rgba(100, 116, 139, 0.5)',
          },
          '& .flex.items-center.gap-2 > .inline-flex': {
            display: 'none',
          },
        }}
      >
        <Box
          sx={{
            position: 'relative',
            zIndex: 3,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            borderRadius: '27px',
            overflow: 'hidden',
            bgcolor: theme.palette.mode === 'dark' ? '#090f1a' : theme.palette.background.paper,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              px: { xs: 2, md: 3 },
              py: 1.5,
              borderBottom: '1px solid',
              borderColor: theme.palette.mode === 'dark' ? 'rgba(148,163,184,0.14)' : theme.palette.divider,
              background: theme.palette.mode === 'dark'
                ? 'linear-gradient(180deg, rgba(15,23,42,0.94), rgba(9,15,26,0.92))'
                : 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,255,255,0.92))',
            }}
          >
            <Box sx={{ minWidth: 0, textAlign: 'left', pr: 1 }}>
                <Box
                  sx={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: theme.palette.mode === 'dark' ? theme.palette.common.white : 'rgba(15,23,42,0.92)',
                    lineHeight: 1.2,
                  }}
                >
                  {uiText.title}
                </Box>
            </Box>
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                justifyContent: 'center',
                opacity: stageVisible ? 1 : 0.42,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {WORKFLOW_STAGES.map((stage, index) => {
                  const state = stageProgress[stage];
                  const isDone = state === 'done';
                  const isActive = state === 'active';
                  const lampColor = isDone
                    ? '#84cc16'
                    : isActive
                      ? '#38bdf8'
                      : theme.palette.mode === 'dark'
                        ? 'rgba(100,116,139,0.5)'
                        : 'rgba(148,163,184,0.68)';

                  return (
                    <Box key={stage} sx={{ display: 'flex', alignItems: 'center', gap: 0.55 }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: lampColor,
                          boxShadow: isDone || isActive ? `0 0 8px ${lampColor}` : 'none',
                          animation: isActive ? 'aiStagePulse 1s ease-in-out infinite' : 'none',
                          flexShrink: 0,
                        }}
                      />
                      <Box
                        sx={{
                          fontSize: 11,
                          lineHeight: 1,
                          color: theme.palette.mode === 'dark' ? 'rgba(148,163,184,0.92)' : 'rgba(71,85,105,0.9)',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        {WORKFLOW_STAGE_LABELS[stage]}
                      </Box>
                      {index < WORKFLOW_STAGES.length - 1 && (
                        <Box
                          sx={{
                            width: 12,
                            height: 1,
                            bgcolor: theme.palette.mode === 'dark' ? 'rgba(100,116,139,0.45)' : 'rgba(148,163,184,0.6)',
                            ml: 0.45,
                            mr: 0.2,
                          }}
                        />
                      )}
                    </Box>
                  );
                })}
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  width: { xs: 220, md: 400 },
                  height: 42,
                  px: 1.6,
                  borderRadius: '999px',
                  border: '1px solid',
                  borderColor: theme.palette.mode === 'dark' ? 'rgba(96,165,250,0.18)' : 'rgba(59,130,246,0.18)',
                  bgcolor: theme.palette.mode === 'dark' ? 'rgba(15,23,42,0.76)' : 'rgba(248,250,252,0.94)',
                  boxShadow: theme.palette.mode === 'dark'
                    ? 'inset 0 1px 0 rgba(255,255,255,0.03), 0 0 0 1px rgba(30,41,59,0.32)'
                    : 'inset 0 1px 0 rgba(255,255,255,0.7), 0 0 0 1px rgba(226,232,240,0.6)',
                  backdropFilter: 'blur(16px)',
                }}
              >
                <InputBase
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onCompositionStart={() => setIsComposing(true)}
                  onCompositionEnd={() => setIsComposing(false)}
                  onKeyDown={async (event) => {
                    if (event.key !== 'Enter' || isComposing) {
                      return;
                    }
                    event.preventDefault();
                    const value = draft.trim();
                    if (!value) {
                      return;
                    }
                    setDraft('');
                    await submitQuery(value);
                  }}
                  placeholder={uiText.placeholder}
                  fullWidth
                  multiline={false}
                  sx={{
                    color: theme.palette.mode === 'dark' ? theme.palette.common.white : 'rgba(30,41,59,0.96)',
                    fontSize: 15,
                    lineHeight: 1.4,
                    '& input': {
                      py: 0,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    },
                    '& input::placeholder': {
                      color: theme.palette.mode === 'dark' ? 'rgba(148,163,184,0.72)' : 'rgba(100,116,139,0.78)',
                      opacity: 1,
                    },
                  }}
                />
                <IconButton
                  size="small"
                  disableRipple
                  sx={{
                    width: 34,
                    height: 34,
                    color: theme.palette.mode === 'dark' ? 'rgba(191,219,254,0.92)' : 'rgba(37,99,235,0.9)',
                    bgcolor: theme.palette.mode === 'dark' ? 'rgba(30,41,59,0.92)' : 'rgba(239,246,255,0.96)',
                    border: '1px solid',
                    borderColor: theme.palette.mode === 'dark' ? 'rgba(96,165,250,0.2)' : 'rgba(59,130,246,0.18)',
                    '&:hover': {
                      bgcolor: theme.palette.mode === 'dark' ? 'rgba(30,41,59,0.98)' : 'rgba(239,246,255,1)',
                    },
                  }}
                >
                  <MicRoundedIcon fontSize="small" />
                </IconButton>
              </Box>
              <IconButton
                onClick={onClose}
                size="small"
                sx={{ color: theme.palette.mode === 'dark' ? theme.palette.common.white : 'rgba(71,85,105,0.88)' }}
              >
                <CloseRoundedIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <Box
              sx={{
                height: '100%',
                '& .flex.items-center.justify-between.px-6.py-4': {
                  display: 'none',
                },
                '& .flex-1.min-h-0.relative.z-10': {
                  borderTop: 'none',
                },
              }}
            >
              <AgentPanel
                title=""
                description=""
                headerActions={<Box />}
                messages={messages}
                onSend={async (content) => {
                  await submitQuery(content);
                }}
                onStop={() => {
                  abortRef.current?.abort();
                  abortRef.current = null;
                  setIsResponding(false);
                  setAgentStatus('idle');
                }}
                onRegenerate={async () => {
                  const lastQuery = lastSubmittedQueryRef.current.trim();
                  if (!lastQuery) {
                    return;
                  }
                  await submitQuery(lastQuery);
                }}
                isResponding={isResponding}
                agentStatus={agentStatus}
                placeholder={uiText.placeholder}
                streamIntervalMs={14}
                streamChunkSize={8}
                onMessageStreamingComplete={(messageId) => {
                  setMessages((prev) =>
                    prev.map((message) =>
                      message.id === messageId ? { ...message, isStreaming: false } : message,
                    ),
                  );
                }}
                cardHooks={cardHooks}
                showInput={false}
              />
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
