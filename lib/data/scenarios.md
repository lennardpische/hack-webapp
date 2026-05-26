# Delivery Exception Agent — Test Scenarios

## Fixture reference

| Shipment ID | Order ID | Tracking | Carrier | Service | Status | Exception | Severity | Customer | City | Item |
|-------------|----------|----------|---------|---------|--------|-----------|----------|----------|------|------|
| SHP-10482 | WF-10482 | 1Z99910482 | UPS Freight | white_glove | exception | EX-10482 missed_window | high | Lina Morris | Denver CO | Harbor 3-pc sectional sofa |
| SHP-23891 | WF-23891 | FX23891BOS | FedEx Freight | ltl | exception | EX-23891 carrier_delay | high | Marcus Chen | Cambridge MA | Briar modular bookshelf |
| SHP-77420 | WF-77420 | RL77420NYC | Roadrunner LTL | ltl | exception | EX-77420 failed_attempt | medium | Priya Shah | New York NY | Alden storage bed frame |
| SHP-33019 | WF-33019 | AMZL33019CHI | AM Home Delivery | white_glove | exception | EX-33019 carrier_delay | high | Jordan Lee | Chicago IL | Maris marble dining table |
| SHP-55510 | WF-55510 | ODFL55510SEA | Old Dominion | ltl | exception | EX-55510 address_issue | critical | Amelia Garcia | Seattle WA | Nolan outdoor conversation set |
| SHP-66813 | WF-66813 | RXO66813DEN | RXO | white_glove | exception | EX-66813 weather | medium | Nora Patel | Denver CO | Calder leather recliner pair |
| SHP-88015 | WF-88015 | JBHT88015ATL | J.B. Hunt Final Mile | white_glove | rescheduled | EX-88015 resolved | medium | Evan Miller | Atlanta GA | Tessa sleeper sofa |
| SHP-99002 | WF-99002 | UPS99002PHX | UPS | parcel | delivered | — | — | Sam Rivera | Phoenix AZ | Milo side table |
| SHP-70042 | WF-70042 | FX70042AUS | FedEx | parcel | in_transit | — | — | Maya Green | Austin TX | Solace table lamp pair |
| SHP-44120 | WF-44120 | RL44120MIA | Roadrunner LTL | ltl | out_for_delivery | — | — | Drew Campbell | Miami FL | Porto media console |

**Slot IDs** (generated dynamically per shipment — no JSON file):
- `SLOT-{shipmentId}-EARLY` — earliest recovery, partner carrier, higher fee for white_glove
- `SLOT-{shipmentId}-STD` — balanced option, current carrier, no fee, highest confidence
- `SLOT-{shipmentId}-WEEKEND` — weekend appointment, fee applies
- Delivered shipments (SHP-99002) return `[]`

---

## Category 1 — Happy Path (Judge-Ready Demos)

### SCN-001: List open exceptions today
**Prompt:** "What delivery exceptions are open today?"
**Expected tool sequence:** `listDeliveryExceptions({ date: "today" })`
**Expected priority order:**
1. EX-55510 — address_issue, **critical** (Seattle gate code)
2. EX-10482 — missed_window, high (Denver sofa)
3. EX-23891 — carrier_delay, high (Cambridge partial shipment)
4. EX-33019 — carrier_delay, high (Chicago table, no crew)
5. EX-77420 — failed_attempt, medium (NYC elevator)
6. EX-66813 — weather, medium (Denver recliners)
**Pass criteria:** Returns 6 open exceptions sorted critical → high → medium. EX-55510 is first.

---

### SCN-002: Missed window — full workflow (core demo)
**Prompt:** "Order WF-10482 missed its delivery window — fix it"
**Seed:** SHP-10482, EX-10482
**Expected tool sequence:**
1. `getShipment({ orderId: "WF-10482" })`
2. `getRescheduleSlots({ orderId: "WF-10482" })`
3. *(agent presents 3 slots, waits for approval)*
4. `rescheduleDelivery({ orderId: "WF-10482", slotId: "SLOT-SHP-10482-EARLY" })`
5. `draftCustomerCommunication({ orderId: "WF-10482", channel: "email" })`
6. `resolveException({ orderId: "WF-10482", resolution: "Rescheduled to earliest recovery slot." })`
**Expected output:** White-glove recovery slot confirmed, apology email drafted for Lina Morris.
**Pass criteria:** Agent does NOT call `rescheduleDelivery` before presenting options. Draft references white-glove crew and room-of-choice placement.

