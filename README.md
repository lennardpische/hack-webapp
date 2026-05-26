# Delivery Exception Agent: DevxAI

Track 2 supply-chain agent for the Wayfair x Subconscious hackathon. DevxAI triages delivery exceptions, checks mock carrier capacity, reschedules shipments when approved, drafts customer-facing options, and writes an in-memory ops audit log.

**Sponsors:** Wayfair · Subconscious · Baseten · Cloudflare

---

## Judge-ready demo

Run the app, choose **Exception Agent**, and try:

```text
Order WF-10482 missed its delivery window - fix it
```

Expected flow:

1. The agent calls `getShipment` and `getCarrierUpdate`.
2. It diagnoses the missed white-glove window and SLA risk.
3. It calls `getRescheduleSlots` and chooses the best recovery slot.
4. It calls `rescheduleDelivery`, then `draftCustomerCommunication`.
5. It calls `resolveException` and returns Situation, Recommended action, Alternatives, Customer message, and Ops notes.

More sample prompts:

- `What delivery exceptions are open today?`
- `Customer wants the earliest redelivery for tracking 1Z99910482`
- `Summarize options for a weather delay in Denver`
- `Look up order WF-23891 and explain the partial shipment risk`

## What was built

- Mock shipment and exception fixtures in `lib/data/`
- Mutable supply-chain store in `lib/supply-chain/store.ts`
- AI SDK tools in `lib/tools/supply-chain.ts`
- Read-only **Lookup** mode for shipment and exception questions
- Multi-step **Exception Agent** mode for diagnosis, rescheduling, customer drafts, and exception closure
- Dual Subconscious API key failover on quota/rate-limit style errors

---

## Pick your track

Choose one challenge. Your agent should use tools (APIs, MCP, functions) and talk to users through the built-in UI.

### Track 1 — Consumer Shopping Experience

Millions of customers shop for furniture on Wayfair every day.

**Challenge:** Build an agent that improves discovery and the buyer experience.

**Ideas to explore:**
- Style or room-based product recommendations
- “Help me furnish this room” from a photo or description
- Compare options, explain tradeoffs, answer sizing questions
- Guided search instead of endless filters

### Track 2 — Supply Chain

Wayfair and its supplier network move huge volumes of furniture worldwide.

**Challenge:** Build an agent that improves Wayfair’s ability to manage its supply chain.

**Ideas to explore:**
- Track shipments, flag delays, summarize status
- Answer “where is order X?” or “what’s at risk this week?”
- Coordinate supplier updates, inventory, or routing decisions
- Turn messy ops data into clear next steps

### Track 3 — FinOps & Customer Service

Wayfair runs ~$12B in revenue and serves ~22M customers a year.

**Challenge:** Build an agent system that improves internal operations — financial operations or customer service.

**Ideas to explore:**
- Triage support tickets and draft responses
- Look up order/billing history and explain charges
- Summarize finance or ops metrics for a team
- Route issues to the right team with context

---

## Quick start

**1. Get a Subconscious API key**

Sign up at [subconscious.dev/platform](https://www.subconscious.dev/platform) and copy your key (`sky_...`).

**2. Create a .env.local file with your Subconscious API keys**

```bash
pnpm install
cp .env.example .env.local
# Set SUBCONSCIOUS_API_KEY in .env.local
# Optionally set SUBCONSCIOUS_API_KEY_2 for automatic failover
```

**3. Run the app**

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

**4. Try the two modes**

- **Lookup** — read-only shipment lookup and exception summaries
- **Exception Agent** — multi-step delivery exception recovery with write tools

Use **Image** to attach a damage or carrier-note photo for multimodal reasoning.

---

## How to build on this repo

You mostly edit three places:

| What | Where |
|------|--------|
| Supply-chain tools | `lib/tools/supply-chain.ts` |
| Tool bundles | `lib/tools/index.ts` |
| Agent behavior & prompts | `lib/agents/index.ts` |
| Mock data | `lib/data/*.json` |
| Mutable store | `lib/supply-chain/store.ts` |
| MCP integrations | `lib/tools/mcp-tools.ts` |

### Add a tool

Tools are functions your agent can call. Example:

```typescript
// lib/tools/index.ts
export const searchProducts = tool({
  description: "Search furniture by style, room, or keyword",
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    // Call your API, mock data, or Cloudflare Worker
    return { results: [] };
  },
});
```

Add it to `agentTools` in the same file, then customize the prompt in `lib/agents/index.ts` for your track.

### Connect MCP

MCP servers expose tools (files, APIs, databases). Wrap them as AI SDK tools — see `lib/tools/mcp-tools.ts`.

```bash
pnpm add @modelcontextprotocol/sdk
```

### Images (multimodal)

The UI sends images as data URLs. Useful for room photos, screenshots, or docs. Details: `.agents/skills/subconscious-dev/references/multimodal.md`.

### Long-running agents

**Agent** mode runs up to 30 tool steps (`lib/agents/index.ts`). The API allows 5-minute runs (`app/api/chat/route.ts`). Increase either if your demo needs it.

---

## What’s included

- **Subconscious provider** — `lib/subconscious.ts`
- **Lookup + delivery exception agents** — `lib/agents/index.ts`
- **Supply-chain tools** — `lib/tools/supply-chain.ts`
- **Streaming API** — `app/api/chat/route.ts`
- **Chat UI** — `components/chat-app.tsx`
- **Subconscious API skill** — `.agents/skills/subconscious-dev/` (for Cursor/Codex)

Re-install the skill anytime:

```bash
npx skills add https://github.com/subconscious-systems/skills --skill subconscious-dev
```

---

## Environment

| Variable | Required |
|----------|----------|
| `SUBCONSCIOUS_API_KEY` | Yes, unless `SUBCONSCIOUS_API_KEY_2` is set — [get one here](https://www.subconscious.dev/platform) |
| `SUBCONSCIOUS_API_KEY_2` | Recommended fallback key |

The server keeps keys private and uses `SUBCONSCIOUS_API_KEY` first. If Subconscious returns a quota/rate-limit style error (`429`, `402`, or a quota-like `403`), the app retries the same request once with `SUBCONSCIOUS_API_KEY_2` and sticks to that key until restart.

---

## Testing checklist

- `pnpm lint`
- `pnpm build`
- In **Lookup** mode: `What delivery exceptions are open today?`
- In **Exception Agent** mode: `Order WF-10482 missed its delivery window - fix it`
- Confirm the final response includes a customer message and ops notes.
- Try a blocked path: `Reschedule delivered order WF-99002`

---

## Deploy

Set `SUBCONSCIOUS_API_KEY` and optionally `SUBCONSCIOUS_API_KEY_2` on your host, then:

```bash
pnpm build && pnpm start
```

Works on Vercel, Cloudflare, or any Node host.

---

## Links

- [Subconscious Platform](https://www.subconscious.dev/platform) — API keys
- [Subconscious Docs](https://docs.subconscious.dev)
- [Vercel AI SDK — Agents](https://ai-sdk.dev/docs/agents/overview)
- [Subconscious skills repo](https://github.com/subconscious-systems/skills)
