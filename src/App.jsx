import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDown, ArrowRight, ArrowUp, Bank, Bell, BookOpen, Briefcase, CalendarBlank, Camera,
  CaretDown, ChartDonut, Check, Coffee, DotsThree, Gear, Gift, Heart,
  House, MagnifyingGlass, Moon, PencilSimple, Plus, Receipt, ShoppingCart,
  Palette, ShieldCheck, SignOut, Sun, Trash, TrendDown, TrendUp, UserCircle, Wallet, X,
} from '@phosphor-icons/react'
import { isValidLogin } from './validation'

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
  { id: 'income', label: 'Pemasukan', icon: TrendUp },
  { id: 'expense', label: 'Pengeluaran', icon: TrendDown },
  { id: 'wishlist', label: 'Wishlist', icon: Heart },
  { id: 'settings', label: 'Pengaturan', icon: Gear },
]

export default function App() {
  const [transactions, setTransactions] = useStoredState('arta-transactions-v2', [])
  const [goals, setGoals] = useStoredState('arta-goals-v2', [])
  const [session, setSession] = useStoredState('arta-session', null)
  const [background, setBackground] = useStoredState('arta-background', '#f5f7f3')
  const [view, setView] = useState('summary')
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState('')
  const [theme, setTheme] = useStoredState('arta-theme', 'light')

  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])
  useEffect(() => { document.documentElement.style.setProperty('--custom-bg', background) }, [background])
  useEffect(() => {
    localStorage.removeItem('arta-transactions')
    localStorage.removeItem('arta-goals')
  }, [])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 2800)
    return () => clearTimeout(timer)
  }, [toast])

  const totals = useMemo(() => {
    const income = transactions.filter(t => t.type === 'income').reduce((sum, item) => sum + item.amount, 0)
    const expense = transactions.filter(t => t.type === 'expense').reduce((sum, item) => sum + item.amount, 0)
    return { income, expense, balance: income - expense }
  }, [transactions])

  const saveTransaction = data => {
    if (data.id) setTransactions(items => items.map(item => item.id === data.id ? data : item))
    else setTransactions(items => [{ ...data, id: crypto.randomUUID() }, ...items])
    setToast(data.id ? 'Transaksi berhasil diperbarui' : 'Transaksi berhasil dicatat')
    setModal(null)
  }
  const deleteTransaction = id => {
    if (window.confirm('Hapus transaksi ini? Tindakan ini tidak dapat dibatalkan.')) {
      setTransactions(items => items.filter(item => item.id !== id))
      setToast('Transaksi dihapus')
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

  const title = nav.find(item => item.id === view)?.label
  if (!session) return <LoginScreen onLogin={setSession} />

  const firstName = session.name.trim().split(/\s+/)[0]
  const page = view === 'summary'
    ? <Summary transactions={transactions} goals={goals} totals={totals} setView={setView} openModal={setModal} />
    : view === 'income' || view === 'expense'
      ? <TransactionsPage type={view} transactions={transactions} total={view === 'income' ? totals.income : totals.expense} openModal={setModal} onDelete={deleteTransaction} />
      : view === 'wishlist'
        ? <WishlistPage goals={goals} openModal={setModal} onDelete={deleteGoal} />
        : <SettingsPage theme={theme} setTheme={setTheme} background={background} setBackground={setBackground} onLogout={() => setSession(null)} onClear={() => { if (window.confirm('Hapus seluruh transaksi dan wishlist?')) { setTransactions([]); setGoals([]); setToast('Semua data keuangan dihapus') } }} />

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setView('summary')} aria-label="Arta, ke ringkasan">
          <span className="brand-mark"><ArrowUp size={22} weight="bold" /></span><span>Arta</span>
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
            <UserCircle size={38} weight="duotone" />
            <div><strong>{session.name}</strong><span>Data tersimpan lokal</span></div>
            <DotsThree size={22} />
          </div>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div><p className="eyebrow">{monthLabel.format(new Date())}</p><h1>{view === 'summary' ? `Selamat datang, ${firstName}` : title}</h1></div>
          <div className="header-actions">
            <button className="icon-button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label="Ganti tema">{theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}</button>
            <button className="icon-button notification" aria-label="Notifikasi"><Bell size={20} /></button>
            <button className="primary" onClick={() => setModal({ kind: 'transaction', type: view === 'expense' ? 'expense' : 'income' })}><Plus size={19} weight="bold" />Catat transaksi</button>
          </div>
        </header>

        <AnimatedPage key={view}>{page}</AnimatedPage>
      </main>

      <nav className="mobile-nav" aria-label="Navigasi mobile">
        {[nav[0], { id: 'income', label: 'Transaksi', icon: Receipt }, nav[3], nav[4]].map(({ id, label, icon: Icon }) => (
          <button key={id} className={view === id || (id === 'income' && view === 'expense') ? 'active' : ''} onClick={() => setView(id)}>
            <Icon size={22} weight={view === id ? 'fill' : 'regular'} /><span>{label}</span>
          </button>
        ))}
      </nav>

      {modal?.kind === 'transaction' && <TransactionModal initial={modal.item} defaultType={modal.type} onClose={() => setModal(null)} onSave={saveTransaction} />}
      {modal?.kind === 'goal' && <GoalModal initial={modal.item} onClose={() => setModal(null)} onSave={saveGoal} />}
      {modal?.kind === 'saving' && <SavingModal goal={modal.item} onClose={() => setModal(null)} onSave={addSaving} />}
      {toast && <div className="toast" role="status"><Check size={18} weight="bold" />{toast}</div>}
    </div>
  )
}

