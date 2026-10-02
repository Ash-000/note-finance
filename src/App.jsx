import { useEffect, useMemo, useState } from 'react'
import {
  ArrowClockwise, ArrowDown, ArrowRight, ArrowUp, Bank, BookOpen, Briefcase, Camera,
  CaretDown, CaretLeft, CaretRight, Check, Coffee, Gear, Gift, Heart,
  House, MagnifyingGlass, Minus, Moon, PencilSimple, Plus, Receipt, ShoppingCart,
  SignOut, SlidersHorizontal, Sun, Trash, UserCircle, Vault, Wallet, Warning, X,
} from '@phosphor-icons/react'
import {
  amountSizeClass, buildDonutStops, calculateBudgetStatus, evaluateKeypadExpression,
  formatAmountInput, isDateInPeriod, isOperator, isValidEmail, isValidPassword, normalizeAmount
} from './validation'

const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
const dateLabel = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
const monthLabel = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' })
const today = new Date().toISOString().slice(0, 10)

const iconFor = (category, size = 18) => {
  const props = { size, weight: 'regular' }
  if (category === 'Gaji' || category === 'Freelance') return <Briefcase {...props} />
  if (category === 'Belanja') return <ShoppingCart {...props} />
  if (category === 'Makan & Minum') return <Coffee {...props} />
  if (category === 'Transportasi') return <Receipt {...props} />
  if (category === 'Tagihan') return <Wallet {...props} />
  return <Bank {...props} />
}

function useStoredState(key, fallback) {
  const [state, setState] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
  })
  useEffect(() => { localStorage.setItem(key, JSON.stringify(state)) }, [key, state])
  return [state, setState]
}

const nav = [
  { id: 'summary', label: 'Ringkasan', icon: House },
  { id: 'transactions', label: 'Transaksi', icon: Receipt },
  { id: 'wishlist', label: 'Wishlist', icon: Heart },
  { id: 'settings', label: 'Pengaturan', icon: Gear },
]

const periodOptions = [
  { value: 'day', label: 'Hari ini' },
  { value: 'week', label: 'Minggu ini' },
  { value: 'month', label: 'Bulan ini' },
  { value: 'year', label: 'Tahun ini' },
  { value: 'all', label: 'Semua waktu' },
]

function BrandMark() {
  return <span className="brand-mark"><img className="brand-logo" src="/finnote-logo.png" width="768" height="768" alt="" aria-hidden="true" /></span>
}

