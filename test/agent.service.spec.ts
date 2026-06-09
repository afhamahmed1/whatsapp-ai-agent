import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AgentService } from '../src/whatsapp/agent.service';
import { LlmService } from '../src/whatsapp/llm.service';
import { ConversationStore } from '../src/whatsapp/conversation.store';
import { WhatsappService } from '../src/whatsapp/whatsapp.service';

describe('AgentService', () => {
  let agent: AgentService;
  const llm = { chat: jest.fn() };
  const whatsapp = { sendText: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AgentService,
        ConversationStore,
        { provide: LlmService, useValue: llm },
        { provide: WhatsappService, useValue: whatsapp },
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();

    agent = moduleRef.get(AgentService);
  });

  it('answers from the knowledge base when no tool is called', async () => {
    llm.chat.mockResolvedValueOnce({
      role: 'assistant',
      content: 'A standard clean starts at $120.',
      tool_calls: [],
    });

    const res = await agent.handle('15551234567', 'Sam', 'How much is a standard clean?');

    expect(res.reply).toContain('$120');
    expect(res.handoff).toBe(false);
  });

  it('goes quiet after a human takes over', async () => {
    llm.chat
      .mockResolvedValueOnce({
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 't1',
            type: 'function',
            function: { name: 'request_human', arguments: '{"reason":"complex request"}' },
          },
        ],
      })
      .mockResolvedValueOnce({
        role: 'assistant',
        content: 'Connecting you with a team member now.',
        tool_calls: [],
      });

    const first = await agent.handle('15550000000', 'Sam', 'I have a complicated job');
    expect(first.handoff).toBe(true);
    expect(first.reply).toContain('Connecting');

    const second = await agent.handle('15550000000', 'Sam', 'are you there?');
    expect(second.reply).toBeNull();
    expect(second.handoff).toBe(true);
  });
});
