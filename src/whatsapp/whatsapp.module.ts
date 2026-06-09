import { Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { AgentService } from './agent.service';
import { LlmService } from './llm.service';
import { ConversationStore } from './conversation.store';
import { WebhookSignatureGuard } from './signature.guard';

@Module({
  controllers: [WhatsappController],
  providers: [WhatsappService, AgentService, LlmService, ConversationStore, WebhookSignatureGuard],
})
export class WhatsappModule {}
