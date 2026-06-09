import { Body, Controller, Get, HttpCode, Logger, Post, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AgentService } from './agent.service';
import { WhatsappService } from './whatsapp.service';
import { extractTextMessages, IncomingText, WhatsappWebhookBody } from './webhook.types';

@Controller('webhooks/whatsapp')
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly agent: AgentService,
    private readonly whatsapp: WhatsappService,
  ) {}

  // Meta calls this once to verify the webhook.
  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ): void {
    const expected = this.config.get<string>('whatsapp.verifyToken');
    if (mode === 'subscribe' && token === expected) {
      res.status(200).send(challenge);
      return;
    }
    res.status(403).send('Forbidden');
  }

  // Incoming messages land here. Respond with 200 fast so Meta does not retry,
  // then process in the background.
  @Post()
  @HttpCode(200)
  receive(@Body() body: WhatsappWebhookBody): { status: string } {
    const messages = extractTextMessages(body);
    void this.process(messages);
    return { status: 'received' };
  }

  private async process(messages: IncomingText[]): Promise<void> {
    for (const message of messages) {
      try {
        const result = await this.agent.handle(message.from, message.name, message.text);
        if (result.reply) {
          await this.whatsapp.sendText(message.from, result.reply);
        }
      } catch (err) {
        this.logger.error(
          `Failed to handle message from ${message.from}: ${(err as Error).message}`,
        );
      }
    }
  }
}
