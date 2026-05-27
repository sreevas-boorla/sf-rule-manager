import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import Header from '../components/Header'
import RuleCard from '../components/RuleCard'
import Loader from '../components/Loader'
import ErrorBanner from '../components/ErrorBanner'
import { getRules, toggleRule, getDeployStatus } from '../services/api'
import './Dashboard.css'

export default function Dashboard() {
  const { user, loading: authLoading, isLoggedIn, logout } = useAuth()
  const navigate = useNavigate()

  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deployingRules, setDeployingRules] = useState({}) // fullName -> true
  const [toast, setToast] = useState(null)
  const pollTimers = useRef({})

  useEffect(() => {
    if (!authLoading && !isLoggedIn) navigate('/', { replace: true })
  }, [authLoading, isLoggedIn, navigate])

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getRules()
      setRules(data.rules || data)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch rules')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isLoggedIn) fetchRules()
  }, [isLoggedIn, fetchRules])

  // Clean up poll timers on unmount
  useEffect(() => {
    return () => {
      Object.values(pollTimers.current).forEach(clearTimeout)
    }
  }, [])

  function showToast(message, type = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function pollDeploy(deployId, fullName) {
    try {
      const status = await getDeployStatus(deployId)

      if (status.done) {
        setDeployingRules(prev => {
          const next = { ...prev }
          delete next[fullName]
          return next
        })

        if (status.success) {
          showToast(`Rule "${fullName}" updated successfully`)
          fetchRules()
        } else {
          showToast(status.error || 'Deployment failed', 'error')
          fetchRules()
        }
        return
      }

      // Still running — check again in a couple seconds
      pollTimers.current[fullName] = setTimeout(() => pollDeploy(deployId, fullName), 2500)
    } catch (err) {
      setDeployingRules(prev => {
        const next = { ...prev }
        delete next[fullName]
        return next
      })
      showToast('Failed to check deploy status', 'error')
    }
  }

  async function handleToggle(fullName) {
    try {
      setDeployingRules(prev => ({ ...prev, [fullName]: true }))
      const result = await toggleRule(fullName)
      pollDeploy(result.deployId, fullName)
    } catch (err) {
      setDeployingRules(prev => {
        const next = { ...prev }
        delete next[fullName]
        return next
      })
      showToast(err.response?.data?.error || 'Toggle failed', 'error')
    }
  }

  if (authLoading) {
    return (
      <div className="dash-loading">
        <Loader size={36} />
      </div>
    )
  }

  if (!isLoggedIn) return null

  return (
    <div className="app">
      <Header user={user} onLogout={logout} />

      <main className="app-content">
        <div className="dash-header">
          <h2 className="dash-title">Account Validation Rules</h2>
          <button className="dash-refresh" onClick={fetchRules} disabled={loading}>
            Refresh
          </button>
        </div>

        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        {loading ? (
          <div className="dash-loading">
            <Loader size={32} />
            <span className="dash-loading-text">Loading rules…</span>
          </div>
        ) : rules.length === 0 ? (
          <div className="dash-empty">
            <p className="dash-empty-icon">📋</p>
            <p className="dash-empty-text">No validation rules found on the Account object.</p>
          </div>
        ) : (
          <div className="dash-grid">
            {rules.map(rule => (
              <RuleCard
                key={rule.fullName}
                rule={rule}
                onToggle={handleToggle}
                isDeploying={!!deployingRules[rule.fullName]}
              />
            ))}
          </div>
        )}
      </main>

      {toast && (
        <div className={`toast toast--${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}