function DoodleSquiggle({ className = '' }) {
  return (
    <svg className={`doodle-squiggle ${className}`} viewBox="0 0 120 10" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M2 6C18 2 34 8 50 5C66 2 82 8 98 4C106 2.5 114 6 118 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function DoodleSparkle({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={`doodle-sparkle ${className}`} aria-hidden="true">
      <path d="M12 2C12.5 7 17 11.5 22 12C17 12.5 12.5 17 12 22C11.5 17 7 12.5 2 12C7 11.5 11.5 7 12 2Z"/>
    </svg>
  )
}

function DoodleReceiptEmpty() {
  return (
    <svg width="44" height="44" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="doodle-empty-art" aria-hidden="true">
      <path d="M10 8C10 6.9 10.9 6 12 6H36C37.1 6 38 6.9 38 8V42L33 39L28 42L24 39L20 42L15 39L10 42V8Z"/>
      <path d="M18 16H30"/>
      <path d="M18 22H30"/>
      <path d="M18 28H24"/>
      <circle cx="32" cy="28" r="1.5" fill="currentColor"/>
    </svg>
  )
}

function DoodleHeartEmpty() {
  return (
    <svg width="44" height="44" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="doodle-empty-art" aria-hidden="true">
      <path d="M24 38S10 28 10 18A8 8 0 0 1 24 13A8 8 0 0 1 38 18C38 28 24 38 24 38Z"/>
      <path d="M24 16V22"/>
      <path d="M21 19H27"/>
    </svg>
  )
}

export default function App() {
  const [transactions, setTransactions] = useStoredState('arta-transactions-v2', [])
  const [lastReset, setLastReset] = useStoredState('arta-last-reset', null)
  const [goals, setGoals] = useStoredState('arta-goals-v2', [])
  const [monthlyBudget, setMonthlyBudget] = useStoredState('note-monthly-budget-v1', { limit: 0, active: false, extraFromSavings: 0, month: today.slice(0, 7) })
  const [savingsReserve, setSavingsReserve] = useStoredState('note-savings-reserve-v1', 0)
  const [session, setSession] = useStoredState('arta-session-v3', null)
  const [view, setView] = useState('summary')
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState('')
  const [theme, setTheme] = useStoredState('note-theme', () => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  const [botStatus, setBotStatus] = useState({ connected: false, botActive: false, botUsername: null, hasToken: false })
  const [isSyncing, setIsSyncing] = useState(false)
  const isTelegramMiniApp = typeof window !== 'undefined' && Boolean(window.Telegram?.WebApp?.initData)

  // Initialize Telegram WebApp jika dibuka di dalam Telegram
  useEffect(() => {
    if (window.Telegram?.WebApp) {
      try {
        window.Telegram.WebApp.ready()
        window.Telegram.WebApp.expand()
      } catch {}
    }
  }, [])

  // Sinkronisasi data dengan server backend PostgreSQL
  const syncWithServer = async (silent = true) => {
    try {
      if (!silent) setIsSyncing(true)
      const statusRes = await fetch('/api/status').catch(() => null)
      if (!statusRes || !statusRes.ok) {
        setBotStatus(prev => ({ ...prev, connected: false }))
        if (!silent) setToast('Server API offline (jalankan "npm run bot")')
        return
      }
      const statusData = await statusRes.json()
      setBotStatus({
        connected: true,
        botActive: statusData.botActive,
        botUsername: statusData.botUsername,
        hasToken: statusData.hasToken
      })

      // Jika user terautentikasi, ambil data transaksi miliknya dari PostgreSQL
      if (session?.token) {
        const txRes = await fetch('/api/transactions', {
          headers: { 'Authorization': `Bearer ${session.token}` }
        }).catch(() => null)

        if (txRes && txRes.ok) {
          const userTxs = await txRes.json()
          if (Array.isArray(userTxs)) {
            setTransactions(userTxs)
          }
        }
      }

      if (!silent) setToast('Data berhasil disinkronkan!')
    } catch {
      if (!silent) setToast('Gagal menyinkronkan data')
    } finally {
      if (!silent) setIsSyncing(false)
    }
  }

  // Polling sync otomatis
  useEffect(() => {
    syncWithServer(true)
    const onFocus = () => syncWithServer(true)
    window.addEventListener('focus', onFocus)
    const interval = setInterval(() => syncWithServer(true), 15000)
    return () => {
      window.removeEventListener('focus', onFocus)
      clearInterval(interval)
    }
  }, [session?.token])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#111219' : '#A576DE')
  }, [theme])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 2800)
    return () => clearTimeout(timer)
  }, [toast])

  // Reset extraFromSavings on month rollover
  useEffect(() => {
    const currentMonth = today.slice(0, 7)
    if (monthlyBudget.month !== currentMonth) {
      setMonthlyBudget(prev => ({ ...prev, month: currentMonth, extraFromSavings: 0 }))
    }
  }, [monthlyBudget.month])

  const totals = useMemo(() => {
    const res = transactions.reduce((acc, t) => { acc[t.type] += t.amount; return acc }, { income: 0, expense: 0 })
    return { ...res, balance: res.income - res.expense }
  }, [transactions])

  const currentMonthTransactions = useMemo(() => {
    return transactions.filter(item => isDateInPeriod(item.date, 'month'))
  }, [transactions])

  const monthlyExpense = useMemo(() => {
    return currentMonthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
  }, [currentMonthTransactions])

  const effectiveLimit = monthlyBudget.active ? (monthlyBudget.limit + (monthlyBudget.extraFromSavings || 0)) : 0
  const budgetStatus = useMemo(() => {
    return calculateBudgetStatus(monthlyExpense, effectiveLimit)
  }, [monthlyExpense, effectiveLimit])

  const saveTransaction = data => {
    const isEdit = Boolean(data.id)
    const tx = isEdit ? data : { ...data, id: crypto.randomUUID() }
    if (isEdit) setTransactions(items => items.map(item => item.id === tx.id ? tx : item))
    else setTransactions(items => [tx, ...items])
    setToast(isEdit ? 'Transaksi diperbarui' : 'Transaksi dicatat')
    setModal(null)

    // Save to server (PostgreSQL via user session)
    fetch('/api/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.token ? { 'Authorization': `Bearer ${session.token}` } : {})
      },
      body: JSON.stringify(tx)
    }).catch(() => {})
  }

  const deleteTransaction = id => {
    if (window.confirm('Hapus transaksi ini? Tindakan ini tidak dapat dibatalkan.')) {
      setTransactions(items => items.filter(item => item.id !== id))
      setToast('Transaksi dihapus')
      fetch(`/api/transactions/${id}`, {
        method: 'DELETE',
        headers: {
          ...(session?.token ? { 'Authorization': `Bearer ${session.token}` } : {})
        }
      }).catch(() => {})
    }
  }

  const saveGoal = data => {
    if (data.id) setGoals(items => items.map(item => item.id === data.id ? data : item))
    else setGoals(items => [{ ...data, id: crypto.randomUUID() }, ...items])
    setToast(data.id ? 'Wishlist diperbarui' : 'Target ditambahkan')
    setModal(null)
  }

  const deleteGoal = id => {
    if (window.confirm('Hapus target ini?')) {
      setGoals(items => items.filter(item => item.id !== id))
      setToast('Target dihapus')
    }
  }

  const addSaving = (id, amount) => {
    setGoals(items => items.map(goal => goal.id === id ? { ...goal, saved: Math.min(goal.saved + amount, goal.target) } : goal))
    setToast('Tabungan ditambahkan')
    setModal(null)
  }

  const saveMonthlyBudget = ({ limit, active }) => {
    setMonthlyBudget(prev => ({ ...prev, limit: Number(limit) || 0, active, month: today.slice(0, 7) }))
    setToast(active ? `Limit diatur: ${rupiah.format(limit)}` : 'Limit dinonaktifkan')
    setModal(null)
  }

  const depositSavings = amount => {
    const safeAmount = Number(amount) || 0
    if (safeAmount <= 0) return
    setSavingsReserve(prev => prev + safeAmount)
    setToast(`Disisihkan: ${rupiah.format(safeAmount)}`)
    setModal(null)
  }

  const useSavingsForBudget = amount => {
    const safeAmount = Number(amount) || 0
    if (safeAmount <= 0) return
    if (safeAmount > savingsReserve) {
      setToast('Saldo simpanan tidak mencukupi')
      return
    }
    setSavingsReserve(prev => prev - safeAmount)
    if (monthlyBudget.active) {
      setMonthlyBudget(prev => ({ ...prev, extraFromSavings: (prev.extraFromSavings || 0) + safeAmount }))
    }
    setToast(`Dana simpanan digunakan: ${rupiah.format(safeAmount)}`)
    setModal(null)
  }

  const title = nav.find(item => item.id === view)?.label
  if (!session) return <LoginScreen onLogin={setSession} />

  const firstName = (session.name || session.user?.name || 'Teman').trim().split(/\s+/)[0]
  const availableBalance = totals.balance - (savingsReserve || 0)

  const page = view === 'summary'
    ? <Summary
        transactions={transactions}
        goals={goals}
        totals={totals}
        availableBalance={availableBalance}
        setView={setView}
        openModal={setModal}
        monthlyBudget={monthlyBudget}
        savingsReserve={savingsReserve}
        monthlyExpense={monthlyExpense}
        effectiveLimit={effectiveLimit}
        budgetStatus={budgetStatus}
      />
    : view === 'transactions'
      ? <TransactionsPage transactions={transactions} openModal={setModal} onDelete={deleteTransaction} />
      : view === 'wishlist'
        ? <WishlistPage goals={goals} openModal={setModal} onDelete={deleteGoal} />
        : <SettingsPage
            session={session}
            onLogout={() => {
              setSession(null)
              setTransactions([])
            }}
            onClear={() => {
              if (window.confirm('Hapus seluruh data keuangan lokal pada browser ini?')) {
                setLastReset(new Date().toISOString())
                setTransactions([])
                setGoals([])
                setMonthlyBudget({ limit: 0, active: false, extraFromSavings: 0, month: today.slice(0, 7) })
                setSavingsReserve(0)
                setToast('Semua data keuangan lokal dihapus')
              }
            }}
            monthlyBudget={monthlyBudget}
            savingsReserve={savingsReserve}
            openModal={setModal}
            botStatus={botStatus}
            onSync={() => syncWithServer(false)}
            isSyncing={isSyncing}
          />

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setView('summary')} aria-label="FinNote, ke ringkasan">
          <BrandMark /><span>FinNote</span>
        </button>
        <nav aria-label="Navigasi utama">
          {nav.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${view === id ? 'active' : ''}`} onClick={() => setView(id)}>
              <Icon size={19} weight="regular" /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="account-card">
            <UserCircle size={36} weight="regular" />
            <div>
              <strong>{session.name || session.user?.name}</strong>
              <span>{session.email || session.user?.email || 'Akun Aktif'}</span>
            </div>
          </div>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <button className="mobile-brand" onClick={() => setView('summary')} aria-label="FinNote, ke ringkasan">
            <BrandMark /><span><strong>FinNote</strong><small>Catatan keuangan</small></span>
          </button>
          <div className="topbar-copy">
            <p className="eyebrow">
              {monthLabel.format(new Date())}
              {isTelegramMiniApp && <span className="tma-badge">📱 Telegram</span>}
            </p>
            <h1>{view === 'summary' ? <>Selamat datang, {firstName} <DoodleSparkle size={15} /></> : title}</h1>
          </div>
          <div className="header-actions">
            <button className="icon-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}>
              {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <button className="primary header-cta" onClick={() => setModal({ kind: 'transaction', type: 'expense' })}>
              Catat transaksi<span className="button-orb"><Plus size={16} weight="bold" /></span>
            </button>
          </div>
        </header>

        <div key={view} className="t-panel-slide view-transition">{page}</div>
      </main>

      <nav className="mobile-nav" aria-label="Navigasi mobile">
        {nav.map(({ id, label, icon: Icon }) => (
          <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}>
            <Icon size={20} weight="regular" /><span>{label}</span>
          </button>
        ))}
      </nav>

      {modal?.kind === 'transaction' && (
        <TransactionModal
          initial={modal.item}
          defaultType={modal.type}
          onClose={() => setModal(null)}
          onSave={saveTransaction}
        />
      )}
      {modal?.kind === 'goal' && <GoalModal initial={modal.item} onClose={() => setModal(null)} onSave={saveGoal} />}
      {modal?.kind === 'saving' && <SavingModal goal={modal.item} onClose={() => setModal(null)} onSave={addSaving} />}
      {modal?.kind === 'budget' && <BudgetModal currentLimit={monthlyBudget.limit} isActive={monthlyBudget.active} onClose={() => setModal(null)} onSave={saveMonthlyBudget} />}
      {modal?.kind === 'deposit-savings' && <DepositSavingsModal availableBalance={availableBalance} onClose={() => setModal(null)} onSave={depositSavings} />}
      {modal?.kind === 'use-savings' && <UseSavingsModal savingsReserve={savingsReserve} deficit={budgetStatus.isExceeded ? Math.abs(budgetStatus.remaining) : 0} onClose={() => setModal(null)} onSave={useSavingsForBudget} />}
      {toast && <div className="toast" role="status"><Check size={16} weight="bold" />{toast}</div>}
    </div>
  )
}

function Summary({
  transactions,
  goals,
  totals,
  availableBalance,
  setView,
  openModal,
  monthlyBudget,
  savingsReserve,
  monthlyExpense,
  effectiveLimit,
  budgetStatus,
}) {
  const spentPercent = totals.income ? Math.min(Math.round((totals.expense / totals.income) * 100), 100) : 0
  const categories = useMemo(() => {
    const sums = transactions.filter(t => t.type === 'expense').reduce((acc, item) => ({ ...acc, [item.category]: (acc[item.category] || 0) + item.amount }), {})
    const sorted = Object.entries(sums).sort((a, b) => b[1] - a[1])
    return sorted.length > 4
      ? [...sorted.slice(0, 3), ['Lainnya', sorted.slice(3).reduce((total, [, value]) => total + value, 0)]]
      : sorted
  }, [transactions])
  const donutStops = buildDonutStops(categories.map(([, value]) => value), totals.expense)

  return (
    <div className="dashboard-grid">
      {monthlyBudget?.active && budgetStatus?.isExceeded && (
        <aside className="overbudget-alert" role="alert" aria-live="polite">
          <div className="overbudget-icon"><Warning size={22} weight="fill" /></div>
          <div className="overbudget-content">
            <div className="overbudget-header">
              <strong>Limit Pengeluaran Bulanan Terlampaui</strong>
              <span className="overbudget-chip">Defisit {rupiah.format(Math.abs(budgetStatus.remaining))}</span>
            </div>
            <p>
              Pengeluaran mencapai <strong>{rupiah.format(monthlyExpense)}</strong>, melebihi limit {rupiah.format(effectiveLimit)}.
            </p>
          </div>
          <div className="overbudget-actions">
            {savingsReserve > 0 ? (
              <button type="button" className="overbudget-btn primary" onClick={() => openModal({ kind: 'use-savings' })}>
                Gunakan Simpanan
              </button>
            ) : (
              <button type="button" className="overbudget-btn secondary" onClick={() => openModal({ kind: 'deposit-savings' })}>
                Isi Simpanan
              </button>
            )}
          </div>
        </aside>
      )}

      {/* Balance Card (Minimal Doodles) */}
      <section className="balance-card">
        <div className="balance-main">
          <div className="balance-heading">
            <p>Total akumulasi uang <DoodleSparkle size={12} /></p>
            <span className="month-chip">{monthLabel.format(new Date())}</span>
          </div>
          <strong className={`balance-value ${amountSizeClass(totals.balance)}`}>{rupiah.format(totals.balance)}</strong>
          <DoodleSquiggle />

          <div className="balance-split-row">
            <div className="split-item ready">
              <div>
                <span className="split-label">Siap pakai</span>
                <strong className="split-value">{rupiah.format(availableBalance)}</strong>
              </div>
            </div>
            <div className="split-divider" aria-hidden="true" />
            <div className="split-item savings">
              <div>
                <span className="split-label">Simpanan</span>
                <strong className="split-value">{rupiah.format(savingsReserve || 0)}</strong>
              </div>
            </div>
          </div>

          <div className="hero-totals">
            <div>
              <p>↑ Pemasukan</p>
              <strong>{rupiah.format(totals.income)}</strong>
            </div>
            <div>
              <p>↓ Pengeluaran</p>
              <strong>{rupiah.format(totals.expense)}</strong>
            </div>
          </div>
          <div className="budget-line"><span style={{ width: `${spentPercent}%` }} /></div>
          <small>{spentPercent}% pemasukan sudah digunakan</small>
        </div>

        <div className="chart-column">
          <div className="chart-head"><span>Pengeluaran</span><button onClick={() => setView('transactions')}>Detail</button></div>
          <div className="donut" aria-hidden="true" style={donutStops ? { '--donut-fill': `conic-gradient(from -90deg, ${donutStops})` } : undefined} />
          <div className="legend">{categories.length ? categories.map(([name, value]) => <div key={name}><span>{name}</span><strong>{rupiah.format(value)}</strong></div>) : <p className="chart-empty">Belum ada pengeluaran</p>}</div>
        </div>
      </section>

      <div className="quick-actions">
        <button type="button" className="quick income" onClick={() => openModal({ kind: 'transaction', type: 'income' })}>
          <span className="quick-icon"><Plus size={16} weight="bold" /></span>
          <div className="quick-copy">
            <strong>Pemasukan</strong>
            <small>Tambah pemasukan</small>
          </div>
        </button>
        <button type="button" className="quick expense" onClick={() => openModal({ kind: 'transaction', type: 'expense' })}>
          <span className="quick-icon"><Minus size={16} weight="bold" /></span>
          <div className="quick-copy">
            <strong>Pengeluaran</strong>
            <small>Tambah pengeluaran</small>
          </div>
        </button>
      </div>

      <section className="budget-vault-grid" aria-label="Limit anggaran dan dana simpanan">
        <article className={`panel bv-card budget-card ${monthlyBudget?.active ? budgetStatus.status : 'inactive'}`}>
          <div className="bv-card-head">
            <div>
              <h3>Limit Bulanan</h3>
              <p>{monthlyBudget?.active ? 'Batas belanja bulan ini' : 'Batas belanja dinonaktifkan'}</p>
            </div>
            <button type="button" className="text-button bv-edit-btn" onClick={() => openModal({ kind: 'budget' })}>
              {monthlyBudget?.active ? 'Ubah limit' : 'Atur limit'}
            </button>
          </div>

          {monthlyBudget?.active ? (
            <div className="bv-card-body">
              <div className="bv-amount-row">
                <div>
                  <span className="bv-label">Terpakai bulan ini</span>
                  <strong className="bv-main-num">{rupiah.format(monthlyExpense)}</strong>
                </div>
                <div className="bv-limit-target">
                  <span className="bv-label">Batas limit</span>
                  <strong>{rupiah.format(effectiveLimit)}</strong>
                </div>
              </div>

              <div className="budget-bar-track">
                <div
                  className={`budget-bar-fill ${budgetStatus.status}`}
                  style={{ width: `${Math.min(budgetStatus.percent, 100)}%` }}
                />
              </div>

              <div className="bv-status-row">
                <span className={`budget-pill ${budgetStatus.status}`}>
                  {budgetStatus.isExceeded
                    ? `Melebihi limit ${rupiah.format(Math.abs(budgetStatus.remaining))}`
                    : budgetStatus.isWarning
                      ? `Sisa ${rupiah.format(budgetStatus.remaining)} (Hampir habis!)`
                      : `Sisa kuota: ${rupiah.format(budgetStatus.remaining)}`}
                </span>
                <span className="bv-percent">{budgetStatus.percent}%</span>
              </div>
            </div>
          ) : (
            <div className="bv-card-empty">
              <p>Belum ada batas belanja aktif. Pasang limit agar pengeluaran tetap terkontrol.</p>
              <button type="button" className="secondary" onClick={() => openModal({ kind: 'budget' })}>
                Pasang Limit
              </button>
            </div>
          )}
        </article>

        <article className="panel bv-card vault-card">
          <div className="bv-card-head">
            <div>
              <h3>Dana Simpanan</h3>
              <p>Pemisahan uang cadangan</p>
            </div>
            <button type="button" className="text-button bv-edit-btn" onClick={() => openModal({ kind: 'deposit-savings' })}>
              + Sisihkan
            </button>
          </div>

          <div className="bv-card-body">
            <div className="bv-amount-row">
              <div>
                <span className="bv-label">Saldo tersimpan</span>
                <strong className="bv-main-num vault-num">{rupiah.format(savingsReserve || 0)}</strong>
              </div>
            </div>

            <p className="bv-vault-desc">
              {savingsReserve > 0
                ? 'Dana cadangan terpisah yang siap digunakan jika pengeluaran melebihi limit.'
                : 'Belum ada saldo simpanan cadangan.'}
            </p>

            <div className="bv-vault-actions">
              <button type="button" className="primary bv-action-btn" onClick={() => openModal({ kind: 'deposit-savings' })}>
                Sisihkan Uang
              </button>
              <button
                type="button"
                className="secondary bv-action-btn"
                disabled={!savingsReserve || savingsReserve <= 0}
                onClick={() => openModal({ kind: 'use-savings' })}
              >
                Gunakan Simpanan
              </button>
            </div>
          </div>
        </article>
      </section>

      <section className="panel transactions-panel">
        <PanelHeader title="Transaksi terbaru" action="Lihat semua" onClick={() => setView('transactions')} />
        {transactions.length ? (
          <div className="transaction-list">{transactions.slice(0, 5).map(item => <TransactionRow key={item.id} item={item} />)}</div>
        ) : (
          <EmptyState doodle={<DoodleReceiptEmpty />} title="Catatanmu masih kosong" text="Catat transaksi pertama. Ringkasan bulan ini akan terisi otomatis." action="Mulai mencatat" onAction={() => openModal({ kind: 'transaction', type: 'expense' })} />
        )}
      </section>

      <section className="panel wishlist-panel">
        <PanelHeader title="Wishlist" action="Lihat semua" onClick={() => setView('wishlist')} />
        {goals.length ? (
          <div className="goal-list compact">{goals.slice(0, 2).map(goal => <GoalCard key={goal.id} goal={goal} compact onSaving={() => openModal({ kind: 'saving', item: goal })} />)}</div>
        ) : (
          <EmptyState doodle={<DoodleHeartEmpty />} title="Belum ada wishlist" text="Simpan target dan pantau dana yang sudah terkumpul." action="Buat wishlist" onAction={() => openModal({ kind: 'goal' })} />
        )}
      </section>
    </div>
  )
}

function TransactionsPage({ transactions, openModal, onDelete }) {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [category, setCategory] = useState('Semua kategori')
  const [period, setPeriod] = useState('month')

  const periodTransactions = useMemo(() => {
    return transactions.filter(item => isDateInPeriod(item.date, period))
  }, [transactions, period])

  const periodTotals = useMemo(() => {
    const income = periodTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
    const expense = periodTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
    return { income, expense, balance: income - expense }
  }, [periodTransactions])

  const typeTransactions = useMemo(() => {
    return periodTransactions.filter(item => typeFilter === 'all' ? true : item.type === typeFilter)
  }, [periodTransactions, typeFilter])

  const categories = useMemo(() => {
    const list = typeTransactions.map(item => item.category)
    return [...new Set(list)]
  }, [typeTransactions])

  const filtered = useMemo(() => {
    return typeTransactions.filter(item => {
      const matchCat = category === 'Semua kategori' || item.category === category
      const matchQuery = !query.trim() || `${item.title} ${item.category} ${item.note || ''}`.toLowerCase().includes(query.toLowerCase())
      return matchCat && matchQuery
    })
  }, [typeTransactions, category, query])

  const activePeriod = periodOptions.find(item => item.value === period)?.label.toLowerCase()
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 15

  useEffect(() => { setPage(1) }, [query, category, period, typeFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginated = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, safePage])

  const startIdx = filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0
  const endIdx = Math.min(safePage * PAGE_SIZE, filtered.length)

  return (
    <div className="page-stack">
      <div className="transaction-summary-grid">
        <div className="tx-summary-card total-balance">
          <div>
            <p>Arus kas bersih · {activePeriod}</p>
            <strong className={`${amountSizeClass(periodTotals.balance)} ${periodTotals.balance < 0 ? 'expense' : 'income'}`}>
              {rupiah.format(periodTotals.balance)}
            </strong>
            <small>{periodTransactions.length} transaksi</small>
          </div>
        </div>
        <div className="tx-summary-card income">
          <div>
            <p>Total pemasukan</p>
            <strong className={`income ${amountSizeClass(periodTotals.income)}`}>{rupiah.format(periodTotals.income)}</strong>
            <small>{periodTransactions.filter(t => t.type === 'income').length} transaksi</small>
          </div>
        </div>
        <div className="tx-summary-card expense">
          <div>
            <p>Total pengeluaran</p>
            <strong className={`expense ${amountSizeClass(periodTotals.expense)}`}>{rupiah.format(periodTotals.expense)}</strong>
            <small>{periodTransactions.filter(t => t.type === 'expense').length} transaksi</small>
          </div>
        </div>
      </div>

      <section className="panel table-panel">
        <div className="tx-header-bar">
          <div className="type-tabs" role="tablist" aria-label="Filter tipe transaksi">
            <button type="button" role="tab" aria-selected={typeFilter === 'all'} className={typeFilter === 'all' ? 'active' : ''} onClick={() => { setTypeFilter('all'); setCategory('Semua kategori') }}>Semua ({periodTransactions.length})</button>
            <button type="button" role="tab" aria-selected={typeFilter === 'income'} className={typeFilter === 'income' ? 'active' : ''} onClick={() => { setTypeFilter('income'); setCategory('Semua kategori') }}>Pemasukan</button>
            <button type="button" role="tab" aria-selected={typeFilter === 'expense'} className={typeFilter === 'expense' ? 'active' : ''} onClick={() => { setTypeFilter('expense'); setCategory('Semua kategori') }}>Pengeluaran</button>
          </div>
          <button className="primary tx-add-btn" onClick={() => openModal({ kind: 'transaction', type: typeFilter === 'income' ? 'income' : 'expense' })}>
            <Plus size={16} weight="bold" />Catat transaksi
          </button>
        </div>

        <div className="list-toolbar">
          <div className="search">
            <MagnifyingGlass size={18} />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari transaksi..." aria-label="Cari transaksi" />
          </div>
          <div className="select-wrap period-filter">
            <select value={period} onChange={event => setPeriod(event.target.value)} aria-label="Filter periode">
              {periodOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <CaretDown size={14} />
          </div>
          <div className="select-wrap category-filter">
            <select value={category} onChange={event => setCategory(event.target.value)} aria-label="Filter kategori">
              <option>Semua kategori</option>
              {categories.map(item => <option key={item}>{item}</option>)}
            </select>
            <CaretDown size={14} />
          </div>
        </div>

        {filtered.length ? (
          <>
            <div className="transaction-list detailed">
              {paginated.map(item => (
                <TransactionRow
                  key={item.id}
                  item={item}
                  actions
                  onEdit={() => openModal({ kind: 'transaction', item, type: item.type })}
                  onDelete={() => onDelete(item.id)}
                />
              ))}
            </div>
            <Pagination
              currentPage={safePage}
              totalPages={totalPages}
              onPageChange={setPage}
              startIdx={startIdx}
              endIdx={endIdx}
              totalCount={filtered.length}
            />
          </>
        ) : (
          <EmptyState
            icon={MagnifyingGlass}
            title="Tidak ada transaksi"
            text={query || category !== 'Semua kategori' || typeFilter !== 'all' ? 'Coba kata kunci atau filter lain.' : `Belum ada catatan transaksi untuk ${activePeriod}.`}
            action="Tambah transaksi baru"
            onAction={() => openModal({ kind: 'transaction', type: typeFilter === 'income' ? 'income' : 'expense' })}
          />
        )}
      </section>
    </div>
  )
}

function Pagination({ currentPage, totalPages, onPageChange, startIdx, endIdx, totalCount }) {
  if (totalCount === 0) return null

  const getPages = () => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1)
    if (currentPage <= 3) return [1, 2, 3, 4, '...', totalPages]
    if (currentPage >= totalPages - 2) return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages]
  }

  return (
    <div className="pagination">
      <span className="pagination-info">
        Menampilkan <strong>{startIdx}–{endIdx}</strong> dari <strong>{totalCount}</strong> transaksi
      </span>
      {totalPages > 1 && (
        <div className="pagination-controls" role="navigation" aria-label="Paginasi transaksi">
          <button
            type="button"
            className="pagination-btn"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            aria-label="Halaman sebelumnya"
          >
            <CaretLeft size={16} />
            <span>Sebelumnya</span>
          </button>
          <div className="pagination-pages">
            {getPages().map((num, i) =>
              num === '...' ? (
                <span key={`ellipsis-${i}`} className="pagination-ellipsis">…</span>
              ) : (
                <button
                  key={num}
                  type="button"
                  className={`pagination-page ${currentPage === num ? 'active' : ''}`}
                  onClick={() => onPageChange(num)}
                  aria-label={`Halaman ${num}`}
                  aria-current={currentPage === num ? 'page' : undefined}
                >
                  {num}
                </button>
              )
            )}
          </div>
          <button
            type="button"
            className="pagination-btn"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            aria-label="Halaman selanjutnya"
          >
            <span>Selanjutnya</span>
            <CaretRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

function WishlistPage({ goals, openModal, onDelete }) {
  const totalTarget = goals.reduce((sum, goal) => sum + goal.target, 0)
  const totalSaved = goals.reduce((sum, goal) => sum + goal.saved, 0)
  return (
    <div className="page-stack">
      <div className="wishlist-heading">
        <div>
          <p>Total tabungan wishlist</p>
          <strong className={amountSizeClass(totalSaved)}>{rupiah.format(totalSaved)}</strong>
          <span>dari target {rupiah.format(totalTarget)}</span>
        </div>
        <button className="primary" onClick={() => openModal({ kind: 'goal' })}>
          <Plus size={16} weight="bold" />Tambah wishlist
        </button>
      </div>
      {goals.length ? (
        <div className="goals-grid">
          {goals.map(goal => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onSaving={() => openModal({ kind: 'saving', item: goal })}
              onEdit={() => openModal({ kind: 'goal', item: goal })}
              onDelete={() => onDelete(goal.id)}
            />
          ))}
        </div>
      ) : (
        <section className="panel">
          <EmptyState icon={Heart} title="Wishlist masih kosong" text="Tambahkan barang atau target yang ingin diwujudkan." action="Buat wishlist" onAction={() => openModal({ kind: 'goal' })} />
        </section>
      )}
    </div>
  )
}

function SettingsPage({ session, onLogout, onClear, monthlyBudget, savingsReserve, openModal, botStatus, onSync, isSyncing }) {
  const [pairingCode, setPairingCode] = useState(null)
  const [pairingLoading, setPairingLoading] = useState(false)

  const generatePairCode = async () => {
    setPairingLoading(true)
    try {
      const res = await fetch('/api/telegram/pair-code', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.token}`
        }
      })
      const data = await res.json()
      if (res.ok && data.code) {
        setPairingCode(data.code)
      } else {
        alert(data.error || 'Gagal membuat kode pairing.')
      }
    } catch {
      alert('Tidak dapat menghubungi server bot.')
    } finally {
      setPairingLoading(false)
    }
  }

  return (
    <div className="settings-grid">
      <div className="settings-content">
        {/* Telegram Integration (Cleaned of slop icons) */}
        <section className="panel settings-section">
          <div>
            <h2>Integrasi Bot Telegram</h2>
            <p>Hubungkan akun Telegram agar transaksi chat otomatis masuk ke akun FinNote milikmu.</p>
          </div>

          <div className="setting-row">
            <div>
              <strong>Status Server & Bot</strong>
              <span>
                {botStatus?.connected && botStatus?.botActive
                  ? `🟢 Terhubung aktif sebagai @${botStatus.botUsername}`
                  : botStatus?.connected
                    ? '🟡 Server aktif • Token bot belum diisi di .env'
                    : '⚪ Server bot offline • Jalankan "npm run bot" untuk mengaktifkan'}
              </span>
            </div>
            <div className="setting-row-actions">
              <button
                className="secondary"
                type="button"
                onClick={onSync}
                disabled={isSyncing}
                title="Sinkronkan data transaksi"
              >
                <ArrowClockwise size={16} className={isSyncing ? 'spin' : ''} />
                <span>{isSyncing ? 'Sinkron...' : 'Sinkronkan'}</span>
              </button>
              {botStatus?.botUsername && (
                <a
                  href={`https://t.me/${botStatus.botUsername}`}
                  target="_blank"
                  rel="noreferrer"
                  className="primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', padding: '8px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: '600' }}
                >
                  Buka Bot
                </a>
              )}
            </div>
          </div>

          {/* Telegram Pairing Action */}
          <div className="setting-row" style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <div>
              <strong>Pairing Akun Telegram</strong>
              <span>Dapatkan kode 6 digit untuk menghubungkan akun chat dengan akun ini.</span>
              {pairingCode && (
                <div style={{ marginTop: '8px', padding: '8px 12px', background: 'var(--accent-2)', borderRadius: '8px', color: 'var(--accent-strong)', fontWeight: 'bold' }}>
                  Kirim ke bot: <code>/link {pairingCode}</code> (berlaku 15 menit)
                </div>
              )}
            </div>
            <button
              className="secondary"
              type="button"
              disabled={pairingLoading}
              onClick={generatePairCode}
            >
              {pairingLoading ? 'Membuat...' : pairingCode ? 'Kode Baru' : 'Buat Kode Pairing'}
            </button>
          </div>
        </section>

        {/* Budget & Vault */}
        <section className="panel settings-section">
          <div>
            <h2>Limit Anggaran & Simpanan</h2>
            <p>Atur batas belanja bulanan dan alokasi dana cadangan.</p>
          </div>
          <div className="setting-row">
            <div>
              <strong>Limit Pengeluaran Bulanan</strong>
              <span>
                {monthlyBudget?.active
                  ? `Aktif: ${rupiah.format(monthlyBudget.limit)} / bulan${monthlyBudget.extraFromSavings ? ` (+ ${rupiah.format(monthlyBudget.extraFromSavings)} dari simpanan)` : ''}`
                  : 'Saat ini dinonaktifkan'}
              </span>
            </div>
            <button className="secondary" onClick={() => openModal({ kind: 'budget' })}>
              <SlidersHorizontal size={16} />Atur limit
            </button>
          </div>
          <div className="setting-row">
            <div>
              <strong>Dana Simpanan Cadangan</strong>
              <span>Total tersimpan: {rupiah.format(savingsReserve || 0)}</span>
            </div>
            <div className="setting-row-actions">
              <button className="secondary" onClick={() => openModal({ kind: 'deposit-savings' })}>
                Sisihkan
              </button>
              {savingsReserve > 0 && (
                <button className="secondary" onClick={() => openModal({ kind: 'use-savings' })}>
                  Gunakan
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Session & Account */}
        <section className="panel settings-section">
          <div>
            <h2>Data dan Akun</h2>
            <p>Informasi akun aktif dan kontrol data lokal.</p>
          </div>
          <div className="setting-row">
            <div>
              <strong>Akun Pengguna</strong>
              <span>{session?.name || session?.user?.name} ({session?.email || session?.user?.email})</span>
            </div>
            <button className="secondary" onClick={onLogout}>
              <SignOut size={16} />Keluar
            </button>
          </div>
          <div className="setting-row">
            <div>
              <strong>Hapus data lokal</strong>
              <span>Menghapus cache transaksi dan limit pada browser ini.</span>
            </div>
            <button className="danger-button" onClick={onClear}>
              <Trash size={16} />Hapus data
            </button>
          </div>
        </section>
      </div>

      <aside className="settings-preview" aria-label="Preview tema">
        <div className="preview-brand"><BrandMark />FinNote</div>
        <div className="preview-copy">
          <span>SISTEM</span>
          <strong>Multi-User & PostgreSQL</strong>
          <p>Pencatatan keuangan dengan isolasi data akun, kalkulator input 4x4, dan integrasi bot Telegram.</p>
        </div>
      </aside>
    </div>
  )
}

