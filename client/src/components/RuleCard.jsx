import './RuleCard.css'

export default function RuleCard({ rule, onToggle, isDeploying }) {
  const isActive = rule.active

  return (
    <div className={`rule-card ${isDeploying ? 'rule-card--deploying' : ''}`}>
      <div className="rule-card-header">
        <h3 className="rule-card-name">{rule.name}</h3>
        <span className={`rule-badge ${isActive ? 'rule-badge--active' : 'rule-badge--inactive'}`}>
          {isActive ? 'Active' : 'Inactive'}
        </span>
      </div>

      {rule.description && (
        <p className="rule-card-desc">{rule.description}</p>
      )}

      {rule.errorMessage && (
        <p className="rule-card-error">
          <span className="rule-card-error-label">Error message:</span> {rule.errorMessage}
        </p>
      )}

      <div className="rule-card-footer">
        {isDeploying ? (
          <span className="rule-card-deploying">Deploying…</span>
        ) : (
          <label className="toggle">
            <input
              type="checkbox"
              checked={isActive}
              onChange={() => onToggle(rule.fullName)}
              disabled={isDeploying}
            />
            <span className="toggle-slider" />
          </label>
        )}
      </div>
    </div>
  )
}