function Summary({ transactions, goals, totals, setView, openModal }) {
  const spentPercent = totals.income ? Math.min(Math.round((totals.expense / totals.income) * 100), 100) : 0
  const categories = useMemo(() => {
    const sums = transactions.filter(t => t.type === 'expense').reduce((acc, item) => ({ ...acc, [item.category]: (acc[item.category] || 0) + item.amount }), {})
    return Object.entries(sums).sort((a, b) => b[1] - a[1]).slice(0, 4)
  }, [transactions])
  return (
    <div className="dashboard-grid">
      <section className="balance-card">
        <div className="balance-main">
          <div className="balance-heading"><div><span className="section-icon"><Wallet size={20} weight="duotone" /></span><p>Sisa uang bulan ini</p></div><span className="month-chip"><CalendarBlank size={16} />{monthLabel.format(new Date())}</span></div>
          <strong className="balance-value">{rupiah.format(totals.balance)}</strong>
          <div className="hero-totals">
            <div><span className="semantic income"><TrendUp size={18} /></span><p>Pemasukan</p><strong>{rupiah.format(totals.income)}</strong></div>
            <div><span className="semantic expense"><TrendDown size={18} /></span><p>Pengeluaran</p><strong>{rupiah.format(totals.expense)}</strong></div>
          </div>
          <div className="budget-line"><span style={{ width: `${spentPercent}%` }} /></div><small>{spentPercent}% pemasukan sudah digunakan</small>
        </div>
        {categories.length === 0 ? <div className="balance-art" aria-hidden="true">
          <span className="orbit orbit-one" /><span className="orbit orbit-two" /><span className="orbit orbit-three" />
          <span className="leaf leaf-one" /><span className="leaf leaf-two" />
        </div> : <div className="chart-column">
          <div className="chart-head"><span><ChartDonut size={20} />Pengeluaran</span><button onClick={() => setView('expense')}>Detail</button></div>
          <div className="donut" style={{ '--angle': `${Math.min((categories[0][1] / totals.expense) * 360, 360)}deg` }}><span>{categories.length}</span></div><div className="legend">{categories.map(([name, value]) => <div key={name}><span>{name}</span><strong>{rupiah.format(value)}</strong></div>)}</div>
        </div>}
      </section>
      <div className="quick-actions">
        <button className="quick income" onClick={() => openModal({ kind: 'transaction', type: 'income' })}><span><ArrowDown size={23} /></span><div><strong>Pemasukan</strong><small>Tambah pemasukan</small></div></button>
        <button className="quick expense" onClick={() => openModal({ kind: 'transaction', type: 'expense' })}><span><ArrowUp size={23} /></span><div><strong>Pengeluaran</strong><small>Tambah pengeluaran</small></div></button>
      </div>
      <section className="panel transactions-panel"><PanelHeader title="Transaksi terbaru" action="Lihat semua" onClick={() => setView('income')} />{transactions.length ? <div className="transaction-list">{transactions.slice(0, 5).map(item => <TransactionRow key={item.id} item={item} />)}</div> : <EmptyState icon={BookOpen} title="Catatanmu masih kosong" text="Mulai dari satu transaksi kecil. Arta akan bantu merangkum sisanya." action="Mulai catat transaksi" onAction={() => openModal({ kind: 'transaction', type: 'expense' })} />}</section>
      <section className="panel wishlist-panel"><PanelHeader title="Wishlist" action="Lihat semua" onClick={() => setView('wishlist')} />{goals.length ? <div className="goal-list compact">{goals.slice(0, 2).map(goal => <GoalCard key={goal.id} goal={goal} compact onSaving={() => openModal({ kind: 'saving', item: goal })} />)}</div> : <EmptyState icon={Heart} title="Belum ada wishlist" text="Punya tujuan kecil atau besar? Simpan di sini dan lihat progresnya." action="Buat wishlist" onAction={() => openModal({ kind: 'goal' })} />}</section>
    </div>
  )
}