function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async event => {
    event.preventDefault()
    setError('')
    if (!isValidEmail(email)) return setError('Format email tidak valid.')
    if (!isValidPassword(password)) return setError('Kata sandi minimal 6 karakter.')
    if (mode === 'register' && !name.trim()) return setError('Nama tidak boleh kosong.')

    setLoading(true)
    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login'
      const payload = mode === 'register' ? { email, password, name } : { email, password }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Terjadi kesalahan saat masuk.')
      }
      onLogin({
        token: data.token,
        user: data.user,
        name: data.user.name,
        email: data.user.email
      })
    } catch (err) {
      if (err.message.includes('fetch') || err.message.includes('Failed to fetch')) {
        // Fallback jika backend offline: izinkan masuk lokal dengan email
        onLogin({
          token: null,
          user: { name: name || email.split('@')[0], email },
          name: name || email.split('@')[0],
          email
        })
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-copy t-stagger is-shown">
        <button className="brand login-brand" type="button"><BrandMark /><span>FinNote</span></button>
        <div>
          <p className="login-kicker t-stagger-line t-stagger-line--1">Keuangan pribadi multi-user</p>
          <h1 className="t-stagger-line t-stagger-line--2">Uang lebih tertata.<br />Hidup lebih tenang.</h1>
          <p className="login-description t-stagger-line t-stagger-line--3">Catat pemasukan, pengeluaran, dan target dengan akun terisolasi yang aman.</p>
        </div>
      </section>

      <section className="login-form-wrap">
        <form className="login-card" onSubmit={submit}>
          <div className="type-switch" style={{ marginBottom: '16px' }}>
            <button
              type="button"
              className={mode === 'login' ? 'active' : ''}
              onClick={() => { setMode('login'); setError('') }}
            >
              Masuk
            </button>
            <button
              type="button"
              className={mode === 'register' ? 'active' : ''}
              onClick={() => { setMode('register'); setError('') }}
            >
              Daftar Baru
            </button>
          </div>

          <h2>{mode === 'login' ? 'Selamat datang kembali' : 'Buat akun FinNote'}</h2>
          <p>{mode === 'login' ? 'Masuk untuk membuka catatan keuangan pribadimu.' : 'Daftar untuk mencatat keuangan dari berbagai perangkat.'}</p>

          {mode === 'register' && (
            <Field label="Nama Lengkap">
              <input
                autoFocus
                autoComplete="name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Contoh: Raka Pratama"
              />
            </Field>
          )}

          <Field label="Alamat Email">
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="nama@email.com"
            />
          </Field>

          <Field label="Kata Sandi">
            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
            />
          </Field>

          {error && <p className="form-error login-error" role="alert">{error}</p>}

          <button className="primary login-submit" type="submit" disabled={loading}>
            {loading ? 'Memproses...' : mode === 'login' ? 'Masuk ke FinNote' : 'Daftar Akun'}
            <span className="button-orb"><ArrowRight size={17} /></span>
          </button>

          <div className="auth-switch-text">
            {mode === 'login' ? (
              <span>Belum punya akun? <button type="button" onClick={() => { setMode('register'); setError('') }}>Daftar sekarang</button></span>
            ) : (
              <span>Sudah punya akun? <button type="button" onClick={() => { setMode('login'); setError('') }}>Masuk di sini</button></span>
            )}
          </div>
        </form>
      </section>
    </main>
  )
}

