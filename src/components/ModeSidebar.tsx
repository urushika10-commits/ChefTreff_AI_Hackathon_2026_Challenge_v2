import { MODES } from '../lib/systemPrompts'
import type { ModeId, Role } from '../lib/types'

interface Props {
  activeMode: ModeId
  role: Role
  onSelectMode: (mode: ModeId) => void
}

export default function ModeSidebar({ activeMode, role, onSelectMode }: Props) {
  const primary = role === 'business' ? '#3B82F6' : '#A855F7'
  const cardBg = role === 'business' ? '#0F2040' : '#170A2E'
  const tagBg = role === 'business' ? 'rgba(59,130,246,0.12)' : 'rgba(168,85,247,0.12)'
  const tagColor = role === 'business' ? '#93C5FD' : '#D8B4FE'
  const activeShadow = role === 'business'
    ? '0 0 0 1px rgba(59,130,246,0.3), 0 8px 24px rgba(0,0,0,0.3)'
    : '0 0 0 1px rgba(168,85,247,0.3), 0 8px 24px rgba(0,0,0,0.3)'

  const sorted = [...MODES].sort((a, b) => {
    const aPrimary = a.primaryRoles.includes(role) ? 0 : 1
    const bPrimary = b.primaryRoles.includes(role) ? 0 : 1
    return aPrimary - bPrimary
  })

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
      {sorted.map((mode) => {
        const isActive = mode.id === activeMode
        const isPrimary = mode.primaryRoles.includes(role)

        return (
          <div
            key={mode.id}
            onClick={() => onSelectMode(mode.id)}
            style={{
              padding: 20,
              borderRadius: 12,
              border: `1px solid ${isActive ? primary : 'rgba(255,255,255,0.06)'}`,
              background: cardBg,
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
              transition: 'all 0.25s ease',
              boxShadow: isActive ? activeShadow : 'none',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.borderColor = primary
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = activeShadow
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = 'none'
              }
            }}
          >
            {/* Subtle gradient shimmer */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 12,
                background: 'linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.02))',
                pointerEvents: 'none',
              }}
            />

            <span style={{ fontSize: 24, marginBottom: 10, display: 'block' }}>{mode.icon}</span>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#F1F5F9', marginBottom: 6 }}>
              {mode.label}
              {isPrimary && (
                <span style={{ marginLeft: 6, color: primary, fontSize: 12 }}>★</span>
              )}
            </div>
            <p style={{ fontSize: 12, color: '#94A3B8', lineHeight: 1.5 }}>
              {mode.description.split('—')[0].trim()}
            </p>
            <span
              style={{
                display: 'inline-block',
                marginTop: 10,
                padding: '2px 8px',
                borderRadius: 100,
                fontSize: 10,
                fontWeight: 600,
                background: tagBg,
                color: tagColor,
              }}
            >
              {isPrimary ? 'Recommended' : 'Available'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
