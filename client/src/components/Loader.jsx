const spinnerStyle = {
  width: 28,
  height: 28,
  border: '3px solid var(--color-border)',
  borderTopColor: 'var(--color-primary)',
  borderRadius: '50%',
  animation: 'spin 0.7s linear infinite',
}

export default function Loader({ size = 28, className = '' }) {
  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <div
        className={className}
        style={{ ...spinnerStyle, width: size, height: size }}
        role="status"
        aria-label="Loading"
      />
    </>
  )
}
