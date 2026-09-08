import { useEffect, useState } from 'react'
import './App.css'
import { addFarmEntity, getFarmSummary, withFarmRecord } from './domain/farm'
import { authenticate, getCurrentUser, loadFarmState, loadFarmStateFromApi, logout, saveFarmState, saveFarmStateToApi } from './storage/farmStorage'

const navItems = [
  { label: 'Overview', icon: '↗' },
  { label: 'Flocks', icon: '◌' },
  { label: 'Inventory', icon: '▥' },
  { label: 'Finances', icon: '₦' },
  { label: 'Reports', icon: '▤' },
]

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      const user = await authenticate(mode, { name: form.get('name'), email: form.get('email'), password: form.get('password') })
      onAuthenticated(user)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return <main className="auth-shell"><div className="auth-card"><div className="auth-brand"><span className="brand-mark">P</span><strong>PoultryPro</strong></div><p className="eyebrow">Farm management workspace</p><h1>{mode === 'login' ? 'Welcome back' : 'Create your farm account'}</h1><p className="auth-copy">Manage your flocks, inventory, finances, and daily farm records in one place.</p><div className="auth-tabs"><button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Sign in</button><button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Create account</button></div><form onSubmit={submit}>{mode === 'register' && <label>Your name<input name="name" placeholder="Abdulkadir Muhammad" required /></label>}<label>Email address<input name="email" type="email" placeholder="you@example.com" required /></label><label>Password<input name="password" type="password" placeholder="At least 6 characters" minLength="6" required /></label>{error && <p className="auth-error">{error}</p>}<button className="primary-button auth-submit" disabled={busy}>{busy ? 'Please wait...' : mode === 'login' ? 'Sign in to farm' : 'Create farm account'}</button></form><small className="auth-note">Your farm data is private to your account.</small></div></main>
}

