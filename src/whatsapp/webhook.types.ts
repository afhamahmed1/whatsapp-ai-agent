// Minimal shapes for the WhatsApp Cloud API webhook payload, plus a helper
// that pulls plain text messages out of it.

export interface WhatsappWebhookBody {
  object?: string;
  entry?: WhatsappEntry[];
}

export interface WhatsappEntry {
  id?: string;
  changes?: WhatsappChange[];
}

export interface WhatsappChange {
  field?: string;
  value?: WhatsappValue;
}

export interface WhatsappValue {
  messaging_product?: string;
  metadata?: { phone_number_id?: string; display_phone_number?: string };
  contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
  messages?: WhatsappMessage[];
}

export interface WhatsappMessage {
  from?: string;
  id?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
}

export interface IncomingText {
  from: string;
  name: string;
  text: string;
}

export function extractTextMessages(body: WhatsappWebhookBody): IncomingText[] {
  const out: IncomingText[] = [];
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value?.messages) continue;
      const name = value.contacts?.[0]?.profile?.name ?? '';
      for (const msg of value.messages) {
        if (msg.type === 'text' && msg.from && msg.text?.body) {
          out.push({ from: msg.from, name, text: msg.text.body });
        }
      }
    }
  }
  return out;
}
