/**
 * Check MT5 Positions via MetaAPI
 *
 * Read-only diagnostic. Connects to an MT5 account through MetaAPI, lists
 * open positions, and compares them against blue_stone's open A-Book trades
 * so you can confirm whether trades pushed to Corecen are actually landing
 * on the MT5 side.
 *
 * Run:
 *   METAAPI_TOKEN="eyJ..." METAAPI_ACCOUNT_ID="91213ce9-..."  node scripts/check-mt5-positions.js
 *
 * Or set them in .env:
 *   METAAPI_TOKEN=...
 *   METAAPI_ACCOUNT_ID=...
 *
 * Optional flags via env:
 *   ONLY_OPEN=true        (only compare OPEN A-Book trades; default true)
 *   MATCH_TOLERANCE=0.01  (volume tolerance for fuzzy match; default 0.01)
 */

import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { default as MetaApi } from 'metaapi.cloud-sdk/esm-node'
import Trade from '../models/Trade.js'
import BookAssignment from '../models/BookAssignment.js'
import User from '../models/User.js'

dotenv.config()

const TOKEN = process.env.METAAPI_TOKEN || process.argv[2]
const ACCOUNT_ID = process.env.METAAPI_ACCOUNT_ID || process.argv[3]
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/BlueStone'
const VOLUME_TOLERANCE = parseFloat(process.env.MATCH_TOLERANCE || '0.01')

if (!TOKEN || !ACCOUNT_ID) {
  console.error('Missing credentials. Set METAAPI_TOKEN and METAAPI_ACCOUNT_ID in .env')
  console.error('Or pass as args: node scripts/check-mt5-positions.js <TOKEN> <ACCOUNT_ID>')
  process.exit(1)
}

// JWT tokens start with "eyJ"; account IDs look like UUIDs. Auto-fix swapped args.
const isJWT = (s) => s && s.startsWith('eyJ')
const isUUID = (s) => s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)

let token = TOKEN
let accountId = ACCOUNT_ID
if (isUUID(TOKEN) && isJWT(ACCOUNT_ID)) {
  console.log('⚠️  Detected swapped credentials, fixing automatically...')
  token = ACCOUNT_ID
  accountId = TOKEN
}

// MT5 broker symbols (GOLD, EURUSD.raw, BTCUSD#) → BlueStone canonical form.
const SYMBOL_ALIASES = {
  GOLD: 'XAUUSD',
  SILVER: 'XAGUSD',
  BITCOIN: 'BTCUSD',
  ETHEREUM: 'ETHUSD'
}

