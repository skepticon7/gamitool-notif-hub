import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import axios from 'axios';

// --- What this is, for context (first time touching n8n) ---
//
// n8n is a workflow-automation tool: you build a "workflow" visually, as a
// chain of boxes ("nodes") connected by lines. Every workflow starts with a
// TRIGGER node — the thing that kicks it off. The trigger we care about here
// is the "Webhook" node: when you drop one into a workflow, n8n gives it a
// unique URL. Any HTTP request sent to that URL starts the workflow, and
// whatever JSON body was sent becomes available to every node after it as
// `{{$json.fieldName}}`.
//
// --- Single-workflow design (one graph, branching happens inside n8n) ---
//
// Every notification, regardless of channel, hits the SAME webhook URL
// (`${N8N_WEBHOOK_BASE_URL}/webhook/notify`) — this processor never varies
// the URL. The `channel` field in the body ("email", "sms", "discord", ...)
// is what tells n8n which real send-step to run. The workflow you build in
// n8n's editor should look like this, left to right:
//
//   [Webhook: path "notify"] -> [AI Agent] -> [Switch on {{$json.channel}}]
//                                                 |--- "email"   -> Send Email node
//                                                 |--- "sms"     -> Twilio node
//                                                 |--- "discord" -> Discord node
//                                                 |--- ...
//
// The AI Agent node sits BEFORE the Switch, so every notification gets the
// same treatment regardless of which channel it's headed to: give it the
// incoming `{{$json.message}}` (plus `{{$json.name}}` for personalization)
// and a prompt like "rephrase this notification warmly, keep it short,
// address {{$json.name}} by name" — configure its model credential to your
// Claude API key in n8n's Credentials section (n8n's AI Agent node supports
// Anthropic models directly). Its output then becomes the message text each
// branch of the Switch actually sends — so the AI only ever touches
// *content*, never *which channel fires or whether one fires at all*. That
// decision already happened in EDEN (NotifyAction only enqueues a job per
// channel the admin actually selected) — the AI has no say in it, by
// construction, since it never sees a choice to make.
//
// Two URLs matter while you're building this workflow in n8n's editor:
//   - The "Test URL" (path prefix /webhook-test/...) only works while the
//     workflow is open in the editor AND you've clicked "Listen for test
//     event" — good for trying things out, but it stops working the moment
//     you close the tab.
//   - The "Production URL" (path prefix /webhook/...) works permanently,
//     but ONLY once you've toggled the workflow's Active switch (top-right
//     of the editor) to on.
// This processor always calls the production URL, so the workflow needs to
// be Activated before anything actually gets delivered.
//
// --- Authentication ---
//
// The Webhook node has an "Authentication" setting (None / Basic Auth /
// Header Auth / JWT Auth) — leave it on None and anyone who finds this URL
// can trigger real sends carrying employee email/phone/name. Set it to
// **Header Auth**: create a credential in n8n with a header name (e.g.
// `X-Webhook-Secret`) and a value matching N8N_WEBHOOK_SECRET below — this
// processor sends that same header on every call, so only requests from
// EDEN itself will pass.
//
// --- Respond setting (this one affects OUR retry logic, not just security) ---
//
// The Webhook node also has a "Respond" setting, and it matters here:
//   - "Immediately" replies 200 the instant the webhook is received, before
//     the AI Agent / Switch / send node ever run. If you leave it on this,
//     a real Twilio/Gmail failure deep in the workflow can NEVER surface as
//     an HTTP error back to this processor — every call "succeeds" from
//     EDEN's point of view even when nothing was actually delivered, and
//     the retry/backoff below never fires when it should.
//   - "When Last Node Finishes" (or an explicit "Respond to Webhook" node
//     placed at the very end, after the real send node) holds the response
//     until the whole workflow completes and reflects its actual outcome —
//     a genuine delivery failure becomes a non-2xx response, which is what
//     the check below needs to correctly trigger a retry.
// Use "When Last Node Finishes" (or the explicit Respond node), not
// "Immediately".
//
// --- Why this lives in a BullMQ worker instead of calling n8n directly ---
//
// NotifyAction (the rule-engine action that enqueues these jobs) runs
// inside RuleEngineConsumer's MySQL transaction. If it called n8n's HTTP
// endpoint synchronously right there, a slow or unreachable n8n instance
// would stall that transaction — and MySQL commits can't be rolled back by
// a failed HTTP call anyway, so there'd be nothing to gain from doing it
// inline. Enqueuing a job instead means: the rule engine's transaction
// commits immediately regardless of n8n's health, and this worker — running
// completely separately — is the only thing that ever has to deal with
// retries/backoff if n8n is briefly down.
@Processor('n8n')
export class N8nProcessor extends WorkerHost {
  private readonly logger = new Logger(N8nProcessor.name);

  constructor(private readonly configService: ConfigService) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { channel, employeeId, email, phone, name, message, correlationId, sourceEventId } = job.data;

    const baseUrl = this.configService.getOrThrow<string>('N8N_WEBHOOK_BASE_URL');
    const webhookSecret = this.configService.getOrThrow<string>('N8N_WEBHOOK_SECRET');
    // One shared workflow, one shared path — see the design note above.
    // `channel` travels in the body; it's what the Switch node inside n8n
    // branches on, not anything encoded in the URL.
    const url = `${baseUrl}/webhook/notify`;

    const response = await axios.post(
      url,
      {
        channel,
        employeeId,
        email,
        phone,
        name,
        message,
        correlationId,
        sourceEventId,
      },
      {
        timeout: 5000,
        validateStatus: () => true, // read the status ourselves below, don't let axios throw on 4xx/5xx
        // Matches the Header Auth credential configured on the Webhook node
        // — see the Authentication note above.
        headers: { 'X-Webhook-Secret': webhookSecret },
      },
    );

    if (response.status < 200 || response.status >= 300) {
      // Throwing here is what makes BullMQ treat this as a failed attempt
      // and retry it with backoff (configured where this job is enqueued in
      // NotifyAction) — same as a real SMTP/Twilio failure would.
      throw new Error(
        `n8n webhook returned ${response.status} for channel "${channel}": ${JSON.stringify(response.data)}`,
      );
    }

    this.logger.log(
      `[N8N:${channel}] -> ${email ?? phone ?? employeeId}: "${message}" delivered (correlationId: ${correlationId}, attempt ${job.attemptsMade + 1})`,
    );
  }
}
