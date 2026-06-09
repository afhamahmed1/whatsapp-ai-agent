import { Injectable } from '@nestjs/common';

export interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

interface Conversation {
  history: Turn[];
  handoff: boolean;
}

/**
 * In-memory conversation state, keyed by the customer's WhatsApp number.
 * Swap for Redis or a database in production. This map resets on restart and
 * is not shared across instances.
 */
@Injectable()
export class ConversationStore {
  private readonly conversations = new Map<string, Conversation>();
  private readonly maxTurns = 12;

  private get(id: string): Conversation {
    let conversation = this.conversations.get(id);
    if (!conversation) {
      conversation = { history: [], handoff: false };
      this.conversations.set(id, conversation);
    }
    return conversation;
  }

  getHistory(id: string): Turn[] {
    return this.get(id).history;
  }

  append(id: string, role: 'user' | 'assistant', content: string): void {
    const conversation = this.get(id);
    conversation.history.push({ role, content });
    if (conversation.history.length > this.maxTurns) {
      conversation.history = conversation.history.slice(-this.maxTurns);
    }
  }

  isHandoff(id: string): boolean {
    return this.get(id).handoff;
  }

  setHandoff(id: string, value: boolean): void {
    this.get(id).handoff = value;
  }
}