function PanelHeader({ title, action, onClick }) {
  return <div className="panel-head"><h2>{title}</h2><button onClick={onClick}>{action}</button></div>
}

function TransactionRow({ item, actions, onEdit, onDelete }) {
  return (
    <div className="transaction-row">
      <span className={`transaction-icon ${item.type}`}>{iconFor(item.category)}</span>
      <div className="transaction-copy">
        <strong>{item.title}</strong>
        <span>{item.category}{item.note ? ` • ${item.note}` : ''}</span>
      </div>
      <div className="transaction-value">
        <strong className={item.type}>{item.type === 'income' ? '+' : '-'}{rupiah.format(item.amount)}</strong>
        <span>{dateLabel.format(new Date(`${item.date}T00:00:00`))}</span>
      </div>
      {actions && (
        <div className="row-actions">
          <button onClick={onEdit} aria-label="Edit transaksi"><PencilSimple size={16} /></button>
          <button onClick={onDelete} aria-label="Hapus transaksi"><Trash size={16} /></button>
        </div>
      )}
    </div>
  )
}

function GoalCard({ goal, compact, onSaving, onEdit, onDelete }) {
  const percent = Math.min(Math.round((goal.saved / goal.target) * 100), 100)
  const Icon = goal.icon === 'camera' ? Camera : Gift
  return (
    <article className={`goal-card ${compact ? 'compact-card' : ''}`}>
      <div className="goal-visual"><Icon size={compact ? 20 : 28} weight="regular" /></div>
      <div className="goal-content">
        <div className="goal-title">
          <div>
            <h3>{goal.name}</h3>
            <p>Target {rupiah.format(goal.target)}</p>
          </div>
          {!compact && (
            <div className="row-actions">
              <button onClick={onEdit} aria-label="Edit target"><PencilSimple size={16} /></button>
              <button onClick={onDelete} aria-label="Hapus target"><Trash size={16} /></button>
            </div>
          )}
        </div>
        <div className="progress"><span style={{ width: `${percent}%` }} /></div>
        <div className="progress-label">
          <span>{rupiah.format(goal.saved)} terkumpul</span>
          <strong>{percent}%</strong>
        </div>
        {!compact && (
          <div className="goal-footer">
            <span>{dateLabel.format(new Date(`${goal.deadline}T00:00:00`))}</span>
            <button className="secondary" onClick={onSaving}>Tambah tabungan</button>
          </div>
        )}
        {compact && <button className="text-button" onClick={onSaving}>Tambah tabungan</button>}
      </div>
    </article>
  )
}

