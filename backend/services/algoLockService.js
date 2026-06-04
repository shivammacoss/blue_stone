// Shared helpers for Algo account capital locking.
//
// An Algo account locks its deposited principal for `algoLockDays` from the
// moment it is opened. While locked:
//   - manual trading is fully blocked, and
//   - only profit (balance − principal) may be withdrawn; the principal itself
//     becomes withdrawable once the lock period completes.
// After the lock expires there are no Algo-specific restrictions.

const MS_PER_DAY = 24 * 60 * 60 * 1000

// True while the account's lock period is still active.
export function isAlgoLocked(account) {
  return !!(
    account &&
    account.isAlgo &&
    account.algoLockUntil &&
    new Date(account.algoLockUntil) > new Date()
  )
}

// Whole days remaining until the lock expires (0 once it has passed).
export function algoDaysRemaining(account) {
  if (!account || !account.algoLockUntil) return 0
  const ms = new Date(account.algoLockUntil) - Date.now()
  return ms <= 0 ? 0 : Math.ceil(ms / MS_PER_DAY)
}

// Maximum amount withdrawable right now considering the Algo lock only
// (profit while locked, unlimited otherwise). Other limits such as free margin
// are enforced separately by the caller.
export function maxAlgoWithdrawable(account) {
  if (!isAlgoLocked(account)) return Infinity
  const principal = account.algoPrincipal || 0
  return Math.max(0, (account.balance || 0) - principal)
}

// Validate a withdrawal/transfer-out against the Algo lock. Returns an error
// payload (ready to send as a 403 body) when blocked, or null when allowed.
export function checkAlgoWithdrawal(account, amount) {
  if (!isAlgoLocked(account)) return null
  const withdrawable = maxAlgoWithdrawable(account)
  if (amount > withdrawable) {
    const days = algoDaysRemaining(account)
    return {
      code: 'ALGO_LOCKED',
      message: `This Algo account's principal is locked. Only profit can be withdrawn ($${withdrawable.toFixed(2)} available) until it unlocks in ${days} day${days === 1 ? '' : 's'}.`,
      daysRemaining: days,
      withdrawable: Math.round(withdrawable * 100) / 100,
      algoLockUntil: account.algoLockUntil
    }
  }
  return null
}

// Record a deposit into the account as locked principal (no-op for non-algo
// accounts). Caller is responsible for saving the account.
export function recordAlgoDeposit(account, amount) {
  if (account && account.isAlgo && amount > 0) {
    account.algoPrincipal = (account.algoPrincipal || 0) + amount
  }
}
