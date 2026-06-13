import { useAppStore } from '../store/useAppStore';
import { Monitor, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';

export function OsSidebar() {
  const { osSessions, removeOsSession, addOsSession, addSecurityLog } = useAppStore();
  const [title, setTitle] = useState('');

  const handleAdd = () => {
    if (!title.trim()) return;
    addOsSession({
      title: title.trim(),
      type: 'browser',
      url: '',
      proxy: '',
      muted: false,
      quality: '720p',
    });
    addSecurityLog(`Session "${title.trim()}" deployed.`);
    setTitle('');
  };

  return (
    <aside className="w-64 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Sessions</h3>
        <span className="text-xs text-neutral-500">{osSessions.length}</span>
      </div>

      <div className="p-3 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex gap-2">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="New session..."
            className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder-neutral-400"
          />
          <button onClick={handleAdd} className="btn-ghost p-1.5">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {osSessions.map(session => (
          <div key={session.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 group transition-colors">
            <div className="flex items-center gap-2 min-w-0">
              <Monitor className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
              <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 truncate">{session.title}</span>
            </div>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 cursor-pointer" title="Refresh">
                <RefreshCw className="w-3 h-3 text-neutral-400" />
              </button>
              <button
                onClick={() => { removeOsSession(session.id); addSecurityLog(`Session "${session.title}" terminated.`); }}
                className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 cursor-pointer"
                title="Remove"
              >
                <Trash2 className="w-3 h-3 text-red-400" />
              </button>
            </div>
          </div>
        ))}
        {osSessions.length === 0 && (
          <p className="text-xs text-neutral-400 text-center py-8">No active sessions</p>
        )}
      </div>
    </aside>
  );
}