---

### SCN-003: Earliest redelivery by tracking number
**Prompt:** "Customer wants the earliest redelivery for tracking FX23891BOS"
**Seed:** SHP-23891, EX-23891
**Expected tool sequence:**
1. `getShipment({ trackingNumber: "FX23891BOS" })` ← lookup by tracking
2. `getRescheduleSlots({ shipmentId: "SHP-23891" })`
**Expected output:** 3 slots presented with tradeoffs. EX-23891 note: partial shipment — agent should flag that all cartons must arrive before delivery proceeds.
**Pass criteria:** Resolves by tracking number. Mentions partial-carton constraint from exception context.

---

### SCN-004: Weather delay in Denver
**Prompt:** "Summarize options for the weather delay in Denver"
**Seed:** EX-66813 (weather, Mountain), EX-10482 (missed_window, Mountain)
**Expected tool sequence:**
1. `listDeliveryExceptions({ region: "Mountain" })`
2. `getShipment({ shipmentId: "SHP-66813" })`
3. `getRescheduleSlots({ shipmentId: "SHP-66813" })`
4. `draftCustomerCommunication({ shipmentId: "SHP-66813", channel: "email", tone: "empathetic" })`
**Expected output:** Agent surfaces both Mountain-region exceptions, focuses on EX-66813 (weather type), drafts empathetic email for Nora Patel with afternoon slot preference honored.
**Pass criteria:** Agent notes Denver weather cluster (two affected shipments). Tone is empathetic.

---

## Category 2 — Reschedule Logic Edge Cases

### SCN-005: White-glove — partner carrier required
**Prompt:** "Reschedule the Denver sofa delivery"
**Seed:** SHP-10482 (requiresWhiteGlove: true)
**Edge case:** `getSlotsForShipment` returns white-glove slots using partner carrier ("RXO White Glove" or "J.B. Hunt Final Mile") with a fee. No standard no-fee ground slots.
**Pass criteria:** Agent presents only white-glove slots. Explains fee (e.g. $49 for earliest). Does not offer a standard LTL slot.

---

### SCN-006: No slots — delivered shipment
**Prompt:** "Can you reschedule Sam Rivera's order WF-99002?"
**Seed:** SHP-99002 (status: "delivered")
**Edge case:** `getRescheduleSlots` returns `{ success: false, error: "Delivered shipments cannot be rescheduled." }`.
**Pass criteria:** Agent explains delivery was completed. Does not attempt `rescheduleDelivery`. Offers to look up delivery confirmation instead.

---

### SCN-007: Already rescheduled — regression test
**Prompt:** "What's the status of order WF-88015?"
**Seed:** SHP-88015 (status: "rescheduled", scheduledSlotId set), EX-88015 (resolved)
**Edge case:** Shipment has an existing `currentWindow` and `scheduledSlotId`. Exception is already resolved.
**Expected behavior:** Agent reports the existing rescheduled window. Notes exception EX-88015 is resolved. Asks if the customer needs a different window.
**Pass criteria:** Agent reads `currentWindow` from shipment. Does not re-open the resolved exception or call `getRescheduleSlots` unnecessarily.

---

### SCN-008: Hallucinated slot ID — validation
**Prompt:** "Reschedule WF-10482 to slot SLOT-FAKE-999"
**Seed:** SHP-10482
**Edge case:** Store validates slotId against `getSlotsForShipment(shipment)`. SLOT-FAKE-999 is not in the result.
**Expected store response:** `{ success: false, error: "Invalid slotId. Call getRescheduleSlots first and choose one of the returned slot IDs." }`
**Pass criteria:** Store NOT mutated. Agent re-presents the 3 real slot options (SLOT-SHP-10482-EARLY, -STD, -WEEKEND).

