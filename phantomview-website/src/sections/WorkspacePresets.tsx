import type { LucideIcon } from 'lucide-react';
import { Sparkles, Monitor, LineChart, Search, Shield, BookOpen } from 'lucide-react';
import { useAppStore, PresetType } from '../store/useAppStore';

const PRESETS: { id: PresetType; icon: LucideIcon; title: string; desc: string; color: string }[] = [
  { id: 'creator', icon: Monitor, title: 'Creator Studio', desc: 'Streaming, chat, production tools, and asset management in one view.', color: 'bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400' },
  { id: 'trading', icon: LineChart, title: 'Alpha Trading', desc: 'Real-time charts, order books, news feeds, and portfolio tracker.', color: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' },
  { id: 'research', icon: Search, title: 'Deep Research', desc: 'Multi-engine search, document viewer, reference manager, and notes.', color: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' },
  { id: 'monitoring', icon: Shield, title: 'SecOps Dark Ops', desc: 'Security feeds, log analysis, network status, and threat monitoring.', color: 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' },
  { id: 'study', icon: BookOpen, title: 'Study Hub', desc: 'Lecture player, note-taking, research papers, and citation manager.', color: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' },
];

function PresetIcon({ icon: Icon, className }: { icon: LucideIcon; className: string }) {
  return <Icon className={className} />;
}

export function WorkspacePresets() {
  const { activePreset, setActivePreset, loadOsPreset } = useAppStore();
  const activeIndex = PRESETS.findIndex(p => p.id === activePreset);
  const currentPreset = PRESETS[activeIndex >= 0 ? activeIndex : 0];
  const ActiveIcon = currentPreset.icon;

  return (
    <section id="presets" className="section-padding bg-neutral-50 dark:bg-neutral-900">
      <div className="section-container">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <span className="section-label">
            <Sparkles className="w-3.5 h-3.5" />
            Engine 02
          </span>
          <h2 className="section-title">Workspace Presets</h2>
          <p className="section-subtitle mx-auto">
            Instantly switch between pre-configured workspace layouts optimized for
            different workflows. One click to transform your entire desktop.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <div className="flex flex-col gap-3">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => setActivePreset(preset.id)}
                className={`flex items-start gap-4 p-4 rounded-xl text-left transition-all cursor-pointer ${
                  activePreset === preset.id
                    ? 'bg-white dark:bg-neutral-800 shadow-sm border border-neutral-200 dark:border-neutral-700'
                    : 'hover:bg-white/50 dark:hover:bg-neutral-800/50 border border-transparent'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${preset.color}`}>
                  <PresetIcon icon={preset.icon} className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-900 dark:text-white text-sm">{preset.title}</h3>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">{preset.desc}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="card p-6 flex flex-col items-center justify-center min-h-[300px]">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${currentPreset.color}`}>
              <ActiveIcon className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">{currentPreset.title}</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center max-w-xs mb-6">{currentPreset.desc}</p>
            <button
              onClick={() => loadOsPreset(activePreset)}
              className="btn-primary text-sm"
            >
              Activate Preset
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
