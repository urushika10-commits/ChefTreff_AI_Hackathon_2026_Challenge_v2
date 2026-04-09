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
    ? '0 0 0 1px rgba(59,130,246,0.3), 0 4px 16px rgba(0,0,0,0.3)'
    : '0 0 0 1px rgba(168,85,247,0.3), 0 4px 16px rgba(0,0,0,0.3)'

  const sorted = [...MODES].sort((a, b) => {
    const aPrimary = a.primaryRoles.includes(role) ? 0 : 1
    const bPrimary = b.primaryRoles.includes(role) ? 0 : 1
    return aPrimary - bPrimary
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {sorted.map((mode) => {
        const isActive = mode.id === activeMode
        const isPrimary = mode.primaryRoles.includes(role)

        return (
          <div
            key={mode.id}
            onClick={() => onSelectMode(mode.id)}
            style={{
              padding: '14px 16px',
              borderRadius: 10,
              border: `1px solid ${isActive ? primary : 'rgba(255,255,255,0.06)'}`,
              background: cardBg,
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
              transition: 'all 0.22s ease',
              boxShadow: isActive ? activeShadow : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.borderColor = primary
                e.currentTarget.style.transform = 'translateX(2px)'
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
                borderRadius: 10,
                background: 'linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.02))',
                pointerEvents: 'none',
              }}
            />

            {/* Active indicator */}
            {isActive && (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 8,
                  bottom: 8,
                  width: 3,
                  borderRadius: '0 3px 3px 0',
                  background: primary,
                }}
              />
            )}

            <span style={{ fontSize: 20, flexShrink: 0, paddingLeft: isActive ? 4 : 0, transition: 'padding 0.2s' }}>
              {mode.icon}
            </span>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9', display: 'flex', alignItems: 'center', gap: 6 }}>
                {mode.label}
                {isPrimary && (
                  <span style={{ color: primary, fontSize: 11 }}>★</span>
                )}
              </div>
              <p style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.4, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {mode.description.split('—')[0].trim()}
              </p>
            </div>

            <span
              style={{
                flexShrink: 0,
                padding: '2px 7px',
                borderRadius: 100,
                fontSize: 10,
                fontWeight: 600,
                background: tagBg,
                color: tagColor,
              }}
            >
              {isPrimary ? 'Rec' : 'Avail'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
