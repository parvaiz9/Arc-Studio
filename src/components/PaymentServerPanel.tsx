import { useState } from 'react'
import { Terminal, Zap, ExternalLink, Loader2, AlertCircle } from 'lucide-react'

interface Props {
  agentId: bigint
}

interface SummarizeResult {
  summary: string
  model: string
  priceCharged: string
  timestamp: string
}

export default function PaymentServerPanel({ agentId }: Props) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SummarizeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [serverInfo, setServerInfo] = useState<{ status?: string; x402?: boolean } | null>(null)
  const [checkingServer, setCheckingServer] = useState(false)

  async function checkServer() {
    setCheckingServer(true)
    try {
      const res = await fetch('/api/health')
      const data = await res.json() as { status?: string; x402?: boolean }
      setServerInfo(data)
    } catch {
      setServerInfo(null)
      setError('Payment server not reachable. Start it with: bun run server/index.ts')
    } finally {
      setCheckingServer(false)
    }
  }

  async function callSummarize() {
    if (!prompt.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/agent/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, agentId: agentId.toString() }),
      })
      if (res.status === 402) {
        setError('Payment required (HTTP 402). Configure a buyer wallet with USDC + Gateway balance to call this endpoint.')
        return
      }
      if (!res.ok) {
        setError(`Server returned ${res.status}`)
        return
      }
      const data = await res.json() as SummarizeResult
      setResult(data)
    } catch {
      setError('Cannot reach payment server. Start it: bun run server/index.ts')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border flex flex-col" style={{ background: 'var(--surface-strong)', borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-3 p-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(172,198,233,0.12)' }}>
          <Zap size={17} style={{ color: 'var(--accent)' }} />
        </div>
        <div>
          <h3 className="display text-sm font-semibold" style={{ color: 'var(--ink)' }}>x402 Paid Endpoint</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>POST /agent/summarize · $0.01 USDC</p>
        </div>
        <a
          href="https://developers.circle.com/gateway/nanopayments"
          target="_blank" rel="noopener noreferrer"
          className="ml-auto flex items-center gap-1 text-xs"
          style={{ color: 'var(--subtle)' }}
        >
          Docs <ExternalLink size={10} />
        </a>
      </div>

      <div className="p-5 flex flex-col gap-4">
        {/* Server status */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { void checkServer() }}
            disabled={checkingServer}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
            style={{
              background: 'var(--surface-muted)',
              border: '1px solid var(--border)',
              color: 'var(--muted)',
              cursor: checkingServer ? 'not-allowed' : 'pointer',
            }}
          >
            {checkingServer ? <Loader2 size={11} className="animate-spin" /> : <Terminal size={11} />}
            Check server
          </button>
          {serverInfo && (
            <span className="text-xs" style={{ color: serverInfo.status === 'ok' ? 'var(--success)' : 'var(--danger)' }}>
              {serverInfo.status === 'ok'
                ? `Server up${serverInfo.x402 ? ' · x402 ready' : ' · x402 configuring'}`
                : 'Server error'}
            </span>
          )}
        </div>

        {/* Call form */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium tracking-wide uppercase" style={{ color: 'var(--subtle)' }}>
            Prompt
          </label>
          <textarea
            rows={2}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Summarize recent Arc governance proposals..."
            className="rounded-xl px-4 py-3 text-sm outline-none resize-none"
            style={{
              background: 'var(--surface-muted)',
              border: '1px solid var(--border)',
              color: 'var(--ink)',
            }}
          />
        </div>

        <button
          onClick={() => { void callSummarize() }}
          disabled={loading || !prompt.trim()}
          className="w-full rounded-xl py-3 text-sm font-semibold transition-all flex items-center justify-center gap-2"
          style={{
            background: loading || !prompt.trim() ? 'var(--surface-muted)' : 'var(--accent)',
            color: loading || !prompt.trim() ? 'var(--subtle)' : '#0d1b2f',
            cursor: loading || !prompt.trim() ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
          {loading ? 'Calling...' : 'Call (pay $0.01 USDC)'}
        </button>

        {error && (
          <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-xs"
            style={{ background: 'rgba(232,109,122,0.08)', color: 'var(--danger)', border: '1px solid rgba(232,109,122,0.18)' }}>
            <AlertCircle size={13} className="mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {result && (
          <div className="rounded-xl p-4 flex flex-col gap-2"
            style={{ background: 'rgba(141,216,159,0.06)', border: '1px solid rgba(141,216,159,0.18)' }}>
            <p className="text-xs font-semibold" style={{ color: 'var(--success)' }}>Response</p>
            <p className="text-sm" style={{ color: 'var(--ink)' }}>{result.summary}</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs" style={{ color: 'var(--subtle)' }}>{result.model}</span>
              <span className="text-xs" style={{ color: 'var(--success)' }}>{result.priceCharged} paid</span>
            </div>
          </div>
        )}

        {/* Setup hint */}
        <div className="rounded-xl p-4" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--subtle)' }}>To enable live x402 payments:</p>
          <ol className="text-xs flex flex-col gap-1.5" style={{ color: 'var(--subtle)' }}>
            <li className="flex gap-2"><span style={{ color: 'var(--accent)' }}>1.</span> Add <span className="mono text-xs px-1 rounded" style={{ background: 'rgba(0,0,0,0.3)' }}>VITE_SELLER_ADDRESS=0x...</span> to .env</li>
            <li className="flex gap-2"><span style={{ color: 'var(--accent)' }}>2.</span> Run <span className="mono text-xs px-1 rounded" style={{ background: 'rgba(0,0,0,0.3)' }}>bun add @circle-fin/x402-batching</span></li>
            <li className="flex gap-2"><span style={{ color: 'var(--accent)' }}>3.</span> Start with <span className="mono text-xs px-1 rounded" style={{ background: 'rgba(0,0,0,0.3)' }}>bun run server/index.ts</span></li>
          </ol>
        </div>
      </div>
    </div>
  )
}
