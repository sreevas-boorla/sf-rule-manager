import axios from 'axios'

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
const apiBase = isLocal ? 'http://localhost:3001' : 'https://sf-rule-manager-backend.onrender.com'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || apiBase,
  withCredentials: true,
})

// Login is a full-page redirect, not an AJAX call — go straight to the backend
export function login() {
  const base = import.meta.env.VITE_API_URL || apiBase
  window.location.href = `${base}/api/auth/login`
}


export async function getMe() {
  const { data } = await api.get('/api/auth/me')
  return data
}

export async function logout() {
  const { data } = await api.post('/api/auth/logout')
  return data
}

// Rules
export async function getRules() {
  const { data } = await api.get('/api/rules')
  return data
}

export async function toggleRule(fullName) {
  const { data } = await api.put(`/api/rules/${encodeURIComponent(fullName)}/toggle`)
  return data
}

export async function getDeployStatus(deployId) {
  const { data } = await api.get(`/api/rules/deploy-status/${deployId}`)
  return data
}
