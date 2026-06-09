# WhatsApp AI Agent Starter

A production-minded starter for a WhatsApp business agent. It answers customer questions from your own knowledge base, captures leads, and hands off to a human when it should. Built on the WhatsApp Cloud API with NestJS and TypeScript.

This is the kind of build clients ask for under names like "WhatsApp chatbot with lead capture" or "AI front desk." It is meant to be the reliable, owned version, not a no-code wiring job that breaks when the workflow changes.

## How it works
1. WhatsApp sends incoming messages to your webhook.
2. The agent reads the message, pulls context from your knowledge base, and decides how to reply.
3. The agent can call tools: capture a lead, or request a human.
4. If it requests a human, the bot goes quiet for that conversation and notifies your team. A human can take over without the bot talking over them.
5. Replies go back out through the WhatsApp Cloud API.

## Features
- WhatsApp Cloud API integration: webhook verification, message receiving, and sending.
- Grounded answers from a small knowledge base you control (`data/knowledge-base.md`).
- Tool-calling: `capture_lead` and `request_human`, easy to extend.
- Human handoff with a per-conversation flag, so the bot stops auto-replying once a person steps in.
- Clean NestJS structure: modules, DI, typed config, and a unit test.

## Prerequisites
You need a Meta (Facebook) app with WhatsApp set up. From the Meta dashboard you will get:
- A WhatsApp Phone Number ID
- A permanent or temporary Access Token
- A Verify Token (you choose this string yourself)

## Quick start
```bash
git clone https://github.com/afhamahmed1/whatsapp-ai-agent.git
cd whatsapp-ai-agent
npm install
cp .env.example .env        # fill in your WhatsApp and OpenAI values
npm run start:dev
```

To receive WhatsApp messages on your local machine, expose the server with a tunnel:
```bash
npx localtunnel --port 3000
# or use ngrok / cloudflared
```
Then in the Meta dashboard, set the webhook callback URL to:
```
https://YOUR-TUNNEL-URL/webhooks/whatsapp
```
and use the same Verify Token you put in `.env`. Subscribe to the `messages` field.

## Configuration
| Var | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | (none) | Required. Your OpenAI key. |
| `OPENAI_MODEL` | `gpt-4o-mini` | Chat model. |
| `WHATSAPP_VERIFY_TOKEN` | (none) | The string you set in the Meta webhook setup. |
| `WHATSAPP_ACCESS_TOKEN` | (none) | Token used to send messages. |
| `WHATSAPP_PHONE_NUMBER_ID` | (none) | Your WhatsApp phone number ID. |
| `GRAPH_API_VERSION` | `v21.0` | Meta Graph API version. |
| `HUMAN_HANDOFF_NUMBER` | (none) | Optional. A number to notify on handoff (E.164, no +). |
| `PORT` | `3000` | HTTP port. |

## How the agent decides
The agent puts your whole knowledge base in context, which is fine for a small FAQ. It then answers using only that context. If the customer wants to book or buy, it calls `capture_lead`. If it cannot help or the customer asks for a person, it calls `request_human`, which flips the conversation into handoff mode.

For a large knowledge base, swap the "whole KB in context" step for retrieval (embeddings plus a vector store). The embeddable-support-agent repo shows that pattern, and the agent interface here stays the same.

## Adding a tool
Tools live in `src/whatsapp/agent.service.ts`. Add a definition and a case in the handler. The model decides when to call it.

## Project structure
```
src/
├── main.ts
├── app.module.ts
├── config/configuration.ts
└── whatsapp/
    ├── whatsapp.module.ts
    ├── whatsapp.controller.ts   # GET verify, POST receive
    ├── whatsapp.service.ts      # send messages via the Cloud API
    ├── agent.service.ts         # LLM reply, tools, handoff
    ├── llm.service.ts           # OpenAI wrapper
    ├── conversation.store.ts    # per-number history and handoff flag
    └── webhook.types.ts
data/   knowledge-base.md
test/   agent.service.spec.ts
```

## Production notes
- Process webhooks on a queue. Meta retries if you are slow, which can cause double replies.
- Move the conversation store to Redis or a database. The in-memory map resets on restart and does not scale across instances.
- Verify the `X-Hub-Signature-256` header on incoming requests for real deployments.

## Roadmap
- [ ] Signature verification middleware
- [ ] Redis-backed conversation store
- [ ] Retrieval for large knowledge bases
- [ ] Quick-reply buttons and templates
- [ ] Admin view of captured leads

## License
MIT, Afham Ahmed