function TransactionsPage({ type, transactions, total, openModal, onDelete }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Semua kategori')
  const filtered = transactions.filter(item => item.type === type && (category === 'Semua kategori' || item.category === category) && `${item.title} ${item.category}`.toLowerCase().includes(query.toLowerCase()))
  const categories = [...new Set(transactions.filter(item => item.type === type).map(item => item.category))]
  return <div className="page-stack">
    <section className={`total-banner ${type}`}><div><p>Total {type === 'income' ? 'pemasukan' : 'pengeluaran'}</p><strong>{rupiah.format(total)}</strong><small>{transactions.filter(item => item.type === type).length} transaksi tercatat</small></div><span>{type === 'income' ? <TrendUp size={34} /> : <TrendDown size={34} />}</span></section>
    <section className="panel table-panel"><div className="list-toolbar"><div className="search"><MagnifyingGlass size={19} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari transaksi..." aria-label="Cari transaksi" /></div><div className="select-wrap"><select value={category} onChange={event => setCategory(event.target.value)} aria-label="Filter kategori"><option>Semua kategori</option>{categories.map(item => <option key={item}>{item}</option>)}</select><CaretDown size={16} /></div><button className="primary" onClick={() => openModal({ kind: 'transaction', type })}><Plus size={18} />Tambah</button></div>
      {filtered.length ? <div className="transaction-list detailed">{filtered.map(item => <TransactionRow key={item.id} item={item} actions onEdit={() => openModal({ kind: 'transaction', item, type })} onDelete={() => onDelete(item.id)} />)}</div> : <EmptyState icon={MagnifyingGlass} title="Tidak ada transaksi" text={query ? 'Coba kata kunci atau filter yang berbeda.' : 'Mulai dengan menambahkan transaksi baru.'} />}
    </section>
  </div>
}

function WishlistPage({ goals, openModal, onDelete }) {
  const totalTarget = goals.reduce((sum, goal) => sum + goal.target, 0)
  const totalSaved = goals.reduce((sum, goal) => sum + goal.saved, 0)
  return <div className="page-stack"><div className="wishlist-heading"><div><p>Total tabungan wishlist</p><strong>{rupiah.format(totalSaved)}</strong><span>dari target {rupiah.format(totalTarget)}</span></div><button className="primary" onClick={() => openModal({ kind: 'goal' })}><Plus size={18} />Tambah wishlist</button></div>
    {goals.length ? <div className="goals-grid">{goals.map(goal => <GoalCard key={goal.id} goal={goal} onSaving={() => openModal({ kind: 'saving', item: goal })} onEdit={() => openModal({ kind: 'goal', item: goal })} onDelete={() => onDelete(goal.id)} />)}</div> : <section className="panel"><EmptyState icon={Heart} title="Wishlist masih kosong" text="Tambahkan barang atau pengalaman yang ingin kamu wujudkan." action="Buat wishlist" onAction={() => openModal({ kind: 'goal' })} /></section>}
  </div>
}