function ManagementView({ activeNav, onAddRecord, farm, query, highlightMatches }) {
  const { flocks: flockRows, inventory: inventoryRows, finances: financeRows } = farm
  const filteredFlocks = flockRows.filter((flock) => !query || [flock.name, flock.type, flock.age, flock.health].some((field) => String(field).toLowerCase().includes(query)))
  const filteredInventory = inventoryRows.filter((item) => !query || [item.item, item.category, item.quantity, item.level].some((field) => String(field).toLowerCase().includes(query)))
  const filteredFinance = financeRows.filter((transaction) => !query || [transaction.description, transaction.type, transaction.amount].some((field) => String(field).toLowerCase().includes(query)))

  if (activeNav === 'Flocks') {
    return <section className="management-view"><div className="management-header"><div><p className="eyebrow">Production management</p><h2>Flocks</h2><p>Monitor every house, flock age, and health status from one place.</p></div><button type="button" className="primary-button" onClick={onAddRecord}><span>＋</span> Add flock</button></div><div className="management-stats"><div><span>Active houses</span><strong>3</strong></div><div><span>Total birds</span><strong>5,650</strong></div><div><span>Average mortality</span><strong>2.1%</strong></div><div><span>Next vaccination</span><strong>Sep 12</strong></div></div><article className="panel management-table"><div className="panel-heading"><div><h2>All active flocks</h2><p>Updated from the latest health checks</p></div><button type="button" className="select-button">All flock types <span>⌄</span></button></div><div className="table-wrap"><table><thead><tr><th>HOUSE</th><th>TYPE</th><th>AGE</th><th>BIRDS</th><th>HEALTH</th><th>LAST CHECK</th><th /></tr></thead><tbody>{filteredFlocks.length ? filteredFlocks.map((flock) => <tr key={flock.name}><td><span className="house-dot" />{highlightMatches(flock.name)}</td><td>{highlightMatches(flock.type)}</td><td>{highlightMatches(flock.age)}</td><td><strong>{flock.birds}</strong></td><td><span className={`health-pill ${flock.tone}`}>● {highlightMatches(flock.health)}</span></td><td>Today, 08:30</td><td><button type="button" className="row-menu" aria-label={`Open ${flock.name} menu`}>•••</button></td></tr>) : <tr><td colSpan="7"><div className="empty-state table-empty">No flocks match your search.</div></td></tr>}</tbody></table></div></article></section>
  }

  if (activeNav === 'Inventory') {
    return <section className="management-view"><div className="management-header"><div><p className="eyebrow">Stock control</p><h2>Inventory</h2><p>Know what is available before the next feeding, treatment, or collection.</p></div><button type="button" className="primary-button" onClick={onAddRecord}><span>＋</span> Add stock</button></div><div className="management-stats"><div><span>Tracked items</span><strong>24</strong></div><div><span>Feed on hand</span><strong>2.4t</strong></div><div><span>Low stock items</span><strong className="attention-text">2</strong></div><div><span>Stock value</span><strong>₦1.18m</strong></div></div><article className="panel management-table"><div className="panel-heading"><div><h2>Current inventory</h2><p>Feed, medication, and farm supplies</p></div><button type="button" className="select-button">All categories <span>⌄</span></button></div><div className="table-wrap"><table><thead><tr><th>ITEM</th><th>CATEGORY</th><th>QUANTITY</th><th>STATUS</th><th>LAST UPDATED</th><th /></tr></thead><tbody>{filteredInventory.length ? filteredInventory.map((item) => <tr key={item.item}><td><span className="inventory-dot" />{highlightMatches(item.item)}</td><td>{highlightMatches(item.category)}</td><td><strong>{highlightMatches(item.quantity)}</strong></td><td><span className={`health-pill ${item.tone}`}>● {highlightMatches(item.level)}</span></td><td>{highlightMatches(item.updated)}</td><td><button type="button" className="row-menu" aria-label={`Open ${item.item} menu`}>•••</button></td></tr>) : <tr><td colSpan="6"><div className="empty-state table-empty">No inventory item matches your search.</div></td></tr>}</tbody></table></div></article></section>
  }

  if (activeNav === 'Finances') {
    return <section className="management-view"><div className="management-header"><div><p className="eyebrow">Farm accounting</p><h2>Finances</h2><p>Track income, operating costs, and the health of your farm business.</p></div><button type="button" className="primary-button" onClick={onAddRecord}><span>＋</span> Add transaction</button></div><div className="management-stats"><div><span>Revenue this month</span><strong>₦2.84m</strong></div><div><span>Operating costs</span><strong>₦1.16m</strong></div><div><span>Net profit</span><strong className="income-text">₦1.68m</strong></div><div><span>Profit margin</span><strong>59.2%</strong></div></div><article className="panel management-table"><div className="panel-heading"><div><h2>Recent transactions</h2><p>Income and expenses recorded for Ogun Green Farm</p></div><button type="button" className="select-button">This month <span>⌄</span></button></div><div className="table-wrap"><table><thead><tr><th>DESCRIPTION</th><th>TYPE</th><th>AMOUNT</th><th>DATE</th><th /></tr></thead><tbody>{filteredFinance.length ? filteredFinance.map((transaction) => <tr key={transaction.description}><td><span className="transaction-dot" />{highlightMatches(transaction.description)}</td><td>{highlightMatches(transaction.type)}</td><td><strong className={transaction.tone === 'income' ? 'income-text' : 'expense-text'}>{highlightMatches(transaction.amount)}</strong></td><td>{highlightMatches(transaction.date)}</td><td><button type="button" className="row-menu" aria-label={`Open ${transaction.description} menu`}>•••</button></td></tr>) : <tr><td colSpan="5"><div className="empty-state table-empty">No financial records match your search.</div></td></tr>}</tbody></table></div></article></section>
  }

  return <section className="management-view"><div className="management-header"><div><p className="eyebrow">Farm intelligence</p><h2>Reports</h2><p>Turn your farm records into decisions you can act on.</p></div><button type="button" className="primary-button" onClick={onAddRecord}><span>↓</span> Export report</button></div>{query ? <div className="empty-state">No report cards match your search. Try a broader keyword.</div> : <><div className="report-grid"><article className="panel report-card"><span className="report-icon green-bg">▤</span><h3>Flock health report</h3><p>Mortality, vaccination, and health observations across all houses.</p><button type="button" className="text-button">Open report <span>→</span></button></article><article className="panel report-card"><span className="report-icon amber-bg">₦</span><h3>Profitability report</h3><p>Compare sales, feed costs, and margins by flock and production cycle.</p><button type="button" className="text-button">Open report <span>→</span></button></article><article className="panel report-card"><span className="report-icon blue-bg">◌</span><h3>Production report</h3><p>Review eggs, bird growth, feed conversion, and daily farm output.</p><button type="button" className="text-button">Open report <span>→</span></button></article></div><article className="panel report-preview"><div className="panel-heading"><div><h2>Monthly farm health</h2><p>Performance summary for August 2026</p></div><span className="health-pill good">● On track</span></div><div className="report-bars"><div><span>Flock health</span><i><b style={{ width: '88%' }} /></i><strong>88%</strong></div><div><span>Feed efficiency</span><i><b style={{ width: '74%' }} /></i><strong>74%</strong></div><div><span>Egg production</span><i><b style={{ width: '83%' }} /></i><strong>83%</strong></div><div><span>Profit target</span><i><b style={{ width: '91%' }} /></i><strong>91%</strong></div></div></article></>}</section>
}

