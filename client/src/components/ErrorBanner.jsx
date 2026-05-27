import './ErrorBanner.css'

export default function ErrorBanner({ message, onDismiss }) {
  if (!message) return null

  return (
    <div className="error-banner" role="alert">
      <p className="error-banner-msg">{message}</p>
      {onDismiss && (
        <button className="error-banner-dismiss" onClick={onDismiss} aria-label="Dismiss">
          ✕
        </button>
      )}
    </div>
  )
}
