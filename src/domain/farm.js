export const FARM_STORAGE_KEY = 'poultrypro:farm:v1'

export const initialFarmState = {
  farm: {
    id: 'ogun-green-farm',
    name: 'Ogun Green Farm',
    location: 'Ogun State, Nigeria',
    manager: 'Abdulkadir M.',
  },
  tasks: [
    { id: 'task-1', title: 'Check brooder temperature', meta: 'House A · Due 08:00', done: true },
    { id: 'task-2', title: 'Record feed consumption', meta: 'House B · Due 10:30', done: false },
    { id: 'task-3', title: 'Collect and grade eggs', meta: 'Layer House · Due 12:00', done: false },
    { id: 'task-4', title: 'Inspect water lines', meta: 'All houses · Due 15:00', done: false },
  ],
  flocks: [
    { id: 'flock-a', name: 'House A', type: 'Broilers', age: '28 days', birds: 2480, health: 'Good', tone: 'good', lastCheck: 'Today, 08:30' },
    { id: 'flock-b', name: 'House B', type: 'Broilers', age: '35 days', birds: 1920, health: 'Attention', tone: 'attention', lastCheck: 'Today, 08:30' },
    { id: 'flock-layer', name: 'Layer House', type: 'Layers', age: '46 weeks', birds: 1250, health: 'Good', tone: 'good', lastCheck: 'Today, 08:30' },
  ],
  inventory: [
    { id: 'stock-starter', item: 'Broiler starter feed', category: 'Feed', quantity: '1.2 tons', level: 'Healthy', tone: 'good', updated: 'Today, 08:42' },
    { id: 'stock-layer', item: 'Layer mash', category: 'Feed', quantity: '0.8 tons', level: 'Healthy', tone: 'good', updated: 'Yesterday, 16:10' },
    { id: 'stock-vaccine', item: 'ND + IB vaccine', category: 'Medication', quantity: '18 vials', level: 'Low stock', tone: 'attention', updated: 'Sep 06, 11:30' },
    { id: 'stock-shavings', item: 'Wood shavings', category: 'Supplies', quantity: '42 bags', level: 'Healthy', tone: 'good', updated: 'Sep 05, 09:15' },
  ],
  finances: [
    { id: 'finance-1', description: 'Egg sales - Week 1', type: 'Income', amount: '+ ₦684,000', tone: 'income', date: 'Sep 07, 2026' },
    { id: 'finance-2', description: 'Feed purchase - 2 tons', type: 'Expense', amount: '- ₦412,500', tone: 'expense', date: 'Sep 05, 2026' },
    { id: 'finance-3', description: 'Broiler sales - House A', type: 'Income', amount: '+ ₦1,240,000', tone: 'income', date: 'Sep 02, 2026' },
    { id: 'finance-4', description: 'Veterinary supplies', type: 'Expense', amount: '- ₦86,400', tone: 'expense', date: 'Aug 30, 2026' },
  ],
  activities: [
    { id: 'activity-1', title: 'Feed stock updated', detail: 'House A feed inventory was adjusted', time: '12 min ago', tone: 'green' },
    { id: 'activity-2', title: 'Egg collection recorded', detail: '1,024 eggs added by Aisha Bello', time: '48 min ago', tone: 'amber' },
    { id: 'activity-3', title: 'Health check completed', detail: 'House B inspection has been logged', time: '2 hrs ago', tone: 'blue' },
  ],
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
  const eggsCollected = Math.max(320, Math.round(totalBirds * 0.18))
  const eggTarget = Math.max(eggsCollected + 240, 1200)
  const feedDaysRemaining = Math.max(5, Math.round((feedStockTons * 30) / Math.max(1, totalBirds / 1400)))

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
