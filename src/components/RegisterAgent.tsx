import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { parseEventLogs } from 'viem'
import { arcTestnet } from 'viem/chains'
import { ConnectKitButton } from 'connectkit'
import { Bot, ExternalLink, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { buildTxExplorerUrl } from '@/onchain-facts'

const IDENTITY_REGISTRY = '0x8004A818BFB912233c491871b3d84c89A494BD9e' as const

const identityAbi = [
  {
    type: 'function',
    name: 'register',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'agentURI', type: 'string' }],
    outputs: [{ name: 'agentId', type: 'uint256' }],
  },
  {
    type: 'event',
    name: 'Registered',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'agentURI', type: 'string', indexed: false },
      { name: 'owner', type: 'address', indexed: true },
    ],
  },
] as const

interface Props {
  onRegistered: (agentId: bigint, txHash: string) => void
}

export default function RegisterAgent({ onRegistered }: Props) {
  const { chainId, isConnected } = useAccount()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const { writeContract, data: txHash, isPending, error: writeError, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({ hash: txHash })

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [endpoint, setEndpoint] = useState('')
  const [price, setPrice] = useState('0.01')
  const [registered, setRegistered] = useState(false)

  const isWrongChain = isConnected && chainId !== arcTestnet.id
  const isLoading = isPending || isConfirming

  // When tx confirms, parse the Registered event to extract agentId
  if (isSuccess && receipt && txHash && !registered) {
    try {
      const [ev] = parseEventLogs({ abi: identityAbi, eventName: 'Registered', logs: receipt.logs })
      if (ev) {
        setRegistered(true)
        onRegistered(ev.args.agentId, txHash)
      }
    } catch {
      // event not found yet
    }
  }

  function buildRegistrationJson() {
    const agentCard = {
      type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
      name: name || 'My Arc Agent',
      description: description || 'An onchain agent payable via x402',
      services: endpoint
        ? [{ name: 'A2A', endpoint, version: '0.3.0' }]
        : [],
      x402Support: true,
      active: true,
      x402Price: `$${price}/call`,
      registrations: [],
      supportedTrust: ['reputation'],
    }
    return `data:application/json,${encodeURIComponent(JSON.stringify(agentCard))}`
  }

  function handleRegister() {
    if (isWrongChain) {
      switchChain({ chainId: arcTestnet.id })
      return
    }
    const uri = buildRegistrationJson()
    writeContract({
      address: IDENTITY_REGISTRY,
      abi: identityAbi,
      functionName: 'register',
      args: [uri],
      chainId: arcTestnet.id,
    })
  }

  const errorMsg = writeError
    ? writeError.message.includes('user rejected')
      ? null
      : writeError.message.includes('insufficient')
        ? 'Insufficient USDC balance. Gas is USDC on Arc — grab test USDC from the sidebar.'
        : 'Transaction failed. Check your wallet is on Arc Testnet.'
    : null

  return (
    <div className="rounded-2xl p-6 border" style={{ background: 'var(--surface-strong)', borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(172,198,233,0.15)' }}>
          <Bot size={20} style={{ color: 'var(--accent)' }} />
        </div>
        <div>
          <h2 className="display text-base font-semibold" style={{ color: 'var(--ink)' }}>
            Register Agent Identity
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>ERC-8004 on Arc Testnet</p>
        </div>
      </div>

      {!isConnected ? (
        <div className="flex flex-col items-center gap-3 py-4">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Connect your wallet to register an agent.</p>
          <ConnectKitButton />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium tracking-wide uppercase" style={{ color: 'var(--subtle)' }}>
              Agent Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Research Agent"
              disabled={isLoading || registered}
              className="rounded-xl px-4 py-3 text-sm outline-none transition-all"
              style={{
                background: 'var(--surface-muted)',
                border: '1px solid var(--border)',
                color: 'var(--ink)',
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium tracking-wide uppercase" style={{ color: 'var(--subtle)' }}>
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Summarizes onchain data for a fee"
              disabled={isLoading || registered}
              className="rounded-xl px-4 py-3 text-sm outline-none"
              style={{
                background: 'var(--surface-muted)',
                border: '1px solid var(--border)',
                color: 'var(--ink)',
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium tracking-wide uppercase" style={{ color: 'var(--subtle)' }}>
              Service Endpoint (optional)
            </label>
            <input
              type="url"
              value={endpoint}
              onChange={e => setEndpoint(e.target.value)}
              placeholder="https://your-agent.example.com/a2a"
              disabled={isLoading || registered}
              className="rounded-xl px-4 py-3 text-sm outline-none"
              style={{
                background: 'var(--surface-muted)',
                border: '1px solid var(--border)',
                color: 'var(--ink)',
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium tracking-wide uppercase" style={{ color: 'var(--subtle)' }}>
              x402 Price per call (USDC)
            </label>
            <div className="flex items-center gap-2 rounded-xl px-4 py-3"
              style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
              <span className="text-sm font-medium" style={{ color: 'var(--subtle)' }}>$</span>
              <input
                type="number"
                min="0.001"
                step="0.001"
                value={price}
                onChange={e => setPrice(e.target.value)}
                disabled={isLoading || registered}
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: 'var(--ink)' }}
              />
              <span className="text-xs" style={{ color: 'var(--subtle)' }}>USDC</span>
            </div>
          </div>

          {isWrongChain && (
            <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(232,109,122,0.1)', color: 'var(--danger)' }}>
              Wrong network. Click below to switch to Arc Testnet.
            </div>
          )}

          {errorMsg && (
            <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm"
              style={{ background: 'rgba(232,109,122,0.1)', color: 'var(--danger)' }}>
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {registered ? (
            <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium"
              style={{ background: 'rgba(141,216,159,0.12)', color: 'var(--success)' }}>
              <CheckCircle size={16} />
              Agent registered successfully!
              {txHash && (
                <a
                  href={buildTxExplorerUrl(arcTestnet.id, txHash)}
                  target="_blank" rel="noopener noreferrer"
                  className="ml-auto flex items-center gap-1 text-xs"
                  style={{ color: 'var(--accent)' }}
                >
                  Tx <ExternalLink size={12} />
                </a>
              )}
            </div>
          ) : (
            <button
              onClick={handleRegister}
              disabled={isLoading || isSwitching}
              className="w-full rounded-xl py-3.5 text-sm font-semibold transition-all flex items-center justify-center gap-2"
              style={{
                background: isLoading || isSwitching ? 'var(--surface-muted)' : 'var(--accent)',
                color: isLoading || isSwitching ? 'var(--subtle)' : '#0d1b2f',
                cursor: isLoading || isSwitching ? 'not-allowed' : 'pointer',
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  {isPending ? 'Confirm in wallet...' : 'Confirming...'}
                </>
              ) : isSwitching ? (
                'Switching network...'
              ) : isWrongChain ? (
                'Switch to Arc Testnet'
              ) : (
                'Register on Arc'
              )}
            </button>
          )}

          <p className="text-xs text-center" style={{ color: 'var(--subtle)' }}>
            Costs ~0.006 USDC gas. Gas is USDC on Arc.
          </p>

          {/* reset after error */}
          {writeError && !registered && (
            <button onClick={reset} className="text-xs underline text-center" style={{ color: 'var(--subtle)' }}>
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  )
}