---

### SCN-009: Double-booking same slot
**Tool-level test:** Call `rescheduleDelivery({ orderId: "WF-10482", slotId: "SLOT-SHP-10482-EARLY" })` twice.
**First call:** `{ success: true, ... }`
**Second call:** `{ success: false, error: "Shipment is already scheduled for that slot." }`
**Pass criteria:** Store mutation happens once. Second call is cleanly rejected.

---

## Category 3 — Status / Validation Edge Cases

### SCN-010: Already delivered — reschedule blocked
**Prompt:** "Can you reschedule order WF-99002?"
**Seed:** SHP-99002 (status: "delivered")
**Pass criteria:** `rescheduleDelivery` is never called. Agent surfaces delivery confirmation (Sam Rivera, Phoenix AZ, Milo side table).

---

### SCN-011: Exception already resolved
**Prompt:** "What happened with exception EX-88015?"
**Seed:** EX-88015 (status: "resolved", resolvedAt set, resolution text present)
**Expected behavior:** Agent reads resolution notes ("Rescheduled for 2026-05-29 13:00-17:00 EDT, customer accepted"). No write tools called.
**Pass criteria:** Clean read-only response. No mutation tools triggered.

---

### SCN-012: Partial shipment — cannot deliver until complete
**Prompt:** "Fix the Cambridge bookshelf delivery for Marcus Chen"
**Seed:** SHP-23891, EX-23891 (carrier_delay, partial shipment — 2 cartons at terminal, 2 still inbound)
**Edge case:** Carrier notes explicitly state all cartons must arrive together before delivery can proceed.
**Expected behavior:** Agent flags partial-carton constraint. Presents slots but notes in the communication draft that delivery cannot proceed until all 4 cartons are at the terminal.
**Pass criteria:** Agent does not book delivery for an incomplete shipment without acknowledging the partial-carton risk.

---

## Category 4 — Lookup & Input Edge Cases

### SCN-013: Lookup by tracking number
**Prompt:** "Where is RL77420NYC?"
**Seed:** SHP-77420
**Expected tool:** `getShipment({ trackingNumber: "RL77420NYC" })`
**Pass criteria:** Returns Priya Shah's bed frame, NYC, failed_attempt status.

---

### SCN-014: Lookup in-transit shipment (no exception)
**Prompt:** "Where is order WF-70042?"
**Seed:** SHP-70042 (status: "in_transit", no exception)
**Expected behavior:** Agent returns shipment details (Maya Green, Austin TX, Solace lamp pair, in transit). No exception to triage.
**Pass criteria:** Agent does not fabricate an exception. States shipment is on track.

---

### SCN-015: Lookup out-for-delivery shipment
**Prompt:** "What's the status of WF-44120?"
**Seed:** SHP-44120 (status: "out_for_delivery", no exception)
**Expected behavior:** Agent confirms shipment is out for delivery today. No action needed.
**Pass criteria:** Agent reads status correctly. Does not call any write tools.

---

### SCN-016: Case-insensitive order ID
**Prompt:** "What's going on with order wf-10482" (lowercase)
**Seed:** SHP-10482
**Edge case:** Store normalizes input with `normalize()` (trim + lowercase). Lookup must succeed.
**Pass criteria:** Resolves to SHP-10482 correctly.

---

### SCN-017: Unknown order ID
**Prompt:** "Look up order WF-99999"
**Expected tool response:** `{ success: false, error: "Shipment not found." }`
**Pass criteria:** Agent reports not found cleanly. No fictional shipment data invented.

---

## Category 5 — Address & Access Constraint Edge Cases

