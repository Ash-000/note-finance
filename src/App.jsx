import { useEffect, useMemo, useState } from 'react'
import {
  ArrowClockwise, ArrowDown, ArrowRight, ArrowUp, Bank, BookOpen, Briefcase, CalendarBlank, Camera,
  CaretDown, CaretLeft, CaretRight, Check, Coffee, Coins, DotsThree, Gear, Gift, Heart,
  House, MagnifyingGlass, Minus, Moon, PaperPlaneTilt, PencilSimple, Plus, Receipt, ShoppingCart,
  ShieldCheck, SignOut, SlidersHorizontal, Sun, Trash, TrendDown, TrendUp, UserCircle, Vault, Wallet, Warning, X,
} from '@phosphor-icons/react'
import { amountSizeClass, buildDonutStops, calculateBudgetStatus, formatAmountInput, isDateInPeriod, isValidLogin, normalizeAmount } from './validation'

const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
const dateLabel = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
const monthLabel = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' })
const today = new Date().toISOString().slice(0, 10)

const iconFor = (category, size = 20) => {
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

export default function App() {
  const [transactions, setTransactions] = useStoredState('arta-transactions-v2', [])
  const [goals, setGoals] = useStoredState('arta-goals-v2', [])
  const [monthlyBudget, setMonthlyBudget] = useStoredState('note-monthly-budget-v1', { limit: 0, active: false, extraFromSavings: 0, month: today.slice(0, 7) })
  const [savingsReserve, setSavingsReserve] = useStoredState('note-savings-reserve-v1', 0)
  const [session, setSession] = useStoredState('arta-session', null)
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

  // Sinkronisasi data dengan server bot Telegram
  const syncWithServer = async (silent = true) => {
    try {
      if (!silent) setIsSyncing(true)
      const statusRes = await fetch('/api/status').catch(() => null)
      if (!statusRes || !statusRes.ok) {
        setBotStatus(prev => ({ ...prev, connected: false }))
        if (!silent) setToast('Server bot belum aktif (jalankan "npm run bot")')
        return
      }
      const statusData = await statusRes.json()
      setBotStatus({
        connected: true,
        botActive: statusData.botActive,
        botUsername: statusData.botUsername,
        hasToken: statusData.hasToken
      })

      const syncRes = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions })
      }).catch(() => null)

      if (syncRes && syncRes.ok) {
        const data = await syncRes.json()
        if (Array.isArray(data.transactions) && data.transactions.length !== transactions.length) {
          setTransactions(data.transactions)
        }
        if (!silent) setToast('Data berhasil disinkronkan!')
      }
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
  }, [transactions])

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
    setToast(isEdit ? 'Transaksi berhasil diperbarui' : 'Transaksi berhasil dicatat')
    setModal(null)
    if (botStatus.connected) {
      fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tx)
      }).catch(() => {})
    }
  }

  const deleteTransaction = id => {
    if (window.confirm('Hapus transaksi ini? Tindakan ini tidak dapat dibatalkan.')) {
      setTransactions(items => items.filter(item => item.id !== id))
      setToast('Transaksi dihapus')
      if (botStatus.connected) {
        fetch(`/api/transactions/${id}`, { method: 'DELETE' }).catch(() => {})
      }
    }
  }
  const saveGoal = data => {
    if (data.id) setGoals(items => items.map(item => item.id === data.id ? data : item))
    else setGoals(items => [{ ...data, id: crypto.randomUUID() }, ...items])
    setToast(data.id ? 'Wishlist diperbarui' : 'Target baru ditambahkan')
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
    setToast('Tabungan berhasil ditambahkan')
    setModal(null)
  }

  const saveMonthlyBudget = ({ limit, active }) => {
    setMonthlyBudget(prev => ({ ...prev, limit: Number(limit) || 0, active, month: today.slice(0, 7) }))
    setToast(active ? `Limit bulanan diatur ke ${rupiah.format(limit)}` : 'Limit bulanan dinonaktifkan')
    setModal(null)
  }

  const depositSavings = amount => {
    const safeAmount = Number(amount) || 0
    if (safeAmount <= 0) return
    setSavingsReserve(prev => prev + safeAmount)
    setToast(`Berhasil menyisihkan ${rupiah.format(safeAmount)} ke dana simpanan`)
    setModal(null)
  }

  const useSavingsForBudget = amount => {
    const safeAmount = Number(amount) || 0
    if (safeAmount <= 0) return
    if (safeAmount > savingsReserve) {
      setToast('Saldo dana simpanan tidak mencukupi')
      return
    }
    setSavingsReserve(prev => prev - safeAmount)
    if (monthlyBudget.active) {
      setMonthlyBudget(prev => ({ ...prev, extraFromSavings: (prev.extraFromSavings || 0) + safeAmount }))
    }
    setToast(monthlyBudget.active && budgetStatus.isExceeded ? `Dana simpanan ${rupiah.format(safeAmount)} digunakan untuk menutup defisit limit` : `Dana simpanan ${rupiah.format(safeAmount)} dialihkan ke uang siap digunakan`)
    setModal(null)
  }

  const title = nav.find(item => item.id === view)?.label
  if (!session) return <LoginScreen onLogin={setSession} />

  const firstName = session.name.trim().split(/\s+/)[0]
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
            onLogout={() => setSession(null)}
            onClear={() => {
              if (window.confirm('Hapus seluruh data keuangan (transaksi, wishlist, limit, dan simpanan)?')) {
                setTransactions([])
                setGoals([])
                setMonthlyBudget({ limit: 0, active: false, extraFromSavings: 0, month: today.slice(0, 7) })
                setSavingsReserve(0)
                setToast('Semua data keuangan dihapus')
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
              <Icon size={21} weight={view === id ? 'fill' : 'regular'} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="account-card">
            <UserCircle size={38} weight="fill" />
            <div>
              <strong>{session.name}</strong>
              <span>{botStatus.connected && botStatus.botActive ? `Bot @${botStatus.botUsername}` : 'Data tersimpan lokal'}</span>
            </div>
            <DotsThree size={22} />
          </div>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <button className="mobile-brand" onClick={() => setView('summary')} aria-label="FinNote, ke ringkasan"><BrandMark /><span><strong>FinNote</strong><small>Catatan keuangan</small></span></button>
          <div className="topbar-copy">
            <p className="eyebrow">
              {monthLabel.format(new Date())}
              {isTelegramMiniApp && <span className="tma-badge">📱 Telegram</span>}
            </p>
            <h1>{view === 'summary' ? `Selamat datang, ${firstName}` : title}</h1>
          </div>
          <div className="header-actions">
            <button className="icon-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}>{theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}</button>
            <button className="primary header-cta" onClick={() => setModal({ kind: 'transaction', type: 'expense' })}>Catat transaksi<span className="button-orb"><Plus size={17} weight="bold" /></span></button>
          </div>
        </header>

        <div key={view} className="t-panel-slide view-transition">{page}</div>
      </main>

      <nav className="mobile-nav" aria-label="Navigasi mobile">
        {nav.map(({ id, label, icon: Icon }) => (
          <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}>
            <Icon size={22} weight={view === id ? 'fill' : 'regular'} /><span>{label}</span>
          </button>
        ))}
      </nav>

      {modal?.kind === 'transaction' && <TransactionModal initial={modal.item} defaultType={modal.type} onClose={() => setModal(null)} onSave={saveTransaction} />}
      {modal?.kind === 'goal' && <GoalModal initial={modal.item} onClose={() => setModal(null)} onSave={saveGoal} />}
      {modal?.kind === 'saving' && <SavingModal goal={modal.item} onClose={() => setModal(null)} onSave={addSaving} />}
      {modal?.kind === 'budget' && <BudgetModal currentLimit={monthlyBudget.limit} isActive={monthlyBudget.active} onClose={() => setModal(null)} onSave={saveMonthlyBudget} />}
      {modal?.kind === 'deposit-savings' && <DepositSavingsModal availableBalance={availableBalance} onClose={() => setModal(null)} onSave={depositSavings} />}
      {modal?.kind === 'use-savings' && <UseSavingsModal savingsReserve={savingsReserve} deficit={budgetStatus.isExceeded ? Math.abs(budgetStatus.remaining) : 0} onClose={() => setModal(null)} onSave={useSavingsForBudget} />}
      {toast && <div className="toast" role="status"><Check size={18} weight="bold" />{toast}</div>}
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
          <div className="overbudget-icon">
            <Warning size={24} weight="fill" />
          </div>
          <div className="overbudget-content">
            <div className="overbudget-header">
              <strong>Limit Pengeluaran Bulanan Terlampaui!</strong>
              <span className="overbudget-chip">Defisit {rupiah.format(Math.abs(budgetStatus.remaining))}</span>
            </div>
            <p>
              Pengeluaran bulan ini mencapai <strong>{rupiah.format(monthlyExpense)}</strong>, melebihi limit {rupiah.format(effectiveLimit)}. Gunakan dana simpanan cadangan untuk menutup defisit belanja.
            </p>
          </div>
          <div className="overbudget-actions">
            {savingsReserve > 0 ? (
              <button
                type="button"
                className="overbudget-btn primary"
                onClick={() => openModal({ kind: 'use-savings' })}
              >
                <Vault size={17} weight="bold" />
                <span>Gunakan Simpanan</span>
              </button>
            ) : (
              <button
                type="button"
                className="overbudget-btn secondary"
                onClick={() => openModal({ kind: 'deposit-savings' })}
              >
                <Plus size={17} weight="bold" />
                <span>Isi Dana Simpanan</span>
              </button>
            )}
          </div>
        </aside>
      )}

      <section className="balance-card">
        <div className="balance-main">
          <div className="balance-heading"><div><span className="section-icon"><Wallet size={20} weight="bold" /></span><p>Total akumulasi uang</p></div><span className="month-chip"><CalendarBlank size={16} weight="bold" />{monthLabel.format(new Date())}</span></div>
          <strong className={`balance-value ${amountSizeClass(totals.balance)}`}>{rupiah.format(totals.balance)}</strong>

          <div className="balance-split-row">
            <div className="split-item ready">
              <span className="split-icon"><Coins size={18} weight="fill" /></span>
              <div>
                <span className="split-label">Siap pakai</span>
                <strong className="split-value">{rupiah.format(availableBalance)}</strong>
              </div>
            </div>
            <div className="split-divider" aria-hidden="true" />
            <div className="split-item savings">
              <span className="split-icon"><Vault size={18} weight="fill" /></span>
              <div>
                <span className="split-label">Simpanan</span>
                <strong className="split-value">{rupiah.format(savingsReserve || 0)}</strong>
              </div>
            </div>
          </div>

          <div className="hero-totals">
            <div><span className="semantic income"><TrendUp size={18} weight="bold" /></span><p>Pemasukan</p><strong>{rupiah.format(totals.income)}</strong></div>
            <div><span className="semantic expense"><TrendDown size={18} weight="bold" /></span><p>Pengeluaran</p><strong>{rupiah.format(totals.expense)}</strong></div>
          </div>
          <div className="budget-line"><span style={{ width: `${spentPercent}%` }} /></div><small>{spentPercent}% pemasukan sudah digunakan</small>
        </div>
        <div className="chart-column">
          <div className="chart-head"><span>Pengeluaran</span><button onClick={() => setView('transactions')}>Detail</button></div>
          <div className="donut" aria-hidden="true" style={donutStops ? { '--donut-fill': `conic-gradient(from -90deg, ${donutStops})` } : undefined} />
          <div className="legend">{categories.length ? categories.map(([name, value]) => <div key={name}><span>{name}</span><strong>{rupiah.format(value)}</strong></div>) : <p className="chart-empty">Belum ada pengeluaran</p>}</div>
        </div>
      </section>

      <div className="quick-actions">
        <button
          type="button"
          className="quick income"
          onClick={() => openModal({ kind: 'transaction', type: 'income' })}
        >
          <span className="quick-icon"><Plus size={18} weight="bold" /></span>
          <div className="quick-copy">
            <strong>Pemasukan</strong>
            <small>Tambah pemasukan</small>
          </div>
        </button>
        <button
          type="button"
          className="quick expense"
          onClick={() => openModal({ kind: 'transaction', type: 'expense' })}
        >
          <span className="quick-icon"><Minus size={18} weight="bold" /></span>
          <div className="quick-copy">
            <strong>Pengeluaran</strong>
            <small>Tambah pengeluaran</small>
          </div>
        </button>
      </div>

      <section className="budget-vault-grid" aria-label="Limit anggaran dan dana simpanan">
        <article className={`panel bv-card budget-card ${monthlyBudget?.active ? budgetStatus.status : 'inactive'}`}>
          <div className="bv-card-head">
            <div className="bv-card-title">
              <span className={`bv-icon budget ${budgetStatus.status}`}>
                <SlidersHorizontal size={20} weight="bold" />
              </span>
              <div>
                <h3>Limit Bulanan</h3>
                <p>{monthlyBudget?.active ? 'Batas belanja bulan ini' : 'Batas belanja dinonaktifkan'}</p>
              </div>
            </div>
            <button
              type="button"
              className="text-button bv-edit-btn"
              onClick={() => openModal({ kind: 'budget' })}
            >
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

              {monthlyBudget?.extraFromSavings > 0 && (
                <div className="bv-extra-note">
                  <Coins size={14} weight="fill" />
                  <span>Termasuk +{rupiah.format(monthlyBudget.extraFromSavings)} dari dana simpanan</span>
                </div>
              )}

              {(budgetStatus.isExceeded || budgetStatus.isWarning) && (
                <div className="bv-quick-relief">
                  <button
                    type="button"
                    className="secondary bv-relief-btn"
                    onClick={() => openModal({ kind: 'use-savings' })}
                  >
                    <Vault size={16} weight="bold" />
                    <span>Gunakan Simpanan</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bv-card-empty">
              <p>Belum ada batas belanja yang aktif. Tetapkan limit bulanan agar pengeluaran tetap terkontrol.</p>
              <button
                type="button"
                className="secondary"
                onClick={() => openModal({ kind: 'budget' })}
              >
                <Plus size={16} weight="bold" />
                <span>Pasang Limit Pengeluaran</span>
              </button>
            </div>
          )}
        </article>

        <article className="panel bv-card vault-card">
          <div className="bv-card-head">
            <div className="bv-card-title">
              <span className="bv-icon vault">
                <Vault size={20} weight="fill" />
              </span>
              <div>
                <h3>Dana Simpanan</h3>
                <p>Pemisahan uang cadangan</p>
              </div>
            </div>
            <button
              type="button"
              className="text-button bv-edit-btn"
              onClick={() => openModal({ kind: 'deposit-savings' })}
            >
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
                ? 'Dana cadangan terpisah yang siap digunakan jika pengeluaran melebihi limit bulanan.'
                : 'Belum ada saldo simpanan. Sisihkan uang untuk cadangan jika kuota bulanan habis.'}
            </p>

            <div className="bv-vault-actions">
              <button
                type="button"
                className="primary bv-action-btn"
                onClick={() => openModal({ kind: 'deposit-savings' })}
              >
                <Plus size={16} weight="bold" />
                <span>Sisihkan Uang</span>
              </button>
              <button
                type="button"
                className="secondary bv-action-btn"
                disabled={!savingsReserve || savingsReserve <= 0}
                onClick={() => openModal({ kind: 'use-savings' })}
              >
                <Coins size={16} weight="bold" />
                <span>Gunakan Simpanan</span>
              </button>
            </div>
          </div>
        </article>
      </section>

      <section className="panel transactions-panel"><PanelHeader title="Transaksi terbaru" action="Lihat semua" onClick={() => setView('transactions')} />{transactions.length ? <div className="transaction-list">{transactions.slice(0, 5).map(item => <TransactionRow key={item.id} item={item} />)}</div> : <EmptyState icon={BookOpen} title="Catatanmu masih kosong" text="Catat transaksi pertama. Ringkasan bulan ini akan terisi otomatis." action="Mulai mencatat" onAction={() => openModal({ kind: 'transaction', type: 'expense' })} />}</section>
      <section className="panel wishlist-panel"><PanelHeader title="Wishlist" action="Lihat semua" onClick={() => setView('wishlist')} />{goals.length ? <div className="goal-list compact">{goals.slice(0, 2).map(goal => <GoalCard key={goal.id} goal={goal} compact onSaving={() => openModal({ kind: 'saving', item: goal })} />)}</div> : <EmptyState icon={Heart} title="Belum ada wishlist" text="Simpan target dan pantau dana yang sudah terkumpul." action="Buat wishlist" onAction={() => openModal({ kind: 'goal' })} />}</section>
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

  useEffect(() => {
    setPage(1)
  }, [query, category, period, typeFilter])

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
            <small>{periodTransactions.length} total transaksi periode ini</small>
          </div>
          <span className="tx-stat-icon balance"><Receipt size={28} weight="bold" /></span>
        </div>
        <div className="tx-summary-card income">
          <div>
            <p>Total pemasukan</p>
            <strong className={`income ${amountSizeClass(periodTotals.income)}`}>{rupiah.format(periodTotals.income)}</strong>
            <small>{periodTransactions.filter(t => t.type === 'income').length} transaksi</small>
          </div>
          <span className="tx-stat-icon income"><TrendUp size={26} weight="bold" /></span>
        </div>
        <div className="tx-summary-card expense">
          <div>
            <p>Total pengeluaran</p>
            <strong className={`expense ${amountSizeClass(periodTotals.expense)}`}>{rupiah.format(periodTotals.expense)}</strong>
            <small>{periodTransactions.filter(t => t.type === 'expense').length} transaksi</small>
          </div>
          <span className="tx-stat-icon expense"><TrendDown size={26} weight="bold" /></span>
        </div>
      </div>

      <section className="panel table-panel">
        <div className="tx-header-bar">
          <div className="type-tabs" role="tablist" aria-label="Filter tipe transaksi">
            <button type="button" role="tab" aria-selected={typeFilter === 'all'} className={typeFilter === 'all' ? 'active' : ''} onClick={() => { setTypeFilter('all'); setCategory('Semua kategori') }}>Semua ({periodTransactions.length})</button>
            <button type="button" role="tab" aria-selected={typeFilter === 'income'} className={typeFilter === 'income' ? 'active' : ''} onClick={() => { setTypeFilter('income'); setCategory('Semua kategori') }}><TrendUp size={16} />Pemasukan</button>
            <button type="button" role="tab" aria-selected={typeFilter === 'expense'} className={typeFilter === 'expense' ? 'active' : ''} onClick={() => { setTypeFilter('expense'); setCategory('Semua kategori') }}><TrendDown size={16} />Pengeluaran</button>
          </div>
          <button className="primary tx-add-btn" onClick={() => openModal({ kind: 'transaction', type: typeFilter === 'income' ? 'income' : 'expense' })}><Plus size={18} />Catat transaksi</button>
        </div>

        <div className="list-toolbar">
          <div className="search">
            <MagnifyingGlass size={19} />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari transaksi berdasarkan nama, kategori, atau catatan..." aria-label="Cari transaksi" />
          </div>
          <div className="select-wrap period-filter">
            <select value={period} onChange={event => setPeriod(event.target.value)} aria-label="Filter periode">
              {periodOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <CaretDown size={16} />
          </div>
          <div className="select-wrap category-filter">
            <select value={category} onChange={event => setCategory(event.target.value)} aria-label="Filter kategori">
              <option>Semua kategori</option>
              {categories.map(item => <option key={item}>{item}</option>)}
            </select>
            <CaretDown size={16} />
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
            text={query || category !== 'Semua kategori' || typeFilter !== 'all' ? 'Coba kata kunci atau filter yang berbeda.' : `Belum ada catatan transaksi untuk ${activePeriod}.`}
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
  return <div className="page-stack"><div className="wishlist-heading"><div><p>Total tabungan wishlist</p><strong className={amountSizeClass(totalSaved)}>{rupiah.format(totalSaved)}</strong><span>dari target {rupiah.format(totalTarget)}</span></div><button className="primary" onClick={() => openModal({ kind: 'goal' })}><Plus size={18} />Tambah wishlist</button></div>
    {goals.length ? <div className="goals-grid">{goals.map(goal => <GoalCard key={goal.id} goal={goal} onSaving={() => openModal({ kind: 'saving', item: goal })} onEdit={() => openModal({ kind: 'goal', item: goal })} onDelete={() => onDelete(goal.id)} />)}</div> : <section className="panel"><EmptyState icon={Heart} title="Wishlist masih kosong" text="Tambahkan barang atau pengalaman yang ingin kamu wujudkan." action="Buat wishlist" onAction={() => openModal({ kind: 'goal' })} /></section>}
  </div>
}

