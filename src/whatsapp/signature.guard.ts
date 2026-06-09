import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  RawBodyRequest,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request } from 'express';

/**
 * Verifies Meta's X-Hub-Signature-256 header: an HMAC-SHA256 of the raw
 * request body, keyed with your app secret. Without this check, anyone who
 * discovers the webhook URL can inject fake "incoming messages".
 */
@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  private readonly logger = new Logger(WebhookSignatureGuard.name);
  private warnedMissingSecret = false;

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.config.get<string>('whatsapp.appSecret');

    // No secret configured: allow, but warn. Local tunnels and test numbers
    // often run before the Meta app secret exists.
    if (!secret) {
      if (!this.warnedMissingSecret) {
        this.logger.warn(
          'WHATSAPP_APP_SECRET is not set, skipping webhook signature verification. Set it before production.',
        );
        this.warnedMissingSecret = true;
      }
      return true;
    }

    const req = context.switchToHttp().getRequest<RawBodyRequest<Request>>();
    const header = req.headers['x-hub-signature-256'];
    if (typeof header !== 'string' || !header.startsWith('sha256=')) {
      throw new ForbiddenException('Missing webhook signature');
    }

    const expected = createHmac('sha256', secret)
      .update(req.rawBody ?? Buffer.alloc(0))
      .digest('hex');
    const received = header.slice('sha256='.length);

    if (!safeEqualHex(received, expected)) {
      throw new ForbiddenException('Invalid webhook signature');
    }
    return true;
  }
}

function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
