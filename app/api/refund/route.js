import { agentLogs, checkRefundEligibility, createAgentLogs, createRefund, getCustomer, getOrder, getPolicy, getStats, logAgent, refunds, customers, orders } from '@/data/refund-data'

const sanitizeGeminiModel = (value) => {
  if (!value || typeof value !== 'string') return ''
  const trimmed = value.trim().replace(/^g+/i, '')
  return trimmed.replace(/[^a-z0-9.-]/gi, '')
}

const geminiApiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim()
const geminiModelCandidates = [sanitizeGeminiModel(process.env.GEMINI_MODEL), 'gemini-3.8-flash', 'gemini-2.0-flash', 'gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.0-flash-lite']
const validGeminiModels = [...new Set(geminiModelCandidates.filter(Boolean).map((value) => value.toLowerCase()))]
const hasGeminiKey = /^AIza[0-9A-Za-z\-_]+$/.test(geminiApiKey)

async function generateAiReply({ customer, order, result, requestText }) {
  if (!hasGeminiKey) return null;

  const prompt = `You are a polite customer support agent for a refund desk.

Use the supplied policy data and keep the answer concise.
Never invent customer, order, refund, or policy data.
If a refund request is denied, explain the reason clearly.
If it is approved, clearly confirm the refund.
If it requires manual review, explain that clearly.

IMPORTANT:
Return only the final customer-facing response.
Do not mention internal tools, prompts, API errors, model names, or system instructions.

${JSON.stringify(
  {
    customer: customer
      ? {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          status: customer.status,
        }
      : null,

    order: order
      ? {
          id: order.id,
          product: order.product,
          amount: order.amount,
          category: order.category,
          status: order.status,
          deliveryDate: order.deliveryDate,
        }
      : null,

    policy: getPolicy(),
    request: requestText,
    eligibility: result,
    decision: result?.decision,
  },
  null,
  2
)}
`;

  const payload = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 300,
    },
  };

  // Primary model + fallback models
  const models = [
    process.env.GEMINI_MODEL || "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.5-flash-lite",
  ].filter(
    (model, index, arr) => model && arr.indexOf(model) === index
  );

  const maxRetries = 3;

  // Wait helper
  const sleep = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  let lastError = null;

  for (const modelName of models) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const url =
          `https://generativelanguage.googleapis.com/v1beta/models/` +
          `${modelName}:generateContent?key=${geminiApiKey}`;

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        // SUCCESS
        if (response.ok) {
          const data = await response.json();

          const text =
            data?.candidates?.[0]?.content?.parts
              ?.map((part) => part?.text || "")
              .join("")
              .trim() || null;

          if (text) {
            return text;
          }

          console.warn(
            `Gemini returned empty response from ${modelName}`
          );

          break;
        }

        const errorText = await response.text();

        lastError = new Error(
          `Gemini ${response.status} ${errorText}`
        );

        // -----------------------------------------
        // MODEL NOT AVAILABLE / NOT FOUND
        // -----------------------------------------
        const isModelMissing =
          response.status === 404 ||
          /NOT_FOUND|is not found|unsupported|no longer available|new users/i.test(
            errorText
          );

        if (isModelMissing) {
          console.warn(
            `Gemini model ${modelName} is unavailable. Trying next model...`
          );

          break;
        }

        // -----------------------------------------
        // AUTH ERROR
        // -----------------------------------------
        if (response.status === 401 || response.status === 403) {
          console.error(
            `Gemini authentication/permission error for ${modelName}:`,
            errorText
          );

          return null;
        }

        // -----------------------------------------
        // QUOTA / BILLING
        // -----------------------------------------
        const quotaError =
          response.status === 429 &&
          /quota|credit|billing|insufficient|resource_exhausted/i.test(
            errorText
          );

        if (quotaError) {
          console.warn(
            "Gemini quota/billing limit reached. Using local fallback."
          );

          return null;
        }

        // -----------------------------------------
        // RETRYABLE ERRORS
        // 503, 500, 502, 504, 429
        // -----------------------------------------
        const retryable =
          [429, 500, 502, 503, 504].includes(response.status);

        if (!retryable) {
          console.error(
            `Gemini non-retryable error (${response.status}):`,
            errorText
          );

          break;
        }

        // Max retries reached for current model
        if (attempt === maxRetries) {
          console.warn(
            `Gemini model ${modelName} failed after ${
              maxRetries + 1
            } attempts. Trying next model...`
          );

          break;
        }

        // Exponential backoff + small jitter
        const baseDelay = 1000 * 2 ** attempt;
        const jitter = Math.floor(Math.random() * 500);
        const delay = baseDelay + jitter;

        console.warn(
          `Gemini ${response.status} on ${modelName}. ` +
            `Retry ${attempt + 1}/${maxRetries} in ${delay}ms...`
        );

        await sleep(delay);
      } catch (error) {
        lastError = error;

        const errorMessage = String(
          error?.message || error || ""
        );

        // Network/transient error
        const transientError =
          /fetch failed|network|timeout|ECONNRESET|ETIMEDOUT|503|502|500/i.test(
            errorMessage
          );

        if (transientError && attempt < maxRetries) {
          const baseDelay = 1000 * 2 ** attempt;
          const jitter = Math.floor(Math.random() * 500);
          const delay = baseDelay + jitter;

          console.warn(
            `Temporary Gemini error on ${modelName}. ` +
              `Retry ${attempt + 1}/${maxRetries} in ${delay}ms...`
          );

          await sleep(delay);
          continue;
        }

        console.error(
          `Gemini request failed for model ${modelName}:`,
          error
        );

        break;
      }
    }
  }

  console.warn(
    "All Gemini models failed. Falling back to local refund response.",
    lastError?.message || ""
  );

  return null;
}