function ModalShell({ title, subtitle, onClose, children }) {
  return (
    <dialog
      ref={el => el && !el.open && el.showModal()}
      className="modal-backdrop"
      onClick={event => event.target === event.currentTarget && onClose()}
      onClose={onClose}
    >
      <div className="modal" aria-labelledby="modal-title">
        <div className="modal-head">
          <div>
            <h2 id="modal-title">{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Tutup"><X size={18} /></button>
        </div>
        {children}
      </div>
    </dialog>
  )
}

// --- 4x4 Calculator Keypad Transaction Modal ---
function TransactionModal({ initial, defaultType, onClose, onSave }) {
  const [type, setType] = useState(initial?.type || defaultType || 'expense')
  const [title, setTitle] = useState(initial?.title || '')
  const [category, setCategory] = useState(initial?.category || (type === 'income' ? 'Gaji' : 'Makan & Minum'))
  const [date, setDate] = useState(initial?.date || today)
  const [note, setNote] = useState(initial?.note || '')
  const [tokens, setTokens] = useState(() => initial?.amount ? [String(initial.amount)] : ['0'])
  const [error, setError] = useState('')

  const evaluatedAmount = useMemo(() => evaluateKeypadExpression(tokens), [tokens])
  const formattedDisplay = evaluatedAmount === 0 ? '0' : evaluatedAmount.toLocaleString('id-ID')
  const exprDisplay = tokens.length > 1
    ? tokens.map(t => isOperator(t) ? ` ${t} ` : (parseInt(t, 10) || 0).toLocaleString('id-ID')).join('')
    : ''

  const pressDigit = d => {
    setTokens(prev => {
      const copy = [...prev]
      const last = copy[copy.length - 1]
      if (isOperator(last)) {
        if (d === '0' || d === '000') return [...copy, '0']
        return [...copy, d]
      }
      if (last === '0') {
        if (d === '0' || d === '000') return copy
        copy[copy.length - 1] = d
        return copy
      }
      if (last.length >= 13) return copy
      copy[copy.length - 1] = last + d
      return copy
    })
  }

  const pressOp = op => {
    setTokens(prev => {
      const last = prev[prev.length - 1]
      if (isOperator(last)) {
        const copy = [...prev]
        copy[copy.length - 1] = op
        return copy
      }
      if (last === '0' && prev.length === 1) return prev
      return [...prev, op]
    })
  }

  const backspace = () => {
    setTokens(prev => {
      const last = prev[prev.length - 1]
      if (isOperator(last)) {
        return prev.slice(0, -1)
      }
      if (last.length <= 1) {
        if (prev.length > 1) return prev.slice(0, -1)
        return ['0']
      }
      const copy = [...prev]
      copy[copy.length - 1] = last.slice(0, -1)
      return copy
    })
  }

  const addQuick = val => {
    setTokens([String(evaluatedAmount + val)])
  }

  const submit = e => {
    if (e) e.preventDefault()
    if (!title.trim() || evaluatedAmount <= 0) {
      return setError('Isi nama transaksi dan nominal lebih dari Rp 0.')
    }
    onSave({
      ...(initial || {}),
      type,
      title: title.trim(),
      amount: evaluatedAmount,
      category,
      date,
      note
    })
  }

  // Keyboard support inside modal
  useEffect(() => {
    const onKey = e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return
      if (e.key >= '0' && e.key <= '9') pressDigit(e.key)
      else if (e.key === 'Backspace') backspace()
      else if (e.key === '+') pressOp('+')
      else if (e.key === '-') pressOp('−')
      else if (e.key === '*') pressOp('×')
      else if (e.key === '/') { e.preventDefault(); pressOp('÷') }
      else if (e.key === 'Enter') submit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [evaluatedAmount, tokens, title, category, date, note])

  const options = type === 'income'
    ? ['Gaji', 'Freelance', 'Bonus', 'Investasi', 'Lainnya']
    : ['Makan & Minum', 'Belanja', 'Transportasi', 'Tagihan', 'Hiburan', 'Lainnya']

  const amountLen = String(evaluatedAmount).length
  const amountSizeKeypad = amountLen > 10 ? 'small' : amountLen > 7 ? 'medium' : ''

  return (
    <ModalShell
      title={initial ? 'Ubah Transaksi' : 'Catat Transaksi ✨'}
      subtitle="Ketik nominal langsung atau gunakan operator hitung."
      onClose={onClose}
    >
      <div className="keypad-modal">
        {/* Switcher Tipe */}
        <div className="type-switch" style={{ marginBottom: '12px' }}>
          <button
            type="button"
            className={type === 'income' ? 'active' : ''}
            onClick={() => { setType('income'); setCategory('Gaji') }}
          >
            <ArrowDown size={16} /> Pemasukan
          </button>
          <button
            type="button"
            className={type === 'expense' ? 'active' : ''}
            onClick={() => { setType('expense'); setCategory('Makan & Minum') }}
          >
            <ArrowUp size={16} /> Pengeluaran
          </button>
        </div>

        {/* Hero Amount Display */}
        <div className="keypad-display-hero">
          <div className="keypad-expr-line">{exprDisplay}</div>
          <div className="keypad-amount-row">
            <span className="keypad-currency">Rp</span>
            <span className={`keypad-amount-val ${amountSizeKeypad}`}>{formattedDisplay}</span>
          </div>
        </div>

        {/* Quick Chips */}
        <div className="keypad-quick-chips">
          <button type="button" className="keypad-chip" onClick={() => addQuick(10000)}>+10rb</button>
          <button type="button" className="keypad-chip" onClick={() => addQuick(20000)}>+20rb</button>
          <button type="button" className="keypad-chip" onClick={() => addQuick(50000)}>+50rb</button>
          <button type="button" className="keypad-chip" onClick={() => addQuick(100000)}>+100rb</button>
        </div>

        {/* 4x4 Calculator Keypad */}
        <div className="keypad-grid-4x4">
          {/* Row 1: 1, 2, 3, ÷ */}
          <button type="button" className="keypad-key" onClick={() => pressDigit('1')}>1</button>
          <button type="button" className="keypad-key" onClick={() => pressDigit('2')}>2</button>
          <button type="button" className="keypad-key" onClick={() => pressDigit('3')}>3</button>
          <button type="button" className="keypad-key key-op" onClick={() => pressOp('÷')}>÷</button>

          {/* Row 2: 4, 5, 6, × */}
          <button type="button" className="keypad-key" onClick={() => pressDigit('4')}>4</button>
          <button type="button" className="keypad-key" onClick={() => pressDigit('5')}>5</button>
          <button type="button" className="keypad-key" onClick={() => pressDigit('6')}>6</button>
          <button type="button" className="keypad-key key-op" onClick={() => pressOp('×')}>×</button>

          {/* Row 3: 7, 8, 9, − */}
          <button type="button" className="keypad-key" onClick={() => pressDigit('7')}>7</button>
          <button type="button" className="keypad-key" onClick={() => pressDigit('8')}>8</button>
          <button type="button" className="keypad-key" onClick={() => pressDigit('9')}>9</button>
          <button type="button" className="keypad-key key-op" onClick={() => pressOp('−')}>−</button>

          {/* Row 4: 0, 000, ⌫, + */}
          <button type="button" className="keypad-key" onClick={() => pressDigit('0')}>0</button>
          <button type="button" className="keypad-key key-000" onClick={() => pressDigit('000')}>000</button>
          <button type="button" className="keypad-key key-backspace" onClick={backspace} aria-label="Hapus digit">⌫</button>
          <button type="button" className="keypad-key key-op" onClick={() => pressOp('+')}>+</button>
        </div>

        {/* Compact metadata inputs */}
        <div className="form" style={{ marginTop: '12px' }}>
          <Field label="Nama Transaksi">
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Contoh: Makan siang, Kopi, Gaji bulanan"
            />
          </Field>

          <div className="form-grid">
            <Field label="Kategori">
              <div className="select-input-wrap">
                <select value={category} onChange={e => setCategory(e.target.value)}>
                  {options.map(item => <option key={item}>{item}</option>)}
                </select>
                <CaretDown size={14} />
              </div>
            </Field>
            <Field label="Tanggal">
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </Field>
          </div>

          <Field label="Catatan (opsional)">
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Detail tambahan singkat" />
          </Field>

          {error && <p className="form-error" role="alert">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="secondary" onClick={onClose}>Batal</button>
            <button className="primary" type="button" onClick={submit}>
              {initial ? 'Simpan Perubahan' : 'Simpan Transaksi'}
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  )
}

function GoalModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState(initial || { name: '', target: '', saved: '', deadline: today, icon: 'gift' })
  const [error, setError] = useState('')
  const update = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const submit = event => {
    event.preventDefault()
    if (!form.name.trim() || Number(form.target) <= 0) return setError('Isi nama wishlist dan target yang valid.')
    onSave({ ...form, name: form.name.trim(), target: Number(form.target), saved: Number(form.saved) || 0 })
  }
  return (
    <ModalShell title={initial ? 'Ubah Wishlist' : 'Tambah Wishlist'} subtitle="Tentukan target dan batas waktunya." onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label="Nama Wishlist">
          <input autoFocus value={form.name} onChange={event => update('name', event.target.value)} placeholder="Contoh: Laptop baru, Liburan" />
        </Field>
        <div className="form-grid">
          <Field label="Target Dana">
            <MoneyInput value={form.target} onChange={value => update('target', value)} />
          </Field>
          <Field label="Sudah Terkumpul (opsional)">
            <MoneyInput value={form.saved} onChange={value => update('saved', value)} />
          </Field>
        </div>
        <Field label="Target Tercapai">
          <input type="date" value={form.deadline} onChange={event => update('deadline', event.target.value)} />
        </Field>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>Batal</button>
          <button className="primary" type="submit">{initial ? 'Simpan Perubahan' : 'Simpan Wishlist'}</button>
        </div>
      </form>
    </ModalShell>
  )
}

function SavingModal({ goal, onClose, onSave }) {
  const [amount, setAmount] = useState('')
  const remaining = Math.max(goal.target - goal.saved, 0)
  return (
    <ModalShell title="Tambah Tabungan" subtitle={`Untuk ${goal.name}`} onClose={onClose}>
      <form className="form" onSubmit={event => { event.preventDefault(); Number(amount) > 0 && onSave(goal.id, Number(amount)) }}>
        <div className="saving-summary"><span>Sisa target</span><strong>{rupiah.format(remaining)}</strong></div>
        <Field label="Nominal Tabungan">
          <MoneyInput autoFocus value={amount} onChange={setAmount} />
        </Field>
        <div className="quick-amounts">
          {[100000, 250000, 500000].map(value => (
            <button type="button" key={value} onClick={() => setAmount(String(value))}>+{rupiah.format(value)}</button>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>Batal</button>
          <button className="primary" type="submit">Tambahkan</button>
        </div>
      </form>
    </ModalShell>
  )
}

function Field({ label, children }) { return <label className="field"><span>{label}</span>{children}</label> }
function MoneyInput({ value, onChange, autoFocus = false }) {
  return (
    <div className="money-input">
      <span aria-hidden="true">Rp</span>
      <input
        autoFocus={autoFocus}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={formatAmountInput(value)}
        onChange={event => onChange(normalizeAmount(event.target.value))}
        placeholder="0"
        aria-label="Nominal dalam rupiah"
      />
    </div>
  )
}

function EmptyState({ icon: Icon, doodle, title, text, action, onAction }) {
  return (
    <div className="empty-state">
      {doodle ? doodle : (Icon ? <span><Icon size={26} weight="regular" /></span> : null)}
      <h3>{title}</h3>
      <p>{text}</p>
      {action && <button className="primary" onClick={onAction}>{action}</button>}
    </div>
  )
}

function BudgetModal({ currentLimit, isActive, onClose, onSave }) {
  const [active, setActive] = useState(isActive ?? false)
  const [limit, setLimit] = useState(currentLimit ? String(currentLimit) : '')
  const [error, setError] = useState('')

  const submit = event => {
    event.preventDefault()
    if (active && (!Number(limit) || Number(limit) <= 0)) {
      return setError('Masukkan batas limit bulanan yang valid (lebih dari Rp 0).')
    }
    onSave({ limit: Number(limit) || 0, active })
  }

  const quickLimits = [1000000, 2500000, 5000000, 10000000]

  return (
    <ModalShell
      title="Limit Anggaran Bulanan"
      subtitle="Batas pengeluaran untuk menjaga arus kasmu tetap terkontrol."
      onClose={onClose}
    >
      <form className="form" onSubmit={submit}>
        <div className="toggle-box">
          <label className="toggle-label" htmlFor="budget-active-toggle">
            <span className="toggle-title">Aktifkan Limit Bulanan</span>
            <span className="toggle-desc">Peringatkan saat pengeluaran mendekati atau melampaui batas</span>
          </label>
          <input
            type="checkbox"
            id="budget-active-toggle"
            className="toggle-switch"
            checked={active}
            onChange={e => setActive(e.target.checked)}
          />
        </div>

        {active && (
          <>
            <Field label="Batas Maksimal Pengeluaran (per bulan)">
              <MoneyInput autoFocus value={limit} onChange={setLimit} />
            </Field>

            <div className="quick-amounts" aria-label="Pilihan nominal cepat">
              {quickLimits.map(val => (
                <button
                  type="button"
                  key={val}
                  className={Number(limit) === val ? 'active' : ''}
                  onClick={() => setLimit(String(val))}
                >
                  {rupiah.format(val)}
                </button>
              ))}
            </div>
          </>
        )}

        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>Batal</button>
          <button className="primary" type="submit">Simpan Pengaturan</button>
        </div>
      </form>
    </ModalShell>
  )
}

function DepositSavingsModal({ availableBalance = 0, onClose, onSave }) {
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')

  const submit = event => {
    event.preventDefault()
    const num = Number(amount)
    if (!num || num <= 0) return setError('Masukkan nominal uang yang ingin disisihkan.')
    if (availableBalance > 0 && num > availableBalance) {
      return setError(`Nominal melebihi uang siap pakai (${rupiah.format(availableBalance)}).`)
    }
    onSave(num)
  }

  const quickOptions = [100000, 250000, 500000, 1000000]

  return (
    <ModalShell
      title="Sisihkan ke Dana Simpanan"
      subtitle="Pisahkan uang untuk cadangan dan penyelamat saat limit habis."
      onClose={onClose}
    >
      <form className="form" onSubmit={submit}>
        <div className="savings-info-card">
          <div>
            <span>Uang siap pakai saat ini</span>
            <strong>{rupiah.format(Math.max(0, availableBalance))}</strong>
          </div>
        </div>

        <Field label="Nominal yang Disisihkan">
          <MoneyInput autoFocus value={amount} onChange={setAmount} />
        </Field>

        <div className="quick-amounts" aria-label="Nominal cepat simpanan">
          {quickOptions.map(val => (
            <button
              type="button"
              key={val}
              onClick={() => setAmount(prev => String((Number(prev) || 0) + val))}
            >
              +{rupiah.format(val)}
            </button>
          ))}
          {availableBalance > 0 && (
            <button
              type="button"
              onClick={() => setAmount(String(availableBalance))}
            >
              Sisihkan Semua
            </button>
          )}
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>Batal</button>
          <button className="primary" type="submit">Sisihkan Uang</button>
        </div>
      </form>
    </ModalShell>
  )
}

function UseSavingsModal({ savingsReserve, deficit = 0, onClose, onSave }) {
  const [amount, setAmount] = useState(deficit > 0 && deficit <= savingsReserve ? String(deficit) : '')
  const [error, setError] = useState('')

  const submit = event => {
    event.preventDefault()
    const num = Number(amount)
    if (!num || num <= 0) return setError('Masukkan nominal yang ingin digunakan.')
    if (num > savingsReserve) return setError('Nominal melebihi total dana simpanan yang tersedia.')
    onSave(num)
  }

  const quickValues = [50000, 100000, 250000, 500000].filter(v => v <= savingsReserve)

  return (
    <ModalShell
      title="Gunakan Uang Simpanan"
      subtitle={deficit > 0 ? "Ambil dari dana cadangan untuk menutupi defisit limit bulanan." : "Gunakan dana simpanan untuk dialihkan ke uang siap pakai."}
      onClose={onClose}
    >
      <form className="form" onSubmit={submit}>
        <div className="savings-info-card">
          <div>
            <span>Saldo Dana Simpanan</span>
            <strong>{rupiah.format(savingsReserve)}</strong>
          </div>
          {deficit > 0 && (
            <div className="deficit-badge">
              <span>Kekurangan limit:</span>
              <strong>{rupiah.format(deficit)}</strong>
            </div>
          )}
        </div>

        {savingsReserve <= 0 ? (
          <div className="empty-warning" role="alert">
            <Warning size={18} weight="fill" />
            <p>Saldo dana simpanan saat ini Rp 0. Belum ada dana cadangan yang bisa digunakan.</p>
          </div>
        ) : (
          <>
            <Field label="Nominal yang Digunakan">
              <MoneyInput autoFocus value={amount} onChange={setAmount} />
            </Field>

            <div className="quick-amounts" aria-label="Opsi penarikan cepat">
              {deficit > 0 && deficit <= savingsReserve && (
                <button
                  type="button"
                  className="quick-chip-highlight"
                  onClick={() => setAmount(String(deficit))}
                >
                  Tutup Defisit ({rupiah.format(deficit)})
                </button>
              )}
              {quickValues.map(val => (
                <button
                  type="button"
                  key={val}
                  onClick={() => setAmount(String(val))}
                >
                  {rupiah.format(val)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAmount(String(savingsReserve))}
              >
                Gunakan Semua ({rupiah.format(savingsReserve)})
              </button>
            </div>
          </>
        )}

        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>Batal</button>
          {savingsReserve > 0 && (
            <button className="primary" type="submit">{deficit > 0 ? 'Tutup Defisit Limit' : 'Gunakan Simpanan'}</button>
          )}
        </div>
      </form>
    </ModalShell>
  )
}
