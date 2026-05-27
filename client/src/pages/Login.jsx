import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import Loader from '../components/Loader'
import ErrorBanner from '../components/ErrorBanner'
import './Login.css'

export default function Login() {
  const { isLoggedIn, loading, login } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const errorMsg = searchParams.get('error')

  useEffect(() => {
    if (!loading && isLoggedIn) navigate('/dashboard', { replace: true })
  }, [loading, isLoggedIn, navigate])

  if (loading) {
    return (
      <div className="login-page">
        <Loader size={32} />
      </div>
    )
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <span className="login-icon">⚡</span>
          <h1 className="login-title">SF Rule Manager</h1>
        </div>

        {errorMsg && (
          <ErrorBanner
            message={decodeURIComponent(errorMsg)}
            onDismiss={() => setSearchParams({}, { replace: true })}
          />
        )}

        <p className="login-desc">
          Connect to your Salesforce org to manage validation rules without
          navigating Setup.
        </p>

        <button className="login-btn" onClick={login}>
          Login with Salesforce
        </button>

        <p className="login-footer">
          Your session stays active until you log out.
        </p>
      </div>
    </div>
  )
}

