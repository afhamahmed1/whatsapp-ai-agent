import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Sends messages through the WhatsApp Cloud API (Graph API).
 */
@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(private readonly config: ConfigService) {}

  async sendText(to: string, body: string): Promise<void> {
    const version = this.config.get<string>('whatsapp.graphApiVersion') ?? 'v21.0';
    const phoneNumberId = this.config.get<string>('whatsapp.phoneNumberId');
    const token = this.config.get<string>('whatsapp.accessToken');

    if (!phoneNumberId || !token) {
      this.logger.warn('WhatsApp credentials are missing, cannot send the message.');
      return;
    }

    const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body },
        }),
      });
      if (!res.ok) {
        const detail = await res.text();
        this.logger.error(`WhatsApp send failed (${res.status}): ${detail}`);
      }
    } catch (err) {
      this.logger.error(`WhatsApp send error: ${(err as Error).message}`);
    }
  }
}
