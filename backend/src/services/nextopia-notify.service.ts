import { NextopiaLogs } from '../models/db.js';

type NextopiaRecipient = { email?: string; userId?: string };

export type NextopiaNotifyInput = {
  title: string;
  message: string;
  recipients: NextopiaRecipient[];
  dedupeKey: string;
  actionUrl: string;
  type?: 'SYSTEM' | 'BROADCAST' | 'DEADLINE' | 'RISK_ALERT';
};

function nextopiaConfig() {
  const apiKey = String(process.env.NEXTOPIA_API_KEY || '').trim();
  const endpoint = String(process.env.NEXTOPIA_API_URL || 'https://nextopia.work/api/v1/external/notifications').trim();
  return { apiKey, endpoint };
}

export function getPublicAppUrl() {
  const fromEnv = String(process.env.PUBLIC_APP_URL || '').trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const cors = String(process.env.CORS_ORIGIN || '').split(',')[0]?.trim();
  if (cors) return cors.replace(/\/$/, '');
  return 'https://crm.nextgen-education.com';
}

export function quoteApprovalPortalUrl() {
  return `${getPublicAppUrl()}/portal/login`;
}

function parseResponseBody(text: string) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

async function recordNextopiaLog(entry: {
  endpoint: string;
  outcome: 'passed' | 'failed' | 'skipped';
  skipReason?: string;
  httpStatus?: number;
  requestBody: Record<string, unknown>;
  responseBody?: unknown;
  responseText?: string;
  errorMessage?: string;
}) {
  try {
    await NextopiaLogs().insertOne({
      _id: `nxtlog_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      method: 'POST',
      createdAt: new Date(),
      ...entry,
    } as any);
  } catch (err) {
    console.error('[nextopia] failed to store notify log', err);
  }
}

export async function sendNextopiaNotification(input: NextopiaNotifyInput) {
  const { apiKey, endpoint } = nextopiaConfig();
  const recipients = (input.recipients || []).filter(item => item.email || item.userId);
  const requestBody = {
    recipients,
    title: input.title,
    message: input.message,
    type: input.type || 'SYSTEM',
    delivery: ['in_app', 'line_push'],
    dedupeKey: input.dedupeKey,
    actionUrl: input.actionUrl,
  };

  if (!apiKey) {
    console.warn('[nextopia] skip notify: NEXTOPIA_API_KEY is not set');
    await recordNextopiaLog({
      endpoint,
      outcome: 'skipped',
      skipReason: 'missing_api_key',
      requestBody,
      errorMessage: 'NEXTOPIA_API_KEY is not set',
    });
    return { skipped: true as const, reason: 'missing_api_key' };
  }
  if (recipients.length === 0) {
    console.warn('[nextopia] skip notify: no recipients');
    await recordNextopiaLog({
      endpoint,
      outcome: 'skipped',
      skipReason: 'no_recipients',
      requestBody,
      errorMessage: 'no recipients',
    });
    return { skipped: true as const, reason: 'no_recipients' };
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    const text = await res.text();
    const responseBody = parseResponseBody(text);
    if (!res.ok) {
      console.error('[nextopia] notify failed', res.status, text.slice(0, 500));
      await recordNextopiaLog({
        endpoint,
        outcome: 'failed',
        httpStatus: res.status,
        requestBody,
        responseBody,
        responseText: text.slice(0, 8000),
      });
      return { skipped: false as const, ok: false, status: res.status };
    }
    await recordNextopiaLog({
      endpoint,
      outcome: 'passed',
      httpStatus: res.status,
      requestBody,
      responseBody,
      responseText: text.slice(0, 8000),
    });
    return { skipped: false as const, ok: true, status: res.status, body: text };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[nextopia] notify error', err);
    await recordNextopiaLog({
      endpoint,
      outcome: 'failed',
      requestBody,
      errorMessage,
    });
    return { skipped: false as const, ok: false };
  }
}