function SettingsPage({ theme, setTheme, background, setBackground, onLogout, onClear }) {
  const presets = ['#f5f7f3', '#f2f5f8', '#f8f4ef', '#f6f1f7', '#eef7f5']
  return <div className="settings-grid">
    <div className="settings-content">
    <section className="panel settings-section">
      <div className="settings-icon"><Palette size={24} weight="duotone" /></div>
      <div><h2>Tampilan</h2><p>Sesuaikan aplikasi agar lebih nyaman dilihat.</p></div>
      <div className="setting-row"><div><strong>Mode warna</strong><span>Pilih tema terang atau gelap.</span></div><div className="theme-switch"><button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}><Sun size={17} />Terang</button><button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}><Moon size={17} />Gelap</button></div></div>
      <div className="setting-row background-setting"><div><strong>Warna background</strong><span>Pilih preset atau tentukan warna sendiri.</span></div><div className="color-options">{presets.map(color => <button key={color} className={background === color ? 'active' : ''} style={{ backgroundColor: color }} onClick={() => setBackground(color)} aria-label={`Pilih warna ${color}`} />)}<label className="custom-color" title="Pilih warna lain"><input type="color" value={background} onChange={event => setBackground(event.target.value)} /><Plus size={18} /></label></div></div>
    </section>
    <section className="panel settings-section">
      <div className="settings-icon"><ShieldCheck size={24} weight="duotone" /></div>
      <div><h2>Data dan sesi</h2><p>Kontrol data yang tersimpan pada browser ini.</p></div>
      <div className="setting-row"><div><strong>Hapus data keuangan</strong><span>Menghapus semua transaksi dan wishlist.</span></div><button className="danger-button" onClick={onClear}><Trash size={18} />Hapus data</button></div>
      <div className="setting-row"><div><strong>Keluar dari Arta</strong><span>Data keuangan tetap tersimpan setelah keluar.</span></div><button className="secondary" onClick={onLogout}><SignOut size={18} />Keluar</button></div>
    </section>
    </div>
    <aside className="settings-preview" style={{ backgroundColor: background }} aria-label="Preview warna background">
      <div className="preview-glow" /><div className="preview-brand"><span><ArrowUp size={16} weight="bold" /></span>Arta</div>
      <div className="preview-copy"><span>PREVIEW LANGSUNG</span><strong>Nyaman dilihat,<br />sesuai gayamu.</strong><p>Perubahan warna langsung diterapkan ke seluruh ruang kerja.</p></div>
      <div className="preview-window"><div className="preview-window-head"><i /><i /><i /></div><div className="preview-window-body"><span /><span /><span /></div></div>
    </aside>
  </div>
}

function LoginScreen({ onLogin }) {
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const submit = event => {
    event.preventDefault()
    if (!isValidLogin(name, pin)) return setError('Masukkan nama dan PIN 4 digit yang valid.')
    onLogin({ name: name.trim() })
  }
  return <main className="login-page">
    <section className="login-copy t-stagger is-shown"><button className="brand login-brand" type="button"><span className="brand-mark"><ArrowUp size={22} weight="bold" /></span><span>Arta</span></button><div className="login-rings" aria-hidden="true"><span /><span /><span /><span /></div><div><p className="login-kicker t-stagger-line t-stagger-line--1">Keuangan pribadi</p><h1 className="t-stagger-line t-stagger-line--2">Uang lebih tertata.<br />Hidup lebih tenang.</h1><p className="login-description t-stagger-line t-stagger-line--3">Ruang sederhana untuk memahami arus uang dan menjaga tujuanmu tetap dekat.</p></div><div className="login-foot"><ShieldCheck size={18} />Data tersimpan di browser perangkat ini</div></section>
    <section className="login-form-wrap"><form className="login-card" onSubmit={submit}><div className="login-avatar"><UserCircle size={34} weight="duotone" /></div><h2>Selamat datang</h2><p>Masuk untuk membuka catatan keuanganmu.</p><Field label="Nama"><input autoFocus autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder="Nama kamu" /></Field><Field label="PIN"><input type="password" inputMode="numeric" autoComplete="current-password" maxLength="4" value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, ''))} placeholder="4 digit PIN" /></Field>{error && <p className="form-error login-error">{error}</p>}<button className="primary login-submit">Masuk ke Arta <ArrowRight size={18} /></button><small>Login lokal sederhana—tidak mengirim data ke server.</small></form></section>
  </main>
}