function App() {
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [activeNav, setActiveNav] = useState('Overview')
  const [farm, setFarm] = useState(loadFarmState)
  const [showRecordForm, setShowRecordForm] = useState(false)
  const [recordSaved, setRecordSaved] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [utilityPanel, setUtilityPanel] = useState(null)
  const [recordContext, setRecordContext] = useState('record')
  const [settingsDraft, setSettingsDraft] = useState({ name: farm.farm.name, location: farm.farm.location, manager: farm.farm.manager })
  const [isHydrated, setIsHydrated] = useState(false)
  const [storageMode, setStorageMode] = useState('local')
  const summary = getFarmSummary(farm)
  const currentDate = new Date()
  const formatDateLabel = (date) => date.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const formatCompactCurrency = (value) => {
    if (value >= 1000000) return `₦${(value / 1000000).toFixed(2).replace(/\.00$/, '')}m`
    if (value >= 1000) return `₦${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`
    return `₦${value.toLocaleString('en-NG')}`
  }
  const greeting = currentDate.getHours() < 12 ? 'Good morning' : currentDate.getHours() < 18 ? 'Good afternoon' : 'Good evening'
  const dateLabel = formatDateLabel(currentDate)
  const query = searchTerm.trim().toLowerCase()
  const farmName = farm.farm?.name || 'Ogun Green Farm'
  const farmLocation = farm.farm?.location || 'Ogun State, Nigeria'
  const highlightMatches = (value) => {
    if (!query) return value
    const pattern = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig')
    return String(value).split(pattern).map((part) => {
      if (part.toLowerCase() === query) {
        return <mark key={`${value}-${part}-${Math.random()}`}>{part}</mark>
      }
      return part
    })
  }
  const visibleTasks = farm.tasks.filter((task) => !query || [task.title, task.meta].some((field) => String(field).toLowerCase().includes(query)))
  const visibleFlocks = farm.flocks.filter((flock) => !query || [flock.name, flock.type, flock.age, flock.health].some((field) => String(field).toLowerCase().includes(query)))
  const visibleInventory = farm.inventory.filter((item) => !query || [item.item, item.category, item.quantity, item.level].some((field) => String(field).toLowerCase().includes(query)))
  const visibleFinances = farm.finances.filter((transaction) => !query || [transaction.description, transaction.type, transaction.amount].some((field) => String(field).toLowerCase().includes(query)))
  const visibleActivities = farm.activities.filter((activity) => !query || [activity.title, activity.detail, activity.time].some((field) => String(field).toLowerCase().includes(query)))
  const searchMatchCount = visibleTasks.length + visibleFlocks.length + visibleInventory.length + visibleFinances.length + visibleActivities.length
  const openRecordForm = () => {
    const contextBySection = { Flocks: 'flock', Inventory: 'inventory', Finances: 'finance' }
    setRecordContext(contextBySection[activeNav] || 'record')
    setShowRecordForm(true)
  }

  const openSettingsPanel = () => {
    setSettingsDraft({
      name: farm.farm.name,
      location: farm.farm.location,
      manager: farm.farm.manager,
    })
    setUtilityPanel('Settings')
  }

  useEffect(() => {
    let isMounted = true
    getCurrentUser().then((currentUser) => {
      if (!isMounted) return
      setUser(currentUser)
      if (!currentUser) return setAuthReady(true)
      return loadFarmStateFromApi().then((remoteFarm) => {
        if (!isMounted) return
        setFarm(remoteFarm)
        setStorageMode('api')
        setIsHydrated(true)
        setAuthReady(true)
      })
    }).catch(() => { if (isMounted) setAuthReady(true) })

    return () => { isMounted = false }
  }, [])

  useEffect(() => {
    if (!isHydrated) return
    saveFarmState(farm)
    saveFarmStateToApi(farm).then(() => setStorageMode('api')).catch(() => setStorageMode('local'))
  }, [farm, isHydrated])

  const handleAuthenticated = (authenticatedUser) => {
    setUser(authenticatedUser)
    setAuthReady(true)
    setIsHydrated(false)
    loadFarmStateFromApi().then((remoteFarm) => {
      setFarm(remoteFarm)
      setStorageMode('api')
      setIsHydrated(true)
    }).catch(() => {
      setIsHydrated(true)
      setStorageMode('local')
    })
  }

  const handleSettingsSubmit = (event) => {
    event.preventDefault()
    setFarm((current) => ({
      ...current,
      farm: {
        ...current.farm,
        name: settingsDraft.name.trim() || current.farm.name,
        location: settingsDraft.location.trim() || current.farm.location,
        manager: settingsDraft.manager.trim() || current.farm.manager,
      },
    }))
    setUtilityPanel(null)
  }

  if (!authReady) return <div className="loading-screen">Loading your farm workspace...</div>
  if (!user) return <AuthScreen onAuthenticated={handleAuthenticated} />

  const toggleTask = (id) => {
    setFarm((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (
        task.id === id ? { ...task, done: !task.done } : task
      )),
    }))
  }

  const handleRecordSubmit = (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const detail = form.get('details')
    const values = Object.fromEntries(form.entries())
    setFarm((current) => recordContext === 'record'
      ? withFarmRecord(current, { id: `activity-${Date.now()}`, title: `${form.get('recordType')} record added`, detail: detail || 'A new farm record was saved', time: 'Just now', tone: 'green' })
      : addFarmEntity(current, recordContext, values))
    setRecordSaved(true)
    setTimeout(() => {
      setShowRecordForm(false)
      setRecordSaved(false)
    }, 900)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">P</div>
          <div><strong>PoultryPro</strong><span>Farm management</span></div>
        </div>
        <div className="farm-switcher">
          <span className="farm-avatar">{farmName.slice(0, 2).toUpperCase()}</span>
          <div><strong>{farmName}</strong><span>{farmLocation}</span></div>
          <span className="chevron">⌄</span>
        </div>
        <nav className="sidebar-nav" aria-label="Farm sections">
          <p className="nav-label">Workspace</p>
          {navItems.map((item) => (
            <button type="button" key={item.label} className={activeNav === item.label ? 'nav-item active' : 'nav-item'} onClick={() => setActiveNav(item.label)}>
              <span className="nav-icon">{item.icon}</span>{item.label}{item.label === 'Flocks' && <span className="nav-count">3</span>}
            </button>
          ))}
          <p className="nav-label nav-label-spaced">Manage</p>
          <button type="button" className="nav-item" onClick={openSettingsPanel}><span className="nav-icon">⚙</span>Settings</button>
          <button type="button" className="nav-item" onClick={() => setUtilityPanel('Help center')}><span className="nav-icon">?</span>Help center</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="upgrade-note"><span className="spark">✦</span><strong>Farm health is up 12%</strong><p>Keep your records updated to see clearer trends.</p></div>
          <button type="button" className="user-profile" onClick={() => { logout(); setUser(null) }}><span className="profile-avatar">{user.name.slice(0, 2).toUpperCase()}</span><div><strong>{user.name}</strong><span>{user.email}</span></div><span className="more">↪</span></button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><b>/</b><strong>{activeNav}</strong></div>
          <div className="top-actions">{showSearch && <div className="search-field"><input className="quick-search" autoFocus type="search" placeholder="Search farm records" aria-label="Search farm records" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} onBlur={() => setShowSearch(false)} /><button type="button" className="search-clear" aria-label="Clear search" onMouseDown={(event) => event.preventDefault()} onClick={() => setSearchTerm('')}>×</button></div>}<button type="button" className="icon-button" aria-label="Search" onClick={() => setShowSearch(true)}>⌕</button><button type="button" className="icon-button notification" aria-label="Notifications" onClick={() => setUtilityPanel('Notifications')}>♢<i /></button><div className="date-chip">{dateLabel} <span>⌄</span></div></div>
        </header>
        <div className="content-wrap">
          {query && <div className="search-banner">{searchMatchCount} matching record{searchMatchCount === 1 ? '' : 's'} for “{searchTerm}”</div>}
          <section className="page-heading"><div><p className="eyebrow">{dateLabel}</p><h1>{greeting}, {user.name.split(' ')[0]} <span>✦</span></h1><p className="heading-copy">Here is what is happening across {farmName} today. <span className="storage-status">{storageMode === 'api' ? 'Synced' : 'Offline mode'}</span></p></div><button type="button" className="primary-button" onClick={openRecordForm}><span>＋</span> Add record</button></section>
          {activeNav === 'Overview' ? <>
          <section className="stats-grid" aria-label="Farm summary">
            <article className="stat-card accent-green"><div className="stat-icon">◌</div><span className="stat-label">Total birds</span><strong>{summary.totalBirds.toLocaleString()}</strong><small className="positive">↑ 4.8% <em>vs last month</em></small><div className="sparkline green-line"><i /><i /><i /><i /><i /><i /><i /></div></article>
            <article className="stat-card accent-amber"><div className="stat-icon">▦</div><span className="stat-label">Eggs collected</span><strong>{summary.eggsCollected.toLocaleString()} <small>/ {summary.eggTarget.toLocaleString()}</small></strong><small className="positive">↑ 8.2% <em>vs yesterday</em></small><div className="progress-track"><span style={{ width: `${Math.min(100, (summary.eggsCollected / summary.eggTarget) * 100)}%` }} /></div></article>
            <article className="stat-card accent-blue"><div className="stat-icon">◒</div><span className="stat-label">Feed stock</span><strong>{summary.feedStockTons.toFixed(1)} <small>tons</small></strong><small className="warning">● {summary.feedDaysRemaining} days remaining</small><div className="progress-track blue-track"><span style={{ width: `${Math.min(100, (summary.feedStockTons / 4.5) * 100)}%` }} /></div></article>
            <article className="stat-card accent-coral"><div className="stat-icon">₦</div><span className="stat-label">This month’s revenue</span><strong>{formatCompactCurrency(summary.totalRevenue)}</strong><small className="positive">↑ 14.6% <em>vs last month</em></small><div className="sparkline coral-line"><i /><i /><i /><i /><i /><i /><i /></div></article>
          </section>

          <section className="dashboard-grid">
            <article className="panel performance-panel"><div className="panel-heading"><div><h2>Flock performance</h2><p>Bird count and mortality across your houses</p></div><button type="button" className="select-button">Last 30 days <span>⌄</span></button></div><div className="chart-legend"><span><i className="legend-green" /> Live birds</span><span><i className="legend-coral" /> Mortality</span></div><div className="chart-area"><div className="y-axis"><span>6k</span><span>4k</span><span>2k</span><span>0</span></div><div className="chart-content"><div className="grid-lines"><i /><i /><i /><i /></div><svg viewBox="0 0 700 220" preserveAspectRatio="none" aria-label="Flock performance chart"><path className="area-fill" d="M0,142 C50,138 65,105 116,118 S168,137 220,98 S268,72 320,96 S367,122 420,75 S472,101 520,54 S580,57 620,35 S670,47 700,20 L700,220 L0,220 Z" /><path className="chart-line" d="M0,142 C50,138 65,105 116,118 S168,137 220,98 S268,72 320,96 S367,122 420,75 S472,101 520,54 S580,57 620,35 S670,47 700,20" /><path className="mortality-line" d="M0,190 C70,192 88,178 145,184 S218,176 275,185 S350,174 410,181 S495,170 550,177 S630,168 700,172" /></svg><div className="x-axis"><span>Aug 10</span><span>Aug 15</span><span>Aug 20</span><span>Aug 25</span><span>Aug 30</span><span>Sep 05</span><span>Sep 08</span></div></div></div></article>
            <article className="panel tasks-panel"><div className="panel-heading"><div><h2>Today’s tasks</h2><p>{summary.completedTasks} of {farm.tasks.length} completed</p></div><button type="button" className="round-add" onClick={openRecordForm}>＋</button></div><div className="task-list">{visibleTasks.length ? visibleTasks.map((task) => <button type="button" key={task.id} className={task.done ? 'task done' : 'task'} onClick={() => toggleTask(task.id)}><span className="checkmark">{task.done ? '✓' : ''}</span><span><strong>{highlightMatches(task.title)}</strong><small>{highlightMatches(task.meta)}</small></span><span className="task-menu">•••</span></button>) : <div className="empty-state">No tasks match your search.</div>}</div><button type="button" className="view-all">View all tasks <span>→</span></button></article>
          </section>

          <section className="lower-grid">
            <article className="panel flock-panel"><div className="panel-heading"><div><h2>Flock overview</h2><p>Health and production snapshot by house</p></div><button type="button" className="text-button" onClick={() => setActiveNav('Flocks')}>Manage flocks <span>→</span></button></div><div className="table-wrap"><table><thead><tr><th>HOUSE</th><th>TYPE</th><th>AGE</th><th>BIRDS</th><th>HEALTH</th><th /></tr></thead><tbody>{visibleFlocks.length ? visibleFlocks.map((flock) => <tr key={flock.id}><td><span className="house-dot" />{highlightMatches(flock.name)}</td><td>{highlightMatches(flock.type)}</td><td>{highlightMatches(flock.age)}</td><td><strong>{flock.birds.toLocaleString()}</strong></td><td><span className={`health-pill ${flock.tone}`}>● {highlightMatches(flock.health)}</span></td><td><button type="button" className="row-menu" aria-label={`Open ${flock.name} menu`}>•••</button></td></tr>) : <tr><td colSpan="6"><div className="empty-state table-empty">No flocks match your search.</div></td></tr>}</tbody></table></div></article>
            <article className="panel activity-panel"><div className="panel-heading"><div><h2>Recent activity</h2><p>Latest updates from your team</p></div><button type="button" className="more-button">•••</button></div><div className="activity-list">{visibleActivities.length ? visibleActivities.slice(0, 3).map((activity) => <div className="activity-item" key={activity.id}><span className={`activity-icon ${activity.tone}-bg`}>{activity.tone === 'amber' ? '▦' : activity.tone === 'blue' ? '◌' : '✓'}</span><p><strong>{highlightMatches(activity.title)}</strong><span>{highlightMatches(activity.detail)}</span><small>{highlightMatches(activity.time)}</small></p></div>) : <div className="empty-state">No recent activity matches your search.</div>}</div><button type="button" className="view-all">View activity log <span>→</span></button></article>
          </section>
          </> : <ManagementView activeNav={activeNav} onAddRecord={openRecordForm} farm={farm} query={query} highlightMatches={highlightMatches} />}
        </div>
      </main>

      {showRecordForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowRecordForm(false)}><form className="record-modal" onSubmit={handleRecordSubmit}><div className="modal-header"><div><p className="eyebrow">Farm records</p><h2>{recordContext === 'flock' ? 'Add flock' : recordContext === 'inventory' ? 'Add stock' : recordContext === 'finance' ? 'Add transaction' : 'Add a record'}</h2></div><button type="button" className="close-button" onClick={() => setShowRecordForm(false)} aria-label="Close">×</button></div>{recordContext === 'flock' && <><label>House name<input name="name" placeholder="e.g. House C" required /></label><label>Bird type<select name="type" defaultValue="Broilers"><option>Broilers</option><option>Layers</option><option>Breeders</option></select></label><label>Bird count<input name="birds" type="number" min="1" placeholder="e.g. 1500" required /></label><label>Flock age<input name="age" placeholder="e.g. 1 day" required /></label></>}{recordContext === 'inventory' && <><label>Item name<input name="item" placeholder="e.g. Grower feed" required /></label><label>Category<select name="category" defaultValue="Feed"><option>Feed</option><option>Medication</option><option>Supplies</option></select></label><label>Quantity<input name="quantity" placeholder="e.g. 500 kg" required /></label></>}{recordContext === 'finance' && <><label>Description<input name="description" placeholder="e.g. Egg sales" required /></label><label>Type<select name="type" defaultValue="Income"><option>Income</option><option>Expense</option></select></label><label>Amount<input name="amount" type="number" min="0" placeholder="e.g. 250000" required /></label></>}{recordContext === 'record' && <><label>Record type<select name="recordType" defaultValue="Flock health"><option>Flock health</option><option>Feed inventory</option><option>Egg collection</option><option>Expense</option></select></label><label>Details<input name="details" type="text" placeholder="e.g. House A health check" required /></label><label>Notes<textarea name="notes" rows="3" placeholder="Add an optional note" /></label></>}<button className="primary-button" type="submit">{recordSaved ? 'Record saved' : 'Save record'}</button></form></div>}
      {utilityPanel && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setUtilityPanel(null)}><section className="record-modal utility-modal"><div className="modal-header"><div><p className="eyebrow">PoultryPro</p><h2>{utilityPanel}</h2></div><button type="button" className="close-button" onClick={() => setUtilityPanel(null)} aria-label="Close">×</button></div>{utilityPanel === 'Settings' && <form onSubmit={handleSettingsSubmit}><div className="utility-field"><label>Farm name<input value={settingsDraft.name} onChange={(event) => setSettingsDraft((current) => ({ ...current, name: event.target.value }))} /></label></div><div className="utility-field"><label>Location<input value={settingsDraft.location} onChange={(event) => setSettingsDraft((current) => ({ ...current, location: event.target.value }))} /></label></div><div className="utility-field"><label>Manager<input value={settingsDraft.manager} onChange={(event) => setSettingsDraft((current) => ({ ...current, manager: event.target.value }))} /></label></div><button type="submit" className="primary-button">Save settings</button></form>}{utilityPanel === 'Help center' && <><p className="utility-copy">Need help? Start with the farm records, flock health, and inventory views. Each summary is designed for a quick daily check.</p><button type="button" className="primary-button" onClick={() => setUtilityPanel(null)}>Close help</button></>}{utilityPanel === 'Notifications' && <><p className="utility-copy">House B needs attention: the latest flock check flagged a health follow-up.</p><button type="button" className="primary-button" onClick={() => { setUtilityPanel(null); setActiveNav('Flocks') }}>Review flock</button></>}</section></div>}
    </div>
  )
}

export default App