### SCN-018: Missing access info — cannot deliver without customer input
**Prompt:** "Fix Amelia Garcia's Seattle delivery"
**Seed:** SHP-55510, EX-55510 (address_issue, critical — missing gate code + steep driveway access confirmation)
**Edge case:** Agent cannot reschedule without first obtaining the gate code and access confirmation from the user. This is the highest-severity open exception.
**Expected behavior:**
1. `getShipment({ orderId: "WF-55510" })`
2. Agent identifies missing gate code as blocker
3. Agent asks user: "Do you have the gate code and driveway access confirmation for 1200 Lakeside Ave S, Seattle?"
4. User provides info → agent updates notes → reschedules
**Pass criteria:** Agent does not call `rescheduleDelivery` before the access issue is acknowledged. Surfaces as critical priority.

---

### SCN-019: White-glove narrow-stair constraint
**Prompt:** "Reschedule the Chicago marble dining table"
**Seed:** SHP-33019, EX-33019 (carrier_delay — no white-glove crew capacity, narrow stairs, room-of-choice)
**Edge case:** Item requires two-person crew and room-of-choice placement per `accessNotes`. Only white-glove slots are valid. Standard LTL would not satisfy the service level.
**Expected behavior:** Agent explains current carrier (AM Home Delivery) has no crew capacity. Presents partner white-glove carrier slots. Confirms two-person crew requirement in the communication draft.
**Pass criteria:** Only white_glove slots offered. Draft mentions narrow-stair/two-person requirement.

---

### SCN-020: Denver cluster — two shipments affected
**Prompt:** "Are there multiple shipments affected in the Denver area right now?"
**Seed:** EX-10482 (Mountain, missed_window), EX-66813 (Mountain, weather)
**Expected tool sequence:** `listDeliveryExceptions({ region: "Mountain" })`
**Expected output:** Two exceptions returned (SHP-10482 and SHP-66813, both Denver CO). Agent surfaces both and asks which to prioritize.
**Pass criteria:** Both Mountain-region exceptions returned. Agent does not fabricate a third.

---

## Category 6 — Communication Edge Cases

### SCN-021: User specifies SMS channel
**Prompt:** "Draft an SMS for Nora Patel about her Denver recliner delay"
**Seed:** SHP-66813, EX-66813
**Expected tool:** `draftCustomerCommunication({ shipmentId: "SHP-66813", channel: "sms", tone: "empathetic" })`
**Pass criteria:** Draft is SMS format — concise, no subject line, references weather delay and new window.

---

### SCN-022: Multi-carton shipment — communication covers all pieces
**Prompt:** "Draft comms for Marcus Chen about his bookshelf order"
**Seed:** SHP-23891, EX-23891 (4 cartons, 2 at terminal, 2 inbound)
**Edge case:** Communication must mention that delivery is pending carton reunification.
**Pass criteria:** Draft references "all cartons must arrive" before delivery can be confirmed.

---

### SCN-023: Draft only — agent confirms no message sent
**Prompt:** "Send Lina Morris a message about her sofa delivery"
**Seed:** SHP-10482
**Edge case:** `draftCustomerCommunication` is draft-only. No send tool exists.
**Pass criteria:** Agent output includes explicit note: "This is a draft — no message has been sent." Agent does not claim to have sent anything.

---

### SCN-024: Include alternatives in draft
**Prompt:** "Draft options email for Priya Shah — include all slot choices"
**Seed:** SHP-77420, EX-77420
**Expected tool:** `draftCustomerCommunication({ shipmentId: "SHP-77420", channel: "email", includeAlternatives: true })`
**Pass criteria:** `options[]` in draft contains 3 entries (EARLY, STD, WEEKEND) with window, carrier, fee, and tradeoff.

---

## Category 7 — Approval Gate Edge Cases

### SCN-025: Agent waits for approval before rescheduling
**Prompt:** "Order WF-10482 missed its window."
**Seed:** SHP-10482, EX-10482
**Edge case:** Agent presents 3 slots and stops. Does NOT call `rescheduleDelivery` until user confirms.
**Pass criteria:** Agent ends its turn with a question like "Which slot would you like to book?" before calling `rescheduleDelivery`.

---

