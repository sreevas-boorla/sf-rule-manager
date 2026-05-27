import './Header.css'

export default function Header({ user, onLogout }) {
  return (
    <header className="header">
      <div className="header-inner">
        <div className="header-brand">
          <span className="header-logo">⚡</span>
          <span className="header-title">SF Rule Manager</span>
        </div>

        {user && (
          <div className="header-right">
            <div className="header-user">
              <span className="header-username">{user.name}</span>
              {user.orgName && (
                <span className="header-org">{user.orgName}</span>
              )}
            </div>
            <button className="header-logout" onClick={onLogout}>
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
