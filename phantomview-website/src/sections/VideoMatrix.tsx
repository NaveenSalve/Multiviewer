import type { LucideIcon } from 'lucide-react';
import { Layout, Monitor, Grid, Maximize2, Layers, CheckCircle } from 'lucide-react';
import { useAppStore, VideoMatrixModeType } from '../store/useAppStore';

const MATRIX_MODES: { id: VideoMatrixModeType; icon: LucideIcon; title: string; desc: string; screens: string }[] = [
  { id: '4', icon: Grid, title: '4-Stream Quad', desc: 'Four simultaneous streams in a compact 2x2 grid. Perfect for focused monitoring.', screens: '2×2' },
  { id: '9', icon: Layout, title: '9-Stream Master', desc: 'Nine sessions in a 3x3 grid. The sweet spot for multi-tasking professionals.', screens: '3×3' },
  { id: '16', icon: Maximize2, title: '16-Stream Ops', desc: 'Sixteen streams in a 4x4 command center layout for intensive operations.', screens: '4×4' },
  { id: '25', icon: Layers, title: '25-Stream Extreme', desc: 'Full 5x5 grid — 25 concurrent sessions. Maximum situational awareness.', screens: '5×5' },
];

export function VideoMatrix() {
  const { videoMatrixMode, setVideoMatrixMode } = useAppStore();

  return (
    <section id="video-matrix" className="section-padding bg-white dark:bg-neutral-950">
      <div className="section-container">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <span className="section-label">
            <Monitor className="w-3.5 h-3.5" />
            Engine 01
          </span>
          <h2 className="section-title">The Video Matrix</h2>
          <p className="section-subtitle mx-auto">
            Transform your desktop into a cinematic multi-stream command center.
            Mix video, terminals, trading charts, and research in one fluid workspace.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {MATRIX_MODES.map((mode) => {
            const isActive = videoMatrixMode === mode.id;
            const Icon = mode.icon;
            return (
              <button
                key={mode.id}
                onClick={() => setVideoMatrixMode(mode.id)}
                className={`card-hover p-6 flex flex-col text-left cursor-pointer ${
                  isActive ? 'ring-2 ring-primary-500 border-primary-500 dark:border-primary-500' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    isActive
                      ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-600 dark:text-primary-400'
                      : 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="tag">{mode.screens}</span>
                </div>
                <h3 className="font-semibold text-neutral-900 dark:text-white mb-1.5">{mode.title}</h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed flex-1">{mode.desc}</p>
                {isActive && (
                  <div className="flex items-center gap-1 mt-3 text-xs font-semibold text-primary-600 dark:text-primary-400">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Active
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-12 card p-6 max-w-4xl mx-auto">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 aspect-video rounded-lg overflow-hidden">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-neutral-800 dark:to-neutral-900 rounded flex items-center justify-center min-h-[60px]">
                <span className="text-xs font-mono text-neutral-400 dark:text-neutral-600">CAM {i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
