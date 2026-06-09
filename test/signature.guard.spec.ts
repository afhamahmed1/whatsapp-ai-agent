import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { WebhookSignatureGuard } from '../src/whatsapp/signature.guard';

function contextFor(body: Buffer, header?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        rawBody: body,
        headers: header ? { 'x-hub-signature-256': header } : {},
      }),
    }),
  } as unknown as ExecutionContext;
}

function guardWith(secret?: string): WebhookSignatureGuard {
  const config = { get: () => secret } as unknown as ConfigService;
  return new WebhookSignatureGuard(config);
}

describe('WebhookSignatureGuard', () => {
  const secret = 'test-app-secret';
  const body = Buffer.from(JSON.stringify({ object: 'whatsapp_business_account' }));
  const sign = (payload: Buffer, key: string): string =>
    'sha256=' + createHmac('sha256', key).update(payload).digest('hex');

  it('accepts a correctly signed request', () => {
    const guard = guardWith(secret);
    expect(guard.canActivate(contextFor(body, sign(body, secret)))).toBe(true);
  });

  it('rejects a request signed with the wrong secret', () => {
    const guard = guardWith(secret);
    expect(() => guard.canActivate(contextFor(body, sign(body, 'wrong-secret')))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects a tampered body', () => {
    const guard = guardWith(secret);
    const signature = sign(body, secret);
    const tampered = Buffer.from('{"object":"injected"}');
    expect(() => guard.canActivate(contextFor(tampered, signature))).toThrow(ForbiddenException);
  });

  it('rejects a missing signature header', () => {
    const guard = guardWith(secret);
    expect(() => guard.canActivate(contextFor(body))).toThrow(ForbiddenException);
  });

  it('allows requests when no app secret is configured (dev mode)', () => {
    const guard = guardWith(undefined);
    expect(guard.canActivate(contextFor(body))).toBe(true);
  });
});
