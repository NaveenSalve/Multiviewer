import { Clock, Grid, Plus } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useState, useEffect } from 'react';

export function OsHeader() {
  const { gridCount, setGridCount, addSecurityLog } = useAppStore();
  const [time, setTime] = useState('');

  useEffect(() => {
    const update = () => {
      const d = new Date();
      setTime(d.toLocaleTimeString('en-US', { hour12: false }));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Grid className="w-4 h-4 text-primary-600" />
          <span className="text-sm font-semibold text-neutral-900 dark:text-white">OS Panes</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500">Grid:</span>
          <input
            type="number"
            min={1}
            max={100}
            value={gridCount}
            onChange={e => {
              const v = Math.min(100, Math.max(1, Number(e.target.value)));
              setGridCount(v);
              addSecurityLog(`Grid count set to ${v}`);
            }}
            className="w-16 px-2 py-1 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white text-center"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-ghost text-xs">
          <Plus className="w-3.5 h-3.5" />
          New Pane
        </button>
        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
          <Clock className="w-3.5 h-3.5" />
          {time}
        </div>
      </div>
    </header>
  );
}