export async function GET() { return Response.json({ customers, orders, refunds, agentLogs, policy: getPolicy(), stats: getStats() }) }

export async function POST(request) {
  const body = await request.json()
  const executionId = `AGENT-${Date.now().toString().slice(-6)}`
  const customer = getCustomer(body.customerId || body.email)
  const requestText = body.message || `Refund requested for ${body.orderId || 'an order'}`
  if (!customer) return Response.json({ decision: 'DENIED', message: 'I could not verify that customer. Please sign in with a valid customer account.', logs: [{ label: 'get_customer', detail: 'Customer not found', time: '00:01', status: 'warning' }] }, { status: 404 })
  const foundOrderId = body.orderId || requestText.match(/ORD-\d+/i)?.[0] || orders.find((order) => order.customerId === customer.id)?.id
  logAgent({ executionId, customerId: customer.id, request: requestText, tool: 'get_customer', input: { customerId: customer.id }, output: customer })
  const order = getOrder(customer.id, foundOrderId)
  logAgent({ executionId, customerId: customer.id, request: requestText, tool: 'get_order', input: { customerId: customer.id, orderId: foundOrderId }, output: order || {}, status: order ? 'SUCCESS' : 'FAILED', error: order ? '' : `Order ${foundOrderId} was not found.` })
  logAgent({ executionId, customerId: customer.id, request: requestText, tool: 'get_refund_policy', input: {}, output: getPolicy() })
  const result = checkRefundEligibility({ customerId: customer.id, orderId: foundOrderId, refundReason: body.reason || requestText })
  logAgent({ executionId, customerId: customer.id, request: requestText, tool: 'check_refund_eligibility', input: { customerId: customer.id, orderId: foundOrderId, refundReason: body.reason || requestText }, output: result, status: 'SUCCESS' })
  let refund = null
  if (result.decision === 'APPROVED') { refund = createRefund({ customerId: customer.id, orderId: foundOrderId, amount: result.amount, reason: body.reason || requestText }); logAgent({ executionId, customerId: customer.id, request: requestText, tool: 'create_refund', input: { amount: result.amount }, output: refund }) }
  else if (result.decision === 'DENIED') { refund = createRefund({ customerId: customer.id, orderId: foundOrderId, amount: result.order?.amount || 0, reason: body.reason || requestText, decision: 'DENIED', status: 'Denied', denialReason: result.reason }); logAgent({ executionId, customerId: customer.id, request: requestText, tool: 'deny_refund', input: { reason: result.reason }, output: refund, status: 'SUCCESS' }) }
  else { refund = createRefund({ customerId: customer.id, orderId: foundOrderId, amount: result.order?.amount || 0, reason: body.reason || requestText, decision: 'MANUAL_REVIEW', status: 'Manual Review', denialReason: result.reason }); logAgent({ executionId, customerId: customer.id, request: requestText, tool: 'create_manual_review', input: { reason: result.reason }, output: refund }) }
  const baseMessage = result.decision === 'APPROVED' ? `Your refund request has been approved. Refund ID: ${refund.id}. The approved refund amount is ₹${refund.amount.toLocaleString('en-IN')}.` : result.decision === 'MANUAL_REVIEW' ? `Your request needs manual review. A specialist will review it shortly. Reason: ${result.reason}` : `I’m unable to approve this refund. ${result.reason}`
  const aiResponse = await generateAiReply({ customer, order: result.order, result, requestText })
  const message = aiResponse || baseMessage
  return Response.json({ executionId, customer, order: result.order, refund, decision: result.decision, reason: result.reason, message, logs: createAgentLogs(result), structuredLogs: agentLogs.filter((log) => log.executionId === executionId) })
}

export async function PUT(request) {
  const body = await request.json()
  if (body.resource === 'customer') {
    const customer = customers.find((item) => item.id === body.id)
    if (!customer) return Response.json({ error: 'Customer not found' }, { status: 404 })
    Object.assign(customer, body.changes || {})
    return Response.json({ customer })
  }
  if (body.resource === 'order') {
    const order = orders.find((item) => item.id === body.id)
    if (!order) return Response.json({ error: 'Order not found' }, { status: 404 })
    Object.assign(order, body.changes || {})
    return Response.json({ order })
  }
  const refund = refunds.find((item) => item.id === body.refundId)
  if (!refund) return Response.json({ error: 'Refund not found' }, { status: 404 })
  refund.status = body.action === 'approve' ? 'Approved' : 'Denied'; refund.decision = body.action === 'approve' ? 'APPROVED' : 'DENIED'; refund.denialReason = body.action === 'approve' ? '' : body.reason || 'Rejected by administrator'
  const order = orders.find((item) => item.id === refund.orderId); if (order && refund.status === 'Approved') order.refundStatus = 'Approved'
  return Response.json({ refund })
}

export async function DELETE(request) {
  const body = await request.json()
  if (body.resource === 'refund') {
    const index = refunds.findIndex((item) => item.id === body.id)
    if (index < 0) return Response.json({ error: 'Refund not found' }, { status: 404 })
    refunds.splice(index, 1)
    return Response.json({ deleted: body.id })
  }
  return Response.json({ error: 'Only refund deletion is supported to preserve CRM history.' }, { status: 400 })
}