function AnimatedPage({ children }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setOpen(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  return <div className="t-panel-slide view-transition" data-open={open}>{children}</div>
}

function PanelHeader({ title, action, onClick }) { return <div className="panel-head"><h2>{title}</h2><button onClick={onClick}>{action}</button></div> }

function TransactionRow({ item, actions, onEdit, onDelete }) {
  return <div className="transaction-row"><span className={`transaction-icon ${item.type}`}>{iconFor(item.category)}</span><div className="transaction-copy"><strong>{item.title}</strong><span>{item.category}{item.note ? ` • ${item.note}` : ''}</span></div><div className="transaction-value"><strong className={item.type}>{item.type === 'income' ? '+' : '-'}{rupiah.format(item.amount)}</strong><span>{dateLabel.format(new Date(`${item.date}T00:00:00`))}</span></div>{actions && <div className="row-actions"><button onClick={onEdit} aria-label="Edit transaksi"><PencilSimple size={18} /></button><button onClick={onDelete} aria-label="Hapus transaksi"><Trash size={18} /></button></div>}</div>
}

function GoalCard({ goal, compact, onSaving, onEdit, onDelete }) {
  const percent = Math.min(Math.round((goal.saved / goal.target) * 100), 100)
  const Icon = goal.icon === 'camera' ? Camera : Gift
  return <article className={`goal-card ${compact ? 'compact-card' : ''}`}><div className="goal-visual"><Icon size={compact ? 24 : 32} weight="duotone" /></div><div className="goal-content"><div className="goal-title"><div><h3>{goal.name}</h3><p>Target {rupiah.format(goal.target)}</p></div>{!compact && <div className="row-actions"><button onClick={onEdit} aria-label="Edit target"><PencilSimple size={18} /></button><button onClick={onDelete} aria-label="Hapus target"><Trash size={18} /></button></div>}</div><div className="progress"><span style={{ width: `${percent}%` }} /></div><div className="progress-label"><span>{rupiah.format(goal.saved)} terkumpul</span><strong>{percent}%</strong></div>{!compact && <div className="goal-footer"><span><CalendarBlank size={17} />{dateLabel.format(new Date(`${goal.deadline}T00:00:00`))}</span><button className="secondary" onClick={onSaving}>Tambah tabungan</button></div>}{compact && <button className="text-button" onClick={onSaving}>Tambah tabungan</button>}</div></article>
}

function ModalShell({ title, subtitle, onClose, children }) {
  useEffect(() => { const closeOnEscape = event => event.key === 'Escape' && onClose(); window.addEventListener('keydown', closeOnEscape); return () => window.removeEventListener('keydown', closeOnEscape) }, [onClose])
  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-head"><div><h2 id="modal-title">{title}</h2><p>{subtitle}</p></div><button className="icon-button" onClick={onClose} aria-label="Tutup"><X size={20} /></button></div>{children}</div></div>
}

function TransactionModal({ initial, defaultType, onClose, onSave }) {
  const [form, setForm] = useState(initial || { type: defaultType || 'expense', title: '', category: defaultType === 'income' ? 'Gaji' : 'Makan & Minum', amount: '', date: today, note: '' })
  const [error, setError] = useState('')
  const update = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const submit = event => { event.preventDefault(); if (!form.title.trim() || Number(form.amount) <= 0) return setError('Isi nama transaksi dan nominal yang valid.'); onSave({ ...form, title: form.title.trim(), amount: Number(form.amount) }) }
  const options = form.type === 'income' ? ['Gaji', 'Freelance', 'Bonus', 'Investasi', 'Lainnya'] : ['Makan & Minum', 'Belanja', 'Transportasi', 'Tagihan', 'Hiburan', 'Lainnya']
  return <ModalShell title={initial ? 'Ubah transaksi' : 'Catat transaksi'} subtitle="Simpan arus uangmu agar ringkasan tetap akurat." onClose={onClose}><form onSubmit={submit} className="form"><div className="type-switch"><button type="button" className={form.type === 'income' ? 'active' : ''} onClick={() => { update('type', 'income'); update('category', 'Gaji') }}><ArrowDown size={18} />Pemasukan</button><button type="button" className={form.type === 'expense' ? 'active' : ''} onClick={() => { update('type', 'expense'); update('category', 'Makan & Minum') }}><ArrowUp size={18} />Pengeluaran</button></div><Field label="Nama transaksi"><input autoFocus value={form.title} onChange={event => update('title', event.target.value)} placeholder="Nama transaksi" /></Field><Field label="Nominal"><div className="money-input"><span>Rp</span><input type="number" min="1" value={form.amount} onChange={event => update('amount', event.target.value)} placeholder="0" /></div></Field><div className="form-grid"><Field label="Kategori"><select value={form.category} onChange={event => update('category', event.target.value)}>{options.map(item => <option key={item}>{item}</option>)}</select></Field><Field label="Tanggal"><input type="date" value={form.date} onChange={event => update('date', event.target.value)} /></Field></div><Field label="Catatan (opsional)"><input value={form.note} onChange={event => update('note', event.target.value)} placeholder="Tambahkan detail singkat" /></Field>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Batal</button><button className="primary" type="submit">{initial ? 'Simpan perubahan' : 'Simpan transaksi'}</button></div></form></ModalShell>
}

function GoalModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState(initial || { name: '', target: '', saved: 0, deadline: today, icon: 'gift' })
  const [error, setError] = useState('')
  const update = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const submit = event => { event.preventDefault(); if (!form.name.trim() || Number(form.target) <= 0) return setError('Isi nama wishlist dan target yang valid.'); onSave({ ...form, name: form.name.trim(), target: Number(form.target), saved: Number(form.saved) }) }
  return <ModalShell title={initial ? 'Ubah wishlist' : 'Tambah wishlist'} subtitle="Tentukan tujuan yang ingin kamu capai." onClose={onClose}><form className="form" onSubmit={submit}><Field label="Nama wishlist"><input autoFocus value={form.name} onChange={event => update('name', event.target.value)} placeholder="Nama target" /></Field><div className="form-grid"><Field label="Target dana"><div className="money-input"><span>Rp</span><input type="number" min="1" value={form.target} onChange={event => update('target', event.target.value)} placeholder="0" /></div></Field><Field label="Sudah terkumpul"><div className="money-input"><span>Rp</span><input type="number" min="0" value={form.saved} onChange={event => update('saved', event.target.value)} /></div></Field></div><Field label="Target tercapai"><input type="date" value={form.deadline} onChange={event => update('deadline', event.target.value)} /></Field>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Batal</button><button className="primary">Simpan wishlist</button></div></form></ModalShell>
}

