import { useReadContract } from 'wagmi'
import { arcTestnet } from 'viem/chains'
import { ExternalLink, ShieldCheck, Star } from 'lucide-react'
import { buildAddressExplorerUrl } from '@/onchain-facts'

const IDENTITY_REGISTRY = '0x8004A818BFB912233c491871b3d84c89A494BD9e' as const
const REPUTATION_REGISTRY = '0x8004B663056A597Dffe9eCcC1965A193B7388713' as const

const identityAbi = [
  {
    type: 'function',
    name: 'getAgentWallet',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const

const reputationAbi = [
  {
    type: 'function',
    name: 'getClients',
    stateMutability: 'view',
    inputs: [{ name: 'agentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    type: 'function',
    name: 'getSummary',
    stateMutability: 'view',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'clientAddresses', type: 'address[]' },
      { name: 'tag1', type: 'string' },
      { name: 'tag2', type: 'string' },
    ],
    outputs: [
      { name: 'count', type: 'uint64' },
      { name: 'summaryValue', type: 'int128' },
      { name: 'summaryValueDecimals', type: 'uint8' },
    ],
  },
] as const

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

interface Props {
  agentId: bigint
  agentName: string
  agentDescription: string
  x402Price: string
  txHash: string
  ownerAddress: string
}

export default function AgentCard({ agentId, agentName, agentDescription, x402Price, txHash: _txHash, ownerAddress }: Props) {
  const { data: agentWallet } = useReadContract({
    address: IDENTITY_REGISTRY,
    abi: identityAbi,
    functionName: 'getAgentWallet',
    args: [agentId],
    chainId: arcTestnet.id,
  })

  const { data: clients } = useReadContract({
    address: REPUTATION_REGISTRY,
    abi: reputationAbi,
    functionName: 'getClients',
    args: [agentId],
    chainId: arcTestnet.id,
  })

  const hasClients = clients && clients.length > 0

  const { data: summary } = useReadContract({
    address: REPUTATION_REGISTRY,
    abi: reputationAbi,
    functionName: 'getSummary',
    args: hasClients ? [agentId, clients, '', ''] : undefined,
    query: { enabled: hasClients },
    chainId: arcTestnet.id,
  })

  const reputationScore = summary && summary[0] > 0n
    ? Number(summary[1]) / Math.pow(10, summary[2])
    : null

  const explorerBase = 'https://explorer.testnet.arc.io'

  return (
    <div
      className="rounded-2xl overflow-hidden border"
      style={{ background: 'var(--surface-strong)', borderColor: 'var(--border)' }}
    >
      {/* Header strip */}
      <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #acc6e9 0%, #8dd89f 100%)' }} />

      <div className="p-6 flex flex-col gap-4">
        {/* Agent identity */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold display shrink-0"
              style={{ background: 'rgba(172,198,233,0.15)', color: 'var(--accent)' }}
            >
              {agentName ? agentName[0].toUpperCase() : 'A'}
            </div>
            <div>
              <h3 className="display font-semibold text-base leading-tight" style={{ color: 'var(--ink)' }}>
                {agentName || 'Unnamed Agent'}
              </h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>Agent ID #{agentId.toString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium shrink-0"
            style={{ background: 'rgba(141,216,159,0.12)', color: 'var(--success)' }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--success)' }} />
            Active
          </div>
        </div>

        {/* Description */}
        {agentDescription && (
          <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{agentDescription}</p>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="x402 Price" value={`$${x402Price}`} sub="per call" accent />
          <StatCard label="Reputation" value={reputationScore !== null ? reputationScore.toFixed(0) : '—'} sub={reputationScore !== null ? `${Number(clients?.length ?? 0)} client(s)` : 'no feedback yet'} />
          <StatCard label="Standard" value="ERC-8004" sub="Arc Testnet" />
        </div>

        {/* Registry info */}
        <div
          className="rounded-xl p-4 flex flex-col gap-2.5"
          style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
        >
          <Row label="Owner" value={truncate(ownerAddress)} href={`${explorerBase}/address/${ownerAddress}`} mono />
          {agentWallet && agentWallet !== '0x0000000000000000000000000000000000000000' ? (
            <Row label="Agent wallet" value={truncate(agentWallet)} href={buildAddressExplorerUrl(arcTestnet.id, agentWallet)} mono />
          ) : (
            <Row label="Agent wallet" value="owner (not set)" />
          )}
          <Row label="Identity registry" value={truncate(IDENTITY_REGISTRY)} href={`${explorerBase}/address/${IDENTITY_REGISTRY}`} mono />
        </div>

        {/* x402 badge */}
        <div
          className="rounded-xl p-4 flex items-start gap-3"
          style={{ background: 'rgba(172,198,233,0.08)', border: '1px solid rgba(172,198,233,0.2)' }}
        >
          <ShieldCheck size={18} className="shrink-0 mt-0.5" style={{ color: 'var(--accent)' }} />
          <div>
            <p className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>x402 Nanopayments enabled</p>
            <p className="text-xs mt-1" style={{ color: 'var(--subtle)' }}>
              Clients pay ${x402Price} USDC per call via Circle Gateway. The server validates payment before returning a response.
            </p>
          </div>
        </div>

        {reputationScore !== null && (
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
            <Star size={15} className="shrink-0" style={{ color: '#f6c90e' }} />
            <span className="font-medium" style={{ color: 'var(--ink)' }}>{reputationScore.toFixed(1)}</span>
            reputation score from {Number(clients?.length ?? 0)} client(s)
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className="rounded-xl p-3 flex flex-col gap-1" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
      <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--subtle)' }}>{label}</span>
      <span className={`text-base font-bold tabular-nums ${accent ? 'display' : ''}`}
        style={{ color: accent ? 'var(--accent)' : 'var(--ink)' }}>
        {value}
      </span>
      <span className="text-xs" style={{ color: 'var(--subtle)' }}>{sub}</span>
    </div>
  )
}

function Row({ label, value, href, mono }: { label: string; value: string; href?: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs" style={{ color: 'var(--subtle)' }}>{label}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-1 text-xs hover:underline ${mono ? 'mono' : ''}`}
          style={{ color: 'var(--accent)' }}
        >
          {value}
          <ExternalLink size={10} />
        </a>
      ) : (
        <span className={`text-xs ${mono ? 'mono' : ''}`} style={{ color: 'var(--ink-2)' }}>{value}</span>
      )}
    </div>
  )
}
