export const FARM_STORAGE_KEY = 'poultrypro:farm:v1'

export const initialFarmState = {
  farm: {
    id: 'ogun-green-farm',
    name: 'Ogun Green Farm',
    location: 'Ogun State, Nigeria',
    manager: 'Abdulkadir M.',
  },
  tasks: [],
  flocks: [],
  inventory: [],
  finances: [],
  activities: [],
}

export function cloneInitialFarmState() {
  return structuredClone(initialFarmState)
}

export function withFarmRecord(state, record) {
  return {
    ...state,
    activities: [record, ...state.activities].slice(0, 12),
  }
}

export function addFarmEntity(state, entityType, values) {
  const id = `${entityType}-${Date.now()}`
  const details = values.details || 'New farm record'
  const activity = {
    id: `activity-${Date.now()}`,
    title: `${entityType[0].toUpperCase()}${entityType.slice(1)} added`,
    detail: values.name || values.item || values.description || values.details || 'A new farm record was created',
    time: 'Just now',
    tone: 'green',
  }

  if (entityType === 'flock') {
    return { ...state, flocks: [{ id, name: values.name || details, type: values.type || 'Broilers', age: values.age || 'New', birds: Number(values.birds) || 0, tone: 'good', health: 'Good', lastCheck: 'Not checked' }, ...state.flocks], activities: [activity, ...state.activities] }
  }

  if (entityType === 'inventory') {
    return { ...state, inventory: [{ id, item: values.item || details, category: values.category || 'Supplies', quantity: values.quantity || 'New', level: 'Healthy', tone: 'good', updated: 'Just now' }, ...state.inventory], activities: [activity, ...state.activities] }
  }

  return { ...state, finances: [{ id, description: values.description || details, type: values.type || 'Income', amount: `${values.type === 'Expense' ? '-' : '+'} ₦${Number(values.amount || 0).toLocaleString()}`, tone: values.type === 'Expense' ? 'expense' : 'income', date: 'Sep 08, 2026' }, ...state.finances], activities: [activity, ...state.activities] }
}

export function updateFarmEntity(state, entityType, id, values) {
  const collection = entityType === 'flock' ? 'flocks' : entityType === 'inventory' ? 'inventory' : 'finances'
  const current = state[collection].find((entry) => entry.id === id)
  if (!current) return state

  const updated = entityType === 'flock'
    ? { ...current, name: values.name || current.name, type: values.type || current.type, age: values.age || current.age, birds: Number(values.birds) || current.birds }
    : entityType === 'inventory'
      ? { ...current, item: values.item || current.item, category: values.category || current.category, quantity: values.quantity || current.quantity }
      : { ...current, description: values.description || current.description, type: values.type || current.type, amount: `${values.type === 'Expense' ? '-' : '+'} ₦${Number(values.amount || 0).toLocaleString()}`, tone: values.type === 'Expense' ? 'expense' : 'income' }

  return { ...state, [collection]: state[collection].map((entry) => entry.id === id ? updated : entry) }
}

export function deleteFarmEntity(state, entityType, id) {
  const collection = entityType === 'flock' ? 'flocks' : entityType === 'inventory' ? 'inventory' : 'finances'
  return { ...state, [collection]: state[collection].filter((entry) => entry.id !== id) }
}

function parseCurrency(value) {
  const normalized = String(value || '').replace(/[^\d.-]/g, '')
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseQuantity(value) {
  const normalized = String(value || '').toLowerCase()
  const match = normalized.match(/([0-9]+(?:\.[0-9]+)?)/)
  const parsed = Number(match?.[1] || 0)
  const isTons = normalized.includes('ton') || normalized.includes('t')
  return isTons ? parsed : parsed / 1000
}

export function getFarmSummary(state) {
  const totalBirds = state.flocks.reduce((total, flock) => total + Number(flock.birds || 0), 0)
  const totalRevenue = state.finances
    .filter((entry) => entry.tone === 'income')
    .reduce((total, entry) => total + parseCurrency(entry.amount), 0)
  const totalExpenses = state.finances
    .filter((entry) => entry.tone === 'expense')
    .reduce((total, entry) => total + parseCurrency(entry.amount), 0)
  const feedStockTons = state.inventory
    .filter((item) => item.category === 'Feed')
    .reduce((total, item) => total + parseQuantity(item.quantity), 0)
  const eggsCollected = 0
  const eggTarget = 0
  const feedDaysRemaining = totalBirds > 0 && feedStockTons > 0
    ? Math.round((feedStockTons * 30) / Math.max(1, totalBirds / 1400))
    : 0

  return {
    totalBirds,
    activeHouses: state.flocks.length,
    lowStockItems: state.inventory.filter((item) => item.tone === 'attention').length,
    completedTasks: state.tasks.filter((task) => task.done).length,
    totalRevenue,
    totalExpenses,
    netProfit: totalRevenue - totalExpenses,
    feedStockTons,
    eggsCollected,
    eggTarget,
    feedDaysRemaining,
  }
}
