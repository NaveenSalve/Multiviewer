import { useState, useEffect } from 'react';
import { Cpu, Battery, Zap, Thermometer, Gauge } from 'lucide-react';

const STATS = [
  { label: 'Memory Saved', value: '4.8 GB', icon: Battery, color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30' },
  { label: 'CPU Optimization', value: '37%', icon: Zap, color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' },
  { label: 'Temp Reduction', value: '12°C', icon: Thermometer, color: 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/30' },
  { label: 'Performance Gain', value: '2.4x', icon: Gauge, color: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/30' },
];

function RamCounter({ target, active }: { target: number; active: boolean }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let raf: number;
    const start = performance.now();
    const duration = 2000;
    const endValue = active ? target * 0.3 : target;

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(endValue * eased);
      if (progress < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [target, active]);

  return <span className="text-3xl font-bold">{count.toFixed(1)}</span>;
}

export function ResourceAI() {
  const [active, setActive] = useState(true);

  return (
    <section id="resource-ai" className="section-padding bg-neutral-50 dark:bg-neutral-900">
      <div className="section-container">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <span className="section-label">
            <Cpu className="w-3.5 h-3.5" />
            Engine 04
          </span>
          <h2 className="section-title">Neural Resource AI</h2>
          <p className="section-subtitle mx-auto">
            Intelligent resource management that learns your usage patterns and
            dynamically allocates system resources for peak performance.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="card p-6 sm:p-8 mb-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">RAM Usage</p>
                <div className="flex items-baseline gap-1.5">
                  <RamCounter target={4.8} active={active} />
                  <span className="text-lg text-neutral-400 dark:text-neutral-500">GB</span>
                </div>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                  {active ? 'AI optimization active — saving 3.4 GB' : 'AI optimization disabled'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">AI Control</span>
                <button
                  onClick={() => setActive(!active)}
                  className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${
                    active ? 'bg-primary-600' : 'bg-neutral-300 dark:bg-neutral-700'
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                    active ? 'translate-x-6' : 'translate-x-0'
                  }`} />
                </button>
              </div>
            </div>
            <div className="mt-6 h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  active
                    ? 'bg-gradient-to-r from-primary-500 to-emerald-500'
                    : 'bg-gradient-to-r from-rose-500 to-amber-500'
                }`}
                style={{ width: active ? '30%' : '85%' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {STATS.map((stat, i) => (
              <div key={i} className="card-hover p-4 text-center">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-3 ${stat.color}`}>
                  <stat.icon className="w-4 h-4" />
                </div>
                <div className="text-xl font-bold text-neutral-900 dark:text-white">{stat.value}</div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
