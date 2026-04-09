import { MODES } from '../lib/systemPrompts'
import type { ModeId, Role } from '../lib/types'

interface Props {
  activeMode: ModeId
  role: Role
  onSelectMode: (mode: ModeId) => void
}

export default function ModeSidebar({ activeMode, role, onSelectMode }: Props) {
  const accent = role === 'business' ? 'amber' : 'indigo'

  const activeClass =
    role === 'business'
      ? 'bg-amber-500/15 border-amber-400/60 text-amber-300'
      : 'bg-indigo-500/15 border-indigo-400/60 text-indigo-300'

  const primaryBadge =
    role === 'business'
      ? 'bg-amber-500/20 text-amber-400 text-[10px]'
      : 'bg-indigo-500/20 text-indigo-400 text-[10px]'

  // Sort: primary roles for this user first
  const sorted = [...MODES].sort((a, b) => {
    const aPrimary = a.primaryRoles.includes(role) ? 0 : 1
    const bPrimary = b.primaryRoles.includes(role) ? 0 : 1
    return aPrimary - bPrimary
  })

  return (
    <aside className="w-56 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col overflow-y-auto">
      <div className="p-3 border-b border-slate-800">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Modes</p>
      </div>

      <nav className="flex-1 p-2 space-y-1">
        {sorted.map((mode) => {
          const isActive = mode.id === activeMode
          const isPrimary = mode.primaryRoles.includes(role)

          return (
            <button
              key={mode.id}
              onClick={() => onSelectMode(mode.id)}
              className={`
                w-full text-left rounded-lg border px-3 py-2.5 transition-all
                ${isActive
                  ? `${activeClass} border`
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }
              `}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{mode.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{mode.label}</span>
                    {isPrimary && (
                      <span className={`shrink-0 px-1 py-0.5 rounded font-medium ${primaryBadge}`}>
                        ★
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5 leading-tight">
                    {mode.description.split('—')[0].trim()}
                  </p>
                </div>
              </div>
            </button>
          )
        })}
      </nav>

      <div className="p-3 border-t border-slate-800">
        <div className={`text-[11px] text-center px-2 py-1 rounded-md font-medium ${primaryBadge}`}>
          ★ = Recommended for {role === 'business' ? 'Business' : 'Dev'}
        </div>
      </div>
    </aside>
  )
}
