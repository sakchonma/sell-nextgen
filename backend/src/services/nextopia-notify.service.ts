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

export async function sendNextopiaNotification(input: NextopiaNotifyInput) {
  const { apiKey, endpoint } = nextopiaConfig();
  const recipients = (input.recipients || []).filter(item => item.email || item.userId);
  if (!apiKey) {
    console.warn('[nextopia] skip notify: NEXTOPIA_API_KEY is not set');
    return { skipped: true as const, reason: 'missing_api_key' };
  }
  if (recipients.length === 0) {
    console.warn('[nextopia] skip notify: no recipients');
    return { skipped: true as const, reason: 'no_recipients' };
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipients,
        title: input.title,
        message: input.message,
        type: input.type || 'SYSTEM',
        delivery: ['in_app', 'line_push'],
        dedupeKey: input.dedupeKey,
        actionUrl: input.actionUrl,
      }),
    });
    const body = await res.text();
    if (!res.ok) {
      console.error('[nextopia] notify failed', res.status, body.slice(0, 500));
      return { skipped: false as const, ok: false, status: res.status };
    }
    return { skipped: false as const, ok: true, status: res.status, body };
  } catch (err) {
    console.error('[nextopia] notify error', err);
    return { skipped: false as const, ok: false };
  }
}
