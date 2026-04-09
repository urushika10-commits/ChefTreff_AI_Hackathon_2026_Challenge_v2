import type { Role } from '../lib/types'

interface Props {
  onSelectRole: (role: Role) => void
}

const ROLES = [
  {
    id: 'business' as Role,
    title: 'Business Analyst',
    subtitle: 'Product Owner / Compliance Officer',
    emoji: '📊',
    color: 'from-amber-500 to-orange-500',
    border: 'border-amber-500/40 hover:border-amber-400',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    features: [
      '💬 Ask questions about the codebase in plain English',
      '📢 Get code changes explained as business impact',
      '📋 Translate your specs into technical guides',
      '✅ Check if requirements are correctly implemented',
      '⚖️ Verify compliance and regulatory coverage',
      '📈 Understand system capabilities and limitations',
    ],
    cta: "I don't code — just tell me what matters",
  },
  {
    id: 'developer' as Role,
    title: 'Developer',
    subtitle: 'Software Engineer / Tech Lead',
    emoji: '💻',
    color: 'from-indigo-500 to-blue-600',
    border: 'border-indigo-500/40 hover:border-indigo-400',
    badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    features: [
      '🔍 Explore and understand existing code fast',
      '✅ Convert requirements into actionable dev tickets',
      '📋 Get implementation guides from specs',
      '📖 Navigate APIs and documentation easily',
      '🔄 Generate business-friendly change summaries',
      '🚀 Close tickets with confidence',
    ],
    cta: "Let's build — show me the technical tools",
  },
]

export default function RoleSelector({ onSelectRole }: Props) {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-3 mb-4">
          <span className="text-5xl">🌉</span>
        </div>
        <h1 className="text-4xl font-bold text-white mb-3">BridgeAI</h1>
        <p className="text-slate-400 text-lg max-w-xl">
          AI-powered collaboration between Business & Tech teams.
          <br />
          <span className="text-slate-500 text-base">
            No more lost-in-translation meetings — Claude bridges the gap.
          </span>
        </p>
      </div>

      {/* Role cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
        {ROLES.map((role) => (
          <button
            key={role.id}
            onClick={() => onSelectRole(role.id)}
            className={`
              group relative flex flex-col p-6 rounded-2xl text-left
              bg-slate-900 border-2 ${role.border}
              transition-all duration-200 hover:bg-slate-800 hover:scale-[1.02]
              hover:shadow-2xl hover:shadow-black/40
            `}
          >
            {/* Gradient top bar */}
            <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r ${role.color}`} />

            <div className="flex items-start gap-4 mb-5">
              <div className="text-4xl">{role.emoji}</div>
              <div>
                <h2 className="text-xl font-bold text-white">{role.title}</h2>
                <span
                  className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full border ${role.badge}`}
                >
                  {role.subtitle}
                </span>
              </div>
            </div>

            <ul className="space-y-2 mb-6 flex-1">
              {role.features.map((f) => (
                <li key={f} className="text-sm text-slate-400 flex items-start gap-2">
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <div
              className={`
                mt-auto py-3 px-4 rounded-xl text-center text-sm font-semibold
                bg-gradient-to-r ${role.color} text-white
                group-hover:shadow-lg transition-shadow
              `}
            >
              {role.cta}
            </div>
          </button>
        ))}
      </div>

      {/* Footer tagline */}
      <p className="mt-10 text-slate-600 text-sm text-center">
        Powered by Claude Opus 4.6 · Built for the ChefTreff AI Hackathon 2026
      </p>
    </div>
  )
}
