# Resolve AI Refund Agent

A fully working Next.js App Router demo for an AI customer-support refund agent. The UI and backend are written in **JSX/JavaScript  with Tailwind CSS and a tool-driven refund decision engine.

## Included

- Customer and admin demo authentication with role-based UI protection
- Customer support chat with refund requests, order lookup, eligibility checks, decisions, refund IDs, and amounts
- 15 CRM customer profiles and 15 realistic mock orders
- Strict refund policy: 30-day window, delivered-only orders, non-refundable categories, damaged-item rule, duplicate-refund protection, and ₹50,000 manual-review threshold
- Backend agent workflow with structured tools: `get_customer`, `get_order`, `get_refund_policy`, `check_refund_eligibility`, `create_refund`, `deny_refund`, and agent logging
- Admin dashboard statistics, customers, orders, refunds, manual approval/rejection, agent execution logs, and policy library
- Responsive mobile navigation and accessible status badges/loading states
- No private chain-of-thought is exposed; the admin sees structured tool activity only

## Demo accounts

- Admin: `admin@example.com` / `admin123`
- Customer: `customer@example.com` / `customer123`

## Run locally

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Project structure

- `app/page.jsx` — role-aware customer/admin application UI
- `app/api/refund/route.js` — GET CRM data, POST agent execution, PUT manual-review decisions
- `data/refund-data.js` — mock CRM, orders, policy, refund store, agent tools, and structured logs
- `app/globals.css` — Tailwind and design tokens

## Gemini API

The refund agent uses the Google Gemini API to write a concise, customer-facing reply based on the verified customer, order, policy, and eligibility result. Refund eligibility and approval decisions are calculated by the server-side policy engine; Gemini does not decide whether a refund is approved. If Gemini is not configured or a request fails, the app returns its built-in response instead.

The API call runs only in `app/api/refund/route.js`. Configure it in `.env.local`:

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.5-flash-lite
```

`GOOGLE_API_KEY` can be used instead of `GEMINI_API_KEY`. `GEMINI_MODEL` is optional; the app has a default model and fallback models. Keep API keys in server-side environment variables, and never commit `.env.local` or expose a key in client-side code. The example variables are also listed in `.env.example`.

## Production data

This demo uses an in-memory mock CRM so it can run without a database. For production, replace the exports in `data/refund-data.js` with persistent `User`, `Customer`, `Order`, `Refund`, `AgentLog`, and `Policy` storage. Keep ownership checks, refund eligibility, and policy decisions server-side. Configure deployment secrets through your hosting provider's environment-variable settings.




