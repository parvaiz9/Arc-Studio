import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { parseEventLogs } from 'viem'
import { arcTestnet } from 'viem/chains'
import { ConnectKitButton } from 'connectkit'
import { Bot, ExternalLink, CheckCircle, AlertCircle, Loader2, Cpu } from 'lucide-react'
import { buildTxExplorerUrl } from '@/onchain-facts'
import AgentCard from './components/AgentCard'
import PaymentServerPanel from './components/PaymentServerPanel'

// ─── ERC-8004 Identity Registry (Arc Testnet) ─────────────────────────────────
const IDENTITY_REGISTRY = '0x8004A818BFB912233c491871b3d84c89A494BD9e' as const

const identityAbi = [
  {
    type: 'function' as const,
    name: 'register',
    stateMutability: 'nonpayable' as const,
    inputs: [{ name: 'agentURI', type: 'string' as const }],
    outputs: [{ name: 'agentId', type: 'uint256' as const }],
  },
  {
    type: 'event' as const,
    name: 'Registered',
    inputs: [
      { name: 'agentId', type: 'uint256' as const, indexed: true as const },
      { name: 'agentURI', type: 'string' as const, indexed: false as const },
      { name: 'owner', type: 'address' as const, indexed: true as const },
    ],
  },
] as const

interface AgentMeta {
  name: string
  description: string
  price: string
}

interface RegisteredAgent extends AgentMeta {
  agentId: bigint
  txHash: string
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [agent, setAgent] = useState<RegisteredAgent | null>(null)

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: 'var(--bg-gradient)' }}>
      {/* Nav */}
      <header className="flex items-center justify-between px-5 py-4 max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(172,198,233,0.15)' }}>
            <Cpu size={16} style={{ color: 'var(--accent)' }} />
          </div>
          <span className="display font-semibold text-sm" style={{ color: 'var(--ink)' }}>Arc Agent</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: 'rgba(172,198,233,0.15)', color: 'var(--accent)' }}>
            Testnet
          </span>
        </div>
        <ConnectKitButton />
      </header>

      {/* Hero */}
      <section className="px-5 pt-6 pb-4 max-w-2xl mx-auto w-full">
        <h1 className="display font-bold text-3xl leading-tight" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>
          Onchain Agent Identity
        </h1>
        <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--muted)', maxWidth: '44ch' }}>
          Register your agent on Arc via ERC-8004, then accept pay-per-call USDC payments via x402.
        </p>
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          {['ERC-8004', 'x402 Nanopayments', 'Arc Testnet', 'USDC gas'].map(tag => (
            <span key={tag} className="text-xs px-2.5 py-1 rounded-full font-medium"
              style={{ background: 'var(--surface-muted)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
              {tag}
            </span>
          ))}
        </div>
      </section>

      {/* Main */}
      <main className="flex-1 px-5 pb-12 max-w-2xl mx-auto w-full flex flex-col gap-5">
        {!agent
          ? <RegisterForm onRegistered={setAgent} />
          : <PostRegistration agent={agent} onReset={() => setAgent(null)} />
        }

        {/* Footer links */}
        <div className="flex items-center gap-4 justify-center flex-wrap mt-2">
          {[
            { label: 'ERC-8004 spec', href: 'https://eips.ethereum.org/EIPS/eip-8004' },
            { label: 'x402 docs', href: 'https://developers.circle.com/gateway/nanopayments' },
            { label: 'Arc explorer', href: 'https://explorer.testnet.arc.io' },
          ].map(({ label, href }) => (
            <a key={label} href={href} target="_blank" rel="noopener noreferrer"
              className="text-xs hover:underline" style={{ color: 'var(--subtle)' }}>
              {label}
            </a>
          ))}
        </div>
      </main>
    </div>
  )
}

