/**
 * Arc Agent Payment Server
 * x402 / Circle Gateway Nanopayments — seller side
 * Run with: bun run server/index.ts
 */

import express from 'express'
import cors from 'cors'

const app = express()

app.use(cors())
app.use(express.json())

// ─── Check for Gateway middleware ────────────────────────────────────────────
// @circle-fin/x402-batching must be installed. We import dynamically so the
// server still starts without it (for local dev without Circle creds) and
// prints a clear message.

const SELLER_ADDRESS = process.env.VITE_SELLER_ADDRESS
const PORT = process.env.PORT ?? 3001

// ─── Health / info ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    x402: true,
    sellerAddress: SELLER_ADDRESS ?? '(not configured)',
    note: 'Set VITE_SELLER_ADDRESS in .env and install @circle-fin/x402-batching to enable paid endpoints.',
  })
})

// ─── Public endpoint (free) ──────────────────────────────────────────────────
app.get('/agent/info', (_req, res) => {
  res.json({
    name: 'Arc Agent',
    description: 'Onchain AI agent registered via ERC-8004 and payable via x402.',
    x402Support: true,
    endpoints: [
      { path: '/agent/summarize', method: 'POST', price: '$0.01', currency: 'USDC' },
    ],
  })
})

// ─── Paid endpoint ────────────────────────────────────────────────────────────
// Wrapped in an async IIFE so we can await the dynamic import.
;(async () => {
  let gateway: { require: (price: string) => express.RequestHandler } | null = null

  if (!SELLER_ADDRESS) {
    console.warn(
      '[x402] VITE_SELLER_ADDRESS not set in .env — /agent/summarize will run UNPAID (dev mode).',
    )
  } else {
    try {
      const { createGatewayMiddleware } = await import('@circle-fin/x402-batching/server')
      gateway = createGatewayMiddleware({ sellerAddress: SELLER_ADDRESS }) as typeof gateway
      console.log('[x402] Gateway middleware active. Seller:', SELLER_ADDRESS)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn(
        '[x402] @circle-fin/x402-batching not installed or failed to load:',
        msg,
        '\n       Run: bun add @circle-fin/x402-batching',
      )
    }
  }

  // Build the paid handler
  const pricePerCall = '$0.01'
  const paidHandler: express.RequestHandler = async (req, res) => {
    const { prompt = 'No prompt provided' } = req.body as { prompt?: string }

    // Pretend to do AI work here — replace with your real agent logic
    res.json({
      summary: `Summary of: "${prompt}"`,
      model: 'arc-agent-v1',
      priceCharged: pricePerCall,
      timestamp: new Date().toISOString(),
    })
  }

  if (gateway) {
    app.post('/agent/summarize', gateway.require(pricePerCall), paidHandler)
  } else {
    // Dev fallback: serve unpaid so the UI can still show the endpoint
    app.post('/agent/summarize', (_req, res, next) => {
      console.log('[dev] Unpaid /agent/summarize call — configure VITE_SELLER_ADDRESS + x402-batching for production.')
      next()
    }, paidHandler)
  }

  app.listen(PORT, () => {
    console.log(`Arc Agent server listening on :${PORT}`)
    console.log(`  GET  /health`)
    console.log(`  GET  /agent/info`)
    console.log(`  POST /agent/summarize  (${gateway ? 'PAID via x402' : 'unpaid dev mode'})`)
  })
})()
