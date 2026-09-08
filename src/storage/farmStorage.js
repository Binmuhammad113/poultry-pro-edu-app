import { FARM_STORAGE_KEY, cloneInitialFarmState } from '../domain/farm'

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function loadFarmState() {
  if (!canUseStorage()) return cloneInitialFarmState()

  try {
    const savedState = window.localStorage.getItem(FARM_STORAGE_KEY)
    if (!savedState) return cloneInitialFarmState()

    const parsedState = JSON.parse(savedState)
    const initialState = cloneInitialFarmState()
    return {
      ...initialState,
      ...parsedState,
      farm: { ...initialState.farm, ...parsedState.farm },
      tasks: Array.isArray(parsedState.tasks) ? parsedState.tasks : initialState.tasks,
      flocks: Array.isArray(parsedState.flocks) ? parsedState.flocks : initialState.flocks,
      inventory: Array.isArray(parsedState.inventory) ? parsedState.inventory : initialState.inventory,
      finances: Array.isArray(parsedState.finances) ? parsedState.finances : initialState.finances,
      activities: Array.isArray(parsedState.activities) ? parsedState.activities : initialState.activities,
    }
  } catch {
    return cloneInitialFarmState()
  }
}

export function saveFarmState(state) {
  if (!canUseStorage()) return

  try {
    window.localStorage.setItem(FARM_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage can be unavailable in private browsing or restricted environments.
  }
}

export async function loadFarmStateFromApi() {
  const response = await fetch('/api/farm', { credentials: 'include' })
  if (!response.ok) throw new Error('Farm API unavailable')
  return response.json()
}

export async function saveFarmStateToApi(state) {
  const response = await fetch('/api/farm', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(state),
  })
  if (!response.ok) throw new Error('Farm API unavailable')
  return response.json()
}

export async function getCurrentUser() {
  const response = await fetch('/api/auth/me', { credentials: 'include' })
  if (!response.ok) return null
  return (await response.json()).user
}

export async function authenticate(path, credentials) {
  const response = await fetch(`/api/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(credentials),
  })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error || 'Unable to authenticate')
  return payload.user
}

export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
}

export function clearFarmState() {
  if (!canUseStorage()) return
  window.localStorage.removeItem(FARM_STORAGE_KEY)
}