// ─── Register form (step 1) ───────────────────────────────────────────────────
function RegisterForm({ onRegistered }: { onRegistered: (a: RegisteredAgent) => void }) {
  const { address, chainId, isConnected } = useAccount()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const { writeContract, data: hash, isPending, error: writeError, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({ hash })

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('0.01')
  const [committed, setCommitted] = useState(false)

  const isWrongChain = isConnected && chainId !== arcTestnet.id
  const isLoading = isPending || isConfirming

  // Parse agentId from Registered event once tx confirms
  if (isSuccess && receipt && hash && !committed) {
    try {
      const [ev] = parseEventLogs({ abi: identityAbi, eventName: 'Registered', logs: receipt.logs })
      if (ev) {
        setCommitted(true)
        onRegistered({ agentId: ev.args.agentId, txHash: hash, name: name || 'My Arc Agent', description: description || 'An onchain agent payable via x402', price: price || '0.01' })
      }
    } catch { /* event parse may need another tick */ }
  }

  function buildUri() {
    const card = {
      type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
      name: name || 'My Arc Agent',
      description: description || 'An onchain agent payable via x402',
      services: [],
      x402Support: true,
      active: true,
      x402Price: `$${price}/call`,
      registrations: [],
      supportedTrust: ['reputation'],
    }
    return `data:application/json,${encodeURIComponent(JSON.stringify(card))}`
  }

  function handleRegister() {
    if (isWrongChain) { switchChain({ chainId: arcTestnet.id }); return }
    writeContract({ address: IDENTITY_REGISTRY, abi: identityAbi, functionName: 'register', args: [buildUri()], chainId: arcTestnet.id })
  }

  const errorMsg = writeError
    ? writeError.message.includes('user rejected') ? null
      : writeError.message.includes('insufficient') ? 'Insufficient USDC balance. Grab test USDC from the sidebar.'
      : 'Transaction failed. Ensure you are on Arc Testnet.'
    : null

  if (!isConnected) return (
    <div className="rounded-2xl p-6 border flex flex-col items-center gap-4"
      style={{ background: 'var(--surface-strong)', borderColor: 'var(--border)' }}>
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(172,198,233,0.15)' }}>
        <Bot size={24} style={{ color: 'var(--accent)' }} />
      </div>
      <p className="text-sm text-center" style={{ color: 'var(--muted)' }}>
        Connect your wallet to register an ERC-8004 agent on Arc Testnet.
      </p>
      <ConnectKitButton />
    </div>
  )

  // Prevent unused-variable lint warning — address is used implicitly via isConnected guard above
  void address

  return (
    <div className="rounded-2xl p-6 border" style={{ background: 'var(--surface-strong)', borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(172,198,233,0.15)' }}>
          <Bot size={20} style={{ color: 'var(--accent)' }} />
        </div>
        <div>
          <h2 className="display text-base font-semibold" style={{ color: 'var(--ink)' }}>Register Agent Identity</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>ERC-8004 on Arc Testnet</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Field label="Agent Name" value={name} onChange={setName} placeholder="Research Agent" disabled={isLoading || committed} />
        <Field label="Description" value={description} onChange={setDescription} placeholder="Summarizes onchain data for a fee" disabled={isLoading || committed} />

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium tracking-wide uppercase" style={{ color: 'var(--subtle)' }}>x402 Price per call (USDC)</label>
          <div className="flex items-center gap-2 rounded-xl px-4 py-3"
            style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
            <span className="text-sm" style={{ color: 'var(--subtle)' }}>$</span>
            <input type="number" min="0.001" step="0.001" value={price}
              onChange={e => setPrice(e.target.value)} disabled={isLoading || committed}
              className="flex-1 bg-transparent text-sm outline-none tabular-nums" style={{ color: 'var(--ink)' }} />
            <span className="text-xs" style={{ color: 'var(--subtle)' }}>USDC</span>
          </div>
        </div>

        {isWrongChain && (
          <Notice color="danger">Wrong network. Click below to switch to Arc Testnet.</Notice>
        )}
        {errorMsg && (
          <Notice color="danger" icon={<AlertCircle size={15} className="mt-0.5 shrink-0" />}>{errorMsg}</Notice>
        )}
        {committed && hash && (
          <Notice color="success" icon={<CheckCircle size={16} />}>
            Agent registered!
            <a href={buildTxExplorerUrl(arcTestnet.id, hash)} target="_blank" rel="noopener noreferrer"
              className="ml-auto flex items-center gap-1 text-xs" style={{ color: 'var(--accent)' }}>
              Tx <ExternalLink size={12} />
            </a>
          </Notice>
        )}

        {!committed && (
          <button onClick={handleRegister} disabled={isLoading || isSwitching}
            className="w-full rounded-xl py-3.5 text-sm font-semibold transition-all flex items-center justify-center gap-2"
            style={{
              background: isLoading || isSwitching ? 'var(--surface-muted)' : 'var(--accent)',
              color: isLoading || isSwitching ? 'var(--subtle)' : '#0d1b2f',
              cursor: isLoading || isSwitching ? 'not-allowed' : 'pointer',
            }}>
            {isLoading
              ? <><Loader2 size={15} className="animate-spin" />{isPending ? 'Confirm in wallet…' : 'Confirming…'}</>
              : isSwitching ? 'Switching network…'
              : isWrongChain ? 'Switch to Arc Testnet'
              : 'Register on Arc'}
          </button>
        )}

        <p className="text-xs text-center" style={{ color: 'var(--subtle)' }}>
          ~0.006 USDC gas · Gas is USDC on Arc · Grab test USDC from the sidebar
        </p>

        {writeError && !committed && (
          <button onClick={reset} className="text-xs underline text-center" style={{ color: 'var(--subtle)' }}>Try again</button>
        )}
      </div>
    </div>
  )
}

// ─── Post-registration (step 2) ───────────────────────────────────────────────
function PostRegistration({ agent, onReset }: { agent: RegisteredAgent; onReset: () => void }) {
  const { address, isConnected } = useAccount()

  if (!isConnected || !address) return (
    <div className="text-center py-8 flex flex-col items-center gap-3">
      <p className="text-sm" style={{ color: 'var(--muted)' }}>Connect wallet to view agent details.</p>
      <ConnectKitButton />
    </div>
  )

  return (
    <>
      <AgentCard
        agentId={agent.agentId}
        agentName={agent.name}
        agentDescription={agent.description}
        x402Price={agent.price}
        txHash={agent.txHash}
        ownerAddress={address}
      />
      <PaymentServerPanel agentId={agent.agentId} />
      <button onClick={onReset} className="text-xs underline text-center" style={{ color: 'var(--subtle)' }}>
        Register another agent
      </button>
    </>
  )
}

// ─── Shared primitives ────────────────────────────────────────────────────────
function Field({
  label, value, onChange, placeholder, disabled,
}: { label: string; value: string; onChange: (v: string) => void; placeholder: string; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium tracking-wide uppercase" style={{ color: 'var(--subtle)' }}>{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} disabled={disabled}
        className="rounded-xl px-4 py-3 text-sm outline-none"
        style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }} />
    </div>
  )
}

function Notice({
  color, icon, children,
}: { color: 'danger' | 'success'; icon?: React.ReactNode; children: React.ReactNode }) {
  const styles = {
    danger: { background: 'rgba(232,109,122,0.1)', color: 'var(--danger)' },
    success: { background: 'rgba(141,216,159,0.12)', color: 'var(--success)' },
  }
  return (
    <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium" style={styles[color]}>
      {icon}
      {children}
    </div>
  )
}
