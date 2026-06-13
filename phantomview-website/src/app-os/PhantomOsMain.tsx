import { OsHeader } from './OsHeader';
import { OsSidebar } from './OsSidebar';
import { OsPane } from './OsPane';
import { useAppStore } from '../store/useAppStore';

export function PhantomOsMain() {
  const { osSessions, gridCount } = useAppStore();

  const gridCols = gridCount <= 4 ? 2 : gridCount <= 9 ? 3 : 4;
  const panes = osSessions.slice(0, gridCount);

  return (
    <div className="card overflow-hidden">
      <OsHeader />
      <div className="flex">
        <OsSidebar />
        <div className="flex-1 p-4 bg-neutral-50 dark:bg-neutral-900">
          {panes.length > 0 ? (
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}
            >
              {panes.map(session => (
                <OsPane
                  key={session.id}
                  id={session.id}
                  title={session.title}
                  type={session.type}
                />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center min-h-[300px]">
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">No active sessions</p>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">Add a session from the sidebar</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