function SavingModal({ goal, onClose, onSave }) {
  const [amount, setAmount] = useState('')
  const remaining = Math.max(goal.target - goal.saved, 0)
  return <ModalShell title="Tambah tabungan" subtitle={`Untuk ${goal.name}`} onClose={onClose}><form className="form" onSubmit={event => { event.preventDefault(); Number(amount) > 0 && onSave(goal.id, Number(amount)) }}><div className="saving-summary"><span>Sisa target</span><strong>{rupiah.format(remaining)}</strong></div><Field label="Nominal tabungan"><div className="money-input"><span>Rp</span><input autoFocus type="number" min="1" max={remaining} value={amount} onChange={event => setAmount(event.target.value)} placeholder="0" /></div></Field><div className="quick-amounts">{[100000, 250000, 500000].map(value => <button type="button" key={value} onClick={() => setAmount(value)}>+{rupiah.format(value)}</button>)}</div><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Batal</button><button className="primary">Tambahkan</button></div></form></ModalShell>
}

function Field({ label, children }) { return <label className="field"><span>{label}</span>{children}</label> }
function EmptyCompact({ text }) { return <div className="empty-compact"><Receipt size={28} /><span>{text}</span></div> }
function EmptyState({ icon: Icon, title, text, action, onAction }) { return <div className="empty-state"><span><Icon size={30} /></span><h3>{title}</h3><p>{text}</p>{action && <button className="primary" onClick={onAction}>{action}</button>}</div> }