function SettingsPage({ onLogout, onClear, monthlyBudget, savingsReserve, openModal, botStatus, onSync, isSyncing }) {
  return <div className="settings-grid">
    <div className="settings-content">
      <section className="panel settings-section">
        <div className="settings-icon"><PaperPlaneTilt size={26} weight="bold" /></div>
        <div>
          <h2>Integrasi Bot Telegram</h2>
          <p>Catat transaksi praktis lewat chat Telegram langsung ke FinNote.</p>
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
              title="Sinkronkan data transaksi antara browser dan bot"
            >
              <ArrowClockwise size={18} className={isSyncing ? 'spin' : ''} />
              <span>{isSyncing ? 'Sinkron...' : 'Sinkronkan'}</span>
            </button>
            {botStatus?.botUsername && (
              <a
                href={`https://t.me/${botStatus.botUsername}`}
                target="_blank"
                rel="noreferrer"
                className="primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', padding: '10px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: '600' }}
              >
                <PaperPlaneTilt size={16} weight="bold" />
                <span>Buka Bot</span>
              </a>
            )}
          </div>
        </div>

        <div className="telegram-guide-box">
          <p className="guide-title"><strong>💡 Panduan Cepat Menghubungkan Bot:</strong></p>
          <div className="guide-steps">
            <div className="guide-step">
              <span className="step-num">1</span>
              <div>
                <strong>Buat Bot & Dapatkan Token</strong>
                <p>Buka <a href="https://t.me/botfather" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>@BotFather</a> di Telegram, kirim <code>/newbot</code>, lalu salin token bot.</p>
              </div>
            </div>
            <div className="guide-step">
              <span className="step-num">2</span>
              <div>
                <strong>Simpan Token ke File .env</strong>
                <p>Buka file <code>.env</code> di folder proyek, isi <code>TELEGRAM_BOT_TOKEN=token_kamu</code>, lalu jalankan <code>npm run bot</code>.</p>
              </div>
            </div>
            <div className="guide-step">
              <span className="step-num">3</span>
              <div>
                <strong>Ketik Chat untuk Mencatat</strong>
                <p>Chat bot Telegram dengan format santai: <code>kopi 25k</code>, <code>bensin 50rb</code>, <code>makan siang 35.000</code>, <code>gaji 5jt</code>, atau <code>/saldo</code>.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="panel settings-section">
        <div className="settings-icon"><SlidersHorizontal size={26} weight="bold" /></div>
        <div><h2>Limit Anggaran & Simpanan</h2><p>Atur batas belanja bulanan dan alokasi dana cadangan.</p></div>
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
            <SlidersHorizontal size={18} />Atur limit
          </button>
        </div>
        <div className="setting-row">
          <div>
            <strong>Dana Simpanan Cadangan</strong>
            <span>Total tersimpan: {rupiah.format(savingsReserve || 0)}</span>
          </div>
          <div className="setting-row-actions">
            <button className="secondary" onClick={() => openModal({ kind: 'deposit-savings' })}>
              <Coins size={18} />Sisihkan
            </button>
            {savingsReserve > 0 && (
              <button className="secondary" onClick={() => openModal({ kind: 'use-savings' })}>
                <Vault size={18} />Gunakan
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="panel settings-section">
        <div className="settings-icon"><ShieldCheck size={26} weight="bold" /></div>
        <div><h2>Data dan sesi</h2><p>Kontrol data yang tersimpan pada browser ini.</p></div>
        <div className="setting-row"><div><strong>Hapus data keuangan</strong><span>Menghapus semua transaksi, wishlist, limit, dan simpanan.</span></div><button className="danger-button" onClick={onClear}><Trash size={18} />Hapus data</button></div>
        <div className="setting-row"><div><strong>Keluar dari FinNote</strong><span>Data keuangan tetap tersimpan setelah keluar.</span></div><button className="secondary" onClick={onLogout}><SignOut size={18} />Keluar</button></div>
      </section>
    </div>
    <aside className="settings-preview" aria-label="Preview tema">
      <div className="preview-brand"><BrandMark />FinNote</div>
      <div className="preview-copy"><span>TEMA AKTIF</span><strong>Fintech Obsidian</strong><p>Palet monokrom berkalibrasi tinggi dengan aksen emerald dan rose untuk manajemen keuangan presisi.</p></div>
      <div className="preview-window"><div className="preview-window-head"><i /><i /><i /></div><div className="preview-window-body"><span /><span /><span /></div></div>
    </aside>
  </div>
}

function LoginScreen({ onLogin }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const submit = event => {
    event.preventDefault()
    if (!isValidLogin(name)) return setError('Masukkan nama yang valid.')
    onLogin({ name: name.trim() })
  }
  return <main className="login-page">
    <section className="login-copy t-stagger is-shown"><button className="brand login-brand" type="button"><BrandMark /><span>FinNote</span></button><div><p className="login-kicker t-stagger-line t-stagger-line--1">Keuangan pribadi</p><h1 className="t-stagger-line t-stagger-line--2">Uang lebih tertata.<br />Hidup lebih tenang.</h1><p className="login-description t-stagger-line t-stagger-line--3">Catat pemasukan, pengeluaran, dan target tanpa spreadsheet.</p></div><div className="login-foot"><ShieldCheck size={18} />Data tersimpan di browser perangkat ini</div></section>
    <section className="login-form-wrap"><form className="login-card" onSubmit={submit}><div className="login-avatar"><UserCircle size={34} weight="fill" /></div><h2>Selamat datang</h2><p>Masuk untuk membuka catatan keuanganmu.</p><Field label="Nama"><input autoFocus autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder="Nama kamu" /></Field>{error && <p className="form-error login-error" role="alert">{error}</p>}<button className="primary login-submit">Masuk ke FinNote <span className="button-orb"><ArrowRight size={17} /></span></button><small>Login lokal. Tidak ada data yang dikirim ke server.</small></form></section>
  </main>
}

function PanelHeader({ title, action, onClick }) { return <div className="panel-head"><h2>{title}</h2><button onClick={onClick}>{action}</button></div> }

function TransactionRow({ item, actions, onEdit, onDelete }) {
  return <div className="transaction-row"><span className={`transaction-icon ${item.type}`}>{iconFor(item.category)}</span><div className="transaction-copy"><strong>{item.title}</strong><span>{item.category}{item.note ? ` • ${item.note}` : ''}</span></div><div className="transaction-value"><strong className={item.type}>{item.type === 'income' ? '+' : '-'}{rupiah.format(item.amount)}</strong><span>{dateLabel.format(new Date(`${item.date}T00:00:00`))}</span></div>{actions && <div className="row-actions"><button onClick={onEdit} aria-label="Edit transaksi"><PencilSimple size={18} /></button><button onClick={onDelete} aria-label="Hapus transaksi"><Trash size={18} /></button></div>}</div>
}

function GoalCard({ goal, compact, onSaving, onEdit, onDelete }) {
  const percent = Math.min(Math.round((goal.saved / goal.target) * 100), 100)
  const Icon = goal.icon === 'camera' ? Camera : Gift
  return <article className={`goal-card ${compact ? 'compact-card' : ''}`}><div className="goal-visual"><Icon size={compact ? 24 : 32} weight="bold" /></div><div className="goal-content"><div className="goal-title"><div><h3>{goal.name}</h3><p>Target {rupiah.format(goal.target)}</p></div>{!compact && <div className="row-actions"><button onClick={onEdit} aria-label="Edit target"><PencilSimple size={18} /></button><button onClick={onDelete} aria-label="Hapus target"><Trash size={18} /></button></div>}</div><div className="progress"><span style={{ width: `${percent}%` }} /></div><div className="progress-label"><span>{rupiah.format(goal.saved)} terkumpul</span><strong>{percent}%</strong></div>{!compact && <div className="goal-footer"><span><CalendarBlank size={17} />{dateLabel.format(new Date(`${goal.deadline}T00:00:00`))}</span><button className="secondary" onClick={onSaving}>Tambah tabungan</button></div>}{compact && <button className="text-button" onClick={onSaving}>Tambah tabungan</button>}</div></article>
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
          <button type="button" className="icon-button" onClick={onClose} aria-label="Tutup"><X size={20} /></button>
        </div>
        {children}
      </div>
    </dialog>
  )
}

function TransactionModal({ initial, defaultType, onClose, onSave }) {
  const [form, setForm] = useState(initial || { type: defaultType || 'expense', title: '', category: defaultType === 'income' ? 'Gaji' : 'Makan & Minum', amount: '', date: today, note: '' })
  const [error, setError] = useState('')
  const update = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const submit = event => {
    event.preventDefault()
    if (!form.title.trim() || Number(form.amount) <= 0) return setError('Isi nama transaksi dan nominal yang valid.')
    onSave({ ...form, title: form.title.trim(), amount: Number(form.amount) })
  }
  const options = form.type === 'income' ? ['Gaji', 'Freelance', 'Bonus', 'Investasi', 'Lainnya'] : ['Makan & Minum', 'Belanja', 'Transportasi', 'Tagihan', 'Hiburan', 'Lainnya']
  return (
    <ModalShell title={initial ? 'Ubah transaksi' : 'Catat transaksi'} subtitle="Masukkan transaksi. Ringkasan akan ikut berubah." onClose={onClose}>
      <form onSubmit={submit} className="form">
        <div className="type-switch">
          <button type="button" className={form.type === 'income' ? 'active' : ''} onClick={() => { update('type', 'income'); update('category', 'Gaji') }}>
            <ArrowDown size={18} />Pemasukan
          </button>
          <button type="button" className={form.type === 'expense' ? 'active' : ''} onClick={() => { update('type', 'expense'); update('category', 'Makan & Minum') }}>
            <ArrowUp size={18} />Pengeluaran
          </button>
        </div>
        <Field label="Nama transaksi">
          <input autoFocus value={form.title} onChange={event => update('title', event.target.value)} placeholder="Contoh: Makan siang, Gaji bulanan" />
        </Field>
        <Field label="Nominal">
          <MoneyInput value={form.amount} onChange={value => update('amount', value)} />
        </Field>
        <div className="form-grid">
          <Field label="Kategori">
            <div className="select-input-wrap">
              <select value={form.category} onChange={event => update('category', event.target.value)}>
                {options.map(item => <option key={item}>{item}</option>)}
              </select>
              <CaretDown size={16} />
            </div>
          </Field>
          <Field label="Tanggal">
            <input type="date" value={form.date} onChange={event => update('date', event.target.value)} />
          </Field>
        </div>
        <Field label="Catatan (opsional)">
          <input value={form.note} onChange={event => update('note', event.target.value)} placeholder="Tambahkan detail singkat" />
        </Field>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>Batal</button>
          <button className="primary" type="submit">{initial ? 'Simpan perubahan' : 'Simpan transaksi'}</button>
        </div>
      </form>
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
    <ModalShell title={initial ? 'Ubah wishlist' : 'Tambah wishlist'} subtitle="Tentukan target dan batas waktunya." onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <Field label="Nama wishlist">
          <input autoFocus value={form.name} onChange={event => update('name', event.target.value)} placeholder="Contoh: Kamera Sony, Liburan ke Bali" />
        </Field>
        <div className="form-grid">
          <Field label="Target dana">
            <MoneyInput value={form.target} onChange={value => update('target', value)} />
          </Field>
          <Field label="Sudah terkumpul (opsional)">
            <MoneyInput value={form.saved} onChange={value => update('saved', value)} />
          </Field>
        </div>
        <Field label="Target tercapai">
          <input type="date" value={form.deadline} onChange={event => update('deadline', event.target.value)} />
        </Field>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>Batal</button>
          <button className="primary" type="submit">{initial ? 'Simpan perubahan' : 'Simpan wishlist'}</button>
        </div>
      </form>
    </ModalShell>
  )
}

function SavingModal({ goal, onClose, onSave }) {
  const [amount, setAmount] = useState('')
  const remaining = Math.max(goal.target - goal.saved, 0)
  return (
    <ModalShell title="Tambah tabungan" subtitle={`Untuk ${goal.name}`} onClose={onClose}>
      <form className="form" onSubmit={event => { event.preventDefault(); Number(amount) > 0 && onSave(goal.id, Number(amount)) }}>
        <div className="saving-summary"><span>Sisa target</span><strong>{rupiah.format(remaining)}</strong></div>
        <Field label="Nominal tabungan">
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

function EmptyState({ icon: Icon, title, text, action, onAction }) { return <div className="empty-state"><span><Icon size={30} /></span><h3>{title}</h3><p>{text}</p>{action && <button className="primary" onClick={onAction}>{action}</button>}</div> }

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
      return setError(`Nominal melebihi uang yang siap digunakan (${rupiah.format(availableBalance)}).`)
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
            <span>Uang siap digunakan saat ini</span>
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
      subtitle={deficit > 0 ? "Ambil dari dana cadangan untuk menutupi defisit limit bulanan." : "Gunakan dana simpanan untuk dialihkan ke uang siap digunakan."}
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
            <Warning size={20} weight="fill" />
            <p>Saldo dana simpananmu saat ini Rp 0. Kamu belum memiliki dana cadangan yang bisa digunakan.</p>
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