function normalizeSymbol(s) {
  if (!s) return s
  const upper = s.toUpperCase()
  if (SYMBOL_ALIASES[upper]) return SYMBOL_ALIASES[upper]
  let cleaned = s.replace(/[+#!]$/g, '')
  cleaned = cleaned.replace(/\.(raw|ecn|pro|std|micro|mini|cent|i|m|z|b|c|f|x|stp)$/i, '')
  const baseMatch = cleaned.match(/^([A-Z]{6})[a-z]+$/i)
  if (baseMatch) cleaned = baseMatch[1].toUpperCase()
  return cleaned.toUpperCase()
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  MT5 Position Check (via MetaAPI)')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`MT5 Account: ${accountId}`)
  console.log(`Token:       ${token.substring(0, 20)}...`)
  console.log('')

  await mongoose.connect(MONGODB_URI)
  console.log('✓ Connected to MongoDB')

  // ─── 1. Connect to MT5 via MetaAPI ─────────────────────────────────────
  const api = new MetaApi(token, { application: 'bluestone-diagnostic' })
  const account = await api.metatraderAccountApi.getAccount(accountId)

  console.log(`✓ MetaAPI account loaded: ${account.name || '(no name)'} (${account.platform}, ${account.state})`)

  if (account.state !== 'DEPLOYED') {
    console.log(`  State is ${account.state}, deploying...`)
    await account.deploy()
  }
  await account.waitDeployed()

  const connection = account.getRPCConnection()
  await connection.connect()
  console.log('  Synchronizing terminal state (this can take 10-30 seconds)...')
  await connection.waitSynchronized()

  const info = await connection.getAccountInformation()
  console.log(`✓ Connected to MT5: login=${info.login}  broker=${info.broker}  server=${info.server}`)
  console.log(`  Balance: ${info.currency} ${info.balance.toFixed(2)}   Equity: ${info.currency} ${info.equity.toFixed(2)}`)
  console.log('')

  const positions = await connection.getPositions()
  console.log(`─── MT5 OPEN POSITIONS (${positions.length}) ───────────────────`)
  if (positions.length === 0) {
    console.log('  (none)')
  } else {
    for (const p of positions) {
      const sym = normalizeSymbol(p.symbol)
      const side = p.type === 'POSITION_TYPE_BUY' ? 'BUY' : 'SELL'
      console.log(`  • ${p.symbol.padEnd(12)} → ${sym.padEnd(8)}  ${side}  vol=${p.volume}  open=${p.openPrice}  pnl=${p.profit?.toFixed(2)}  id=${p.id}`)
    }
  }
  console.log('')

  // ─── 2. Pull blue_stone A-Book trades ──────────────────────────────────
  const aBookAssignments = await BookAssignment.find({ bookType: 'A_BOOK', isActive: true }).select('userId')
  const aBookUserIds = aBookAssignments.map(a => a.userId)

  const bsTrades = await Trade.find({
    userId: { $in: aBookUserIds },
    status: 'OPEN'
  }).populate('userId', 'email firstName')

  console.log(`─── BLUE_STONE OPEN A-BOOK TRADES (${bsTrades.length}) ─────────`)
  if (bsTrades.length === 0) {
    console.log('  (none)')
  } else {
    for (const t of bsTrades) {
      const syncBadge =
        t.lpSyncStatus === 'SYNCED' ? '✓ SYNCED' :
        t.lpSyncStatus === 'FAILED' ? '✗ FAILED' :
        t.lpSyncStatus === 'PENDING' ? '… PENDING' : '— ' + (t.lpSyncStatus || 'N/A')
      console.log(`  • ${t.symbol.padEnd(10)} ${t.side}  vol=${t.quantity}  open=${t.openPrice}  user=${t.userId?.email || t.userId}  [${syncBadge}]  tradeId=${t.tradeId}`)
    }
  }
  console.log('')

  // ─── 3. Reconcile (match by symbol + side + volume) ────────────────────
  const mt5Norm = positions.map(p => ({
    raw: p,
    symbol: normalizeSymbol(p.symbol),
    side: p.type === 'POSITION_TYPE_BUY' ? 'BUY' : 'SELL',
    volume: p.volume,
    matched: false
  }))

  let matched = 0
  let missingOnMT5 = []
  let extraOnMT5 = []

  for (const t of bsTrades) {
    const candidate = mt5Norm.find(m =>
      !m.matched &&
      m.symbol === t.symbol.toUpperCase() &&
      m.side === t.side &&
      Math.abs(m.volume - t.quantity) <= VOLUME_TOLERANCE
    )
    if (candidate) {
      candidate.matched = true
      matched++
    } else {
      missingOnMT5.push(t)
    }
  }
  extraOnMT5 = mt5Norm.filter(m => !m.matched)

  console.log('─── RECONCILIATION ───────────────────────────────────────')
  console.log(`  ✓ Matched (in both):           ${matched}`)
  console.log(`  ✗ In BlueStone, NOT in MT5:    ${missingOnMT5.length}`)
  console.log(`  ⓘ In MT5, NOT in BlueStone:    ${extraOnMT5.length}`)
  console.log('')

  if (missingOnMT5.length > 0) {
    console.log('  MISSING ON MT5 (trades pushed to Corecen but not landing):')
    for (const t of missingOnMT5) {
      console.log(`    • ${t.symbol} ${t.side} vol=${t.quantity}  lpSync=${t.lpSyncStatus}  tradeId=${t.tradeId}`)
    }
    console.log('')
    console.log('  → If lpSyncStatus=SYNCED but not in MT5, check Corecen routing.')
    console.log('  → If lpSyncStatus=FAILED, run: node scripts/resync-abook-trades.js')
    console.log('')
  }

  if (extraOnMT5.length > 0) {
    console.log('  EXTRA ON MT5 (positions opened outside BlueStone):')
    for (const m of extraOnMT5) {
      console.log(`    • ${m.raw.symbol} → ${m.symbol}  ${m.side}  vol=${m.volume}  id=${m.raw.id}`)
    }
    console.log('  → These are likely positions opened directly on MT5 or by another broker.')
    console.log('')
  }

  console.log('═══════════════════════════════════════════════════════════')

  await mongoose.disconnect()
  process.exit(0)
}

main().catch(err => {
  console.error('Error:', err.message)
  console.error(err.stack)
  process.exit(1)
})
