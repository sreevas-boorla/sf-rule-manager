import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: 20,
      textAlign: 'center',
    }}>
      <h1 style={{ fontSize: 64, margin: '0 0 8px', color: 'var(--color-text-muted)' }}>404</h1>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 16, marginBottom: 24 }}>
        This page doesn't exist.
      </p>
      <Link to="/" style={{
        padding: '10px 24px',
        fontSize: 14,
        fontWeight: 500,
        color: '#fff',
        backgroundColor: 'var(--color-primary)',
        borderRadius: 'var(--radius-sm)',
        textDecoration: 'none',
      }}>
        Back to Home
      </Link>
    </div>
  )
}