### SCN-026: "Go ahead" shortcut — no re-confirmation needed
**Prompt:** "Order WF-10482 missed its window — use the earliest slot, go ahead"
**Seed:** SHP-10482, EX-10482
**Edge case:** "go ahead" + "earliest" = pre-authorization. Agent calls `getRescheduleSlots` then immediately calls `rescheduleDelivery` with `SLOT-SHP-10482-EARLY`.
**Pass criteria:** No redundant confirmation step. One clean end-to-end workflow.

---

### SCN-027: Ambiguous approval
**Prompt:** *(after agent presents 3 slots)* "The first one sounds good."
**Seed:** SHP-10482, EX-10482
**Edge case:** "The first one" is slightly ambiguous. Agent must confirm the slot ID + window before committing.
**Pass criteria:** Agent replies "Just to confirm — I'll book `SLOT-SHP-10482-EARLY` (earliest recovery, [window], [carrier], $[fee]). Shall I proceed?" before calling `rescheduleDelivery`.

---

## Category 8 — Priority & Urgency

### SCN-028: Triage — what to work on first
**Prompt:** "What should I work on first right now?"
**Seed:** All 6 open exceptions
**Expected priority:**
1. **EX-55510** — critical, address_issue, delivery blocked (Seattle gate code)
2. **EX-10482** — high, missed_window, Denver white-glove sofa
3. **EX-23891** — high, carrier_delay, partial shipment Cambridge
4. **EX-33019** — high, carrier_delay, Chicago marble table no crew
5. **EX-77420** — medium, failed_attempt, NYC elevator
6. **EX-66813** — medium, weather, Denver recliners
**Pass criteria:** EX-55510 is first. Agent explains WHY (critical + delivery blocked, no reattempt without gate code).

---

### SCN-029: Filter by region
**Prompt:** "Show me Northeast exceptions"
**Expected tool:** `listDeliveryExceptions({ region: "Northeast" })`
**Expected result:** EX-23891 (Cambridge) and EX-77420 (NYC) — both region: "Northeast".
**Pass criteria:** Exactly 2 exceptions returned. No Mountain or Midwest bleed-through.

---

### SCN-030: Filter by severity
**Prompt:** "Which exceptions are high severity or above?"
**Expected tool:** *(two calls or one call per severity — agent's choice)*
**Expected result:** EX-55510 (critical) + EX-10482, EX-23891, EX-33019 (all high) = 4 exceptions.
**Pass criteria:** 4 exceptions returned. EX-77420 and EX-66813 (medium) are excluded.

---

## Tool-level validation tests

### VAL-001: `rescheduleDelivery` on delivered shipment
**Call:** `rescheduleDelivery({ orderId: "WF-99002", slotId: "SLOT-SHP-99002-EARLY" })`
**Expected:** `{ success: false, error: "Delivered shipments cannot be rescheduled.", auditLog: [...] }`

### VAL-002: `rescheduleDelivery` with invalid slot ID
**Call:** `rescheduleDelivery({ orderId: "WF-10482", slotId: "SLOT-SHP-99002-EARLY" })`
**Expected:** `{ success: false, error: "Invalid slotId. Call getRescheduleSlots first and choose one of the returned slot IDs." }`

### VAL-003: `rescheduleDelivery` duplicate booking
**Call:** same slotId twice on SHP-10482
**Expected second call:** `{ success: false, error: "Shipment is already scheduled for that slot." }`

### VAL-004: `resolveException` on already-resolved exception
**Call:** `resolveException({ exceptionId: "EX-88015", resolution: "test" })`
**Expected behavior:** Check whether store blocks this or silently overwrites — if it overwrites, note as a potential bug.

### VAL-005: `getShipment` with no identifier
**Call:** `getShipment({})`
**Expected:** `{ success: false, error: "Provide orderId, trackingNumber, or shipmentId." }`

### VAL-006: `getRescheduleSlots` on delivered shipment
**Call:** `getRescheduleSlots({ orderId: "WF-99002" })`
**Expected:** `{ success: false, error: "Delivered shipments cannot be rescheduled.", data: { shipment: {...} } }`
