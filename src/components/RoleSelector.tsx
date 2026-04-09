import type { Role } from '../lib/types'

interface Props {
  onSelectRole: (role: Role) => void
}

export default function RoleSelector({ onSelectRole }: Props) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 60,
        background:
          'radial-gradient(ellipse at 30% 40%, rgba(59,130,246,0.12) 0%, transparent 60%), ' +
          'radial-gradient(ellipse at 70% 60%, rgba(168,85,247,0.12) 0%, transparent 60%), ' +
          'linear-gradient(135deg, #040812 0%, #080413 100%)',
        fontFamily: "'Inter', system-ui, sans-serif",
        overflow: 'hidden',
      }}
    >
      {/* Hero */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill="url(#logoGrad)" />
            <path d="M14 18h8m0 0V14m0 4 8 4m0 0v4m0-4 8 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M14 30h8m0 0v4m0-4 8-4m0 0v-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
            <defs>
              <linearGradient id="logoGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                <stop stopColor="#3B82F6" />
                <stop offset="1" stopColor="#A855F7" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div
          style={{
            fontSize: 52,
            fontWeight: 800,
            letterSpacing: '-2px',
            background: 'linear-gradient(135deg, #3B82F6, #A855F7)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          DualMind AI
        </div>
        <div style={{ fontSize: 18, color: '#94A3B8', fontWeight: 400, marginTop: 10 }}>
          AI-powered collaboration between Business &amp; Technology
        </div>
      </div>

      {/* Role cards */}
      <div style={{ display: 'flex', gap: 24 }}>
        <RoleCard
          icon="📊"
          title="Business Analyst"
          desc="Understand code in business terms, verify requirements, check compliance, and track project progress — no technical knowledge required."
          features={[
            'Verify specs are correctly implemented',
            'Compliance & regulatory review',
            'Progress reports for stakeholders',
            'Ask any question in plain language',
          ]}
          btnLabel="Enter as Business Analyst"
          primary="#3B82F6"
          glow="rgba(59,130,246,0.25)"
          lightColor="#93C5FD"
          hoverRadial="rgba(59,130,246,0.15)"
          onSelect={() => onSelectRole('business')}
        />
        <RoleCard
          icon="⚙️"
          title="Developer"
          desc="Translate specs into code, generate test cases, verify implementations, and produce documentation — all grounded in the actual requirements."
          features={[
            'Spec-to-code technical guides',
            'Test case generation with edge cases',
            'Implementation verification',
            'API docs & risk analysis',
          ]}
          btnLabel="Enter as Developer"
          primary="#A855F7"
          glow="rgba(168,85,247,0.25)"
          lightColor="#D8B4FE"
          hoverRadial="rgba(168,85,247,0.15)"
          onSelect={() => onSelectRole('developer')}
        />
      </div>

      <div style={{ fontSize: 13, color: '#475569' }}>
        Loan Calculator Project · Powered by Claude Opus 4.6
      </div>
    </div>
  )
}

interface CardProps {
  icon: string
  title: string
  desc: string
  features: string[]
  btnLabel: string
  primary: string
  glow: string
  lightColor: string
  hoverRadial: string
  onSelect: () => void
}

function RoleCard({ icon, title, desc, features, btnLabel, primary, glow, lightColor, hoverRadial, onSelect }: CardProps) {
  return (
    <div
      className="role-card-hover"
      onClick={onSelect}
      style={{
        width: 280,
        padding: '36px 28px',
        borderRadius: 20,
        border: '1px solid rgba(255,255,255,0.08)',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.03)',
        transition: 'all 0.35s ease',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget
        el.style.borderColor = primary
        el.style.boxShadow = `0 0 40px ${glow}, 0 20px 60px rgba(0,0,0,0.4)`
        el.style.transform = 'translateY(-6px)'
        const overlay = el.querySelector('.card-overlay') as HTMLElement
        if (overlay) overlay.style.opacity = '1'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget
        el.style.borderColor = 'rgba(255,255,255,0.08)'
        el.style.boxShadow = 'none'
        el.style.transform = 'none'
        const overlay = el.querySelector('.card-overlay') as HTMLElement
        if (overlay) overlay.style.opacity = '0'
      }}
    >
      {/* Radial glow overlay */}
      <div
        className="card-overlay"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 20,
          background: `radial-gradient(circle at 50% 0%, ${hoverRadial} 0%, transparent 70%)`,
          opacity: 0,
          transition: 'opacity 0.35s ease',
          pointerEvents: 'none',
        }}
      />

      <span style={{ fontSize: 40, marginBottom: 16, display: 'block', position: 'relative', zIndex: 1 }}>{icon}</span>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: lightColor, position: 'relative', zIndex: 1 }}>
        {title}
      </div>
      <div style={{ fontSize: 14, color: '#94A3B8', lineHeight: 1.6, marginBottom: 20, position: 'relative', zIndex: 1 }}>
        {desc}
      </div>
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', zIndex: 1 }}>
        {features.map((f) => (
          <li key={f} style={{ fontSize: 12, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: primary, fontSize: 11, flexShrink: 0 }}>→</span>
            {f}
          </li>
        ))}
      </ul>
      <button
        onClick={(e) => { e.stopPropagation(); onSelect() }}
        style={{
          width: '100%',
          padding: '12px 0',
          borderRadius: 8,
          border: 'none',
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          background: primary,
          color: 'white',
          marginTop: 24,
          position: 'relative',
          zIndex: 1,
          transition: 'opacity 0.2s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85' }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
      >
        {btnLabel}
      </button>
    </div>
  )
}
