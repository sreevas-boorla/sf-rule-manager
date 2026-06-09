import { useState, useEffect, useCallback } from 'react'
import { getMe, logout as apiLogout, login as apiLogin } from '../services/api'

export default function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function checkSession() {
      try {
        const data = await getMe()
        if (!cancelled) setUser(data.user)
      } catch (err) {
        // 401 just means not logged in — not a real error
        if (err.response?.status !== 401 && !cancelled) {
          setError('Failed to check authentication')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    checkSession()
    return () => { cancelled = true }
  }, [])

  const login = useCallback((env) => {
    apiLogin(env)
  }, [])


  const logout = useCallback(async () => {
    try {
      await apiLogout()
      setUser(null)
    } catch (err) {
      setError('Logout failed')
    }
  }, [])

  return {
    user,
    loading,
    error,
    isLoggedIn: !!user,
    login,
    logout,
  }
}
