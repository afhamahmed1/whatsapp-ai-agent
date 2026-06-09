import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';
import { LlmService } from './llm.service';
import { ConversationStore } from './conversation.store';
import { WhatsappService } from './whatsapp.service';

export interface AgentResult {
  reply: string | null;
  handoff: boolean;
}

const MAX_TOOL_ITERATIONS = 3;

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly knowledgeBase: string;

  private readonly tools: ChatCompletionTool[] = [
    {
      type: 'function',
      function: {
        name: 'capture_lead',
        description: 'Save a customer lead when they want to book, buy, or be contacted.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            interest: {
              type: 'string',
              description: 'What they want, for example "deep clean next Tuesday".',
            },
          },
          required: ['interest'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'request_human',
        description:
          'Hand the conversation to a human when you cannot help or the customer asks for a person.',
        parameters: {
          type: 'object',
          properties: { reason: { type: 'string' } },
          required: ['reason'],
        },
      },
    },
  ];

  constructor(
    private readonly llm: LlmService,
    private readonly store: ConversationStore,
    private readonly whatsapp: WhatsappService,
    private readonly config: ConfigService,
  ) {
    this.knowledgeBase = this.loadKnowledgeBase();
  }

  private loadKnowledgeBase(): string {
    try {
      return readFileSync(join(__dirname, '..', '..', 'data', 'knowledge-base.md'), 'utf-8');
    } catch {
      this.logger.warn('Knowledge base not found, the agent has no business context.');
      return '';
    }
  }

  async handle(from: string, name: string, text: string): Promise<AgentResult> {
    // Once a human has taken over, the bot stays quiet for this conversation.
    if (this.store.isHandoff(from)) {
      return { reply: null, handoff: true };
    }

    const system = [
      'You are the assistant for a business on WhatsApp. Answer only from the business info below.',
      'Keep replies short and friendly, the length of a normal chat message.',
      'If the customer wants to book or buy, call capture_lead.',
      'If you cannot answer from the info, or the customer asks for a person, call request_human.',
      'Never invent prices or policies.',
      '',
      'Business info:',
      this.knowledgeBase || '(none provided)',
    ].join('\n');

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: system },
      ...this.store
        .getHistory(from)
        .map((t) => ({ role: t.role, content: t.content }) as ChatCompletionMessageParam),
      { role: 'user', content: text },
    ];

    let handoff = false;

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const reply = await this.llm.chat(messages, this.tools);
      messages.push(reply as ChatCompletionMessageParam);

      const calls = reply.tool_calls ?? [];
      if (!calls.length) {
        const answer = reply.content ?? '';
        this.store.append(from, 'user', text);
        this.store.append(from, 'assistant', answer);
        return { reply: answer, handoff };
      }

      for (const call of calls) {
        if (call.type !== 'function') continue;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function.arguments || '{}');
        } catch {
          this.logger.warn(`Invalid tool arguments for ${call.function.name}`);
        }
        const result = await this.runTool(call.function.name, args, from, name);
        if (call.function.name === 'request_human') handoff = true;
        messages.push({ role: 'tool', tool_call_id: call.id, content: result });
      }
    }

    // The model kept calling tools without writing a reply. Close politely.
    const fallback = 'Thanks. Someone from the team will follow up with you shortly.';
    this.store.append(from, 'user', text);
    this.store.append(from, 'assistant', fallback);
    return { reply: fallback, handoff };
  }

  private async runTool(
    name: string,
    args: Record<string, unknown>,
    from: string,
    contactName: string,
  ): Promise<string> {
    switch (name) {
      case 'capture_lead': {
        const lead = {
          from,
          name: (args.name as string) || contactName || 'unknown',
          interest: (args.interest as string) ?? '',
        };
        this.logger.log(`Lead captured: ${JSON.stringify(lead)}`);
        // TODO: save to a CRM, a database, or a Google Sheet.
        return JSON.stringify({ saved: true });
      }
      case 'request_human': {
        this.store.setHandoff(from, true);
        const reason = (args.reason as string) || 'customer asked for a person';
        this.logger.log(`Handoff for ${from}: ${reason}`);
        const notify = this.config.get<string>('humanHandoffNumber');
        if (notify) {
          await this.whatsapp.sendText(notify, `Handoff needed for ${from}. Reason: ${reason}`);
        }
        return JSON.stringify({ handedOff: true });
      }
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  }
}
