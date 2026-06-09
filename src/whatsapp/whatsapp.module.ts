import { Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { AgentService } from './agent.service';
import { LlmService } from './llm.service';
import { ConversationStore } from './conversation.store';

@Module({
  controllers: [WhatsappController],
  providers: [WhatsappService, AgentService, LlmService, ConversationStore],
})
export class WhatsappModule {}
