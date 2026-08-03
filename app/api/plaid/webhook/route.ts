import { createHash, createPublicKey, createVerify } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getPlaidClient } from '@/lib/plaid/client';
import { syncPlaidItem } from '@/lib/plaid/sync';

export async function POST(request: Request) {
  const body = await request.text();
  const verification = request.headers.get('plaid-verification');
  if (!verification || !(await verifyPlaidWebhook(body, verification))) {
    return NextResponse.json({ error: 'Invalid Plaid webhook signature.' }, { status: 401 });
  }

  const payload = JSON.parse(body) as { webhook_type?: string; webhook_code?: string; item_id?: string };
  if (payload.webhook_type !== 'TRANSACTIONS' || !payload.item_id) return NextResponse.json({ ok: true });

  try {
    await syncPlaidItem(payload.item_id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Plaid webhook sync failed', { itemId: payload.item_id, error });
    return NextResponse.json({ error: 'Transaction sync failed.' }, { status: 500 });
  }
}

async function verifyPlaidWebhook(body: string, token: string) {
  try {
    const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
    if (!encodedHeader || !encodedPayload || !encodedSignature) return false;
    const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString()) as { kid?: string; alg?: string };
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString()) as { request_body_sha256?: string; exp?: number };
    if (!header.kid || header.alg !== 'ES256' || !payload.request_body_sha256 || !payload.exp) return false;
    if (payload.exp < Math.floor(Date.now() / 1000)) return false;
    const bodyHash = createHash('sha256').update(body).digest('hex');
    if (bodyHash !== payload.request_body_sha256) return false;

    const keyResponse = await getPlaidClient().webhookVerificationKeyGet({ key_id: header.kid });
    const publicKey = createPublicKey({ key: keyResponse.data.key as JsonWebKey, format: 'jwk' });
    return createVerify('SHA256')
      .update(`${encodedHeader}.${encodedPayload}`)
      .verify(publicKey, Buffer.from(encodedSignature, 'base64url'));
  } catch {
    return false;
  }
}
