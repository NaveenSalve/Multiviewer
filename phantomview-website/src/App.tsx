import { useState } from 'react';
import { ThemeProvider } from './hooks/useTheme';
import { MissionControlV24 } from './app-os/MissionControlV24';
import { LandingPage } from './sections/LandingPage';

export function App() {
  const [view, setView] = useState<'landing' | 'mission-control'>('landing');

  return (
    <ThemeProvider>
      {view === 'landing' ? (
        <LandingPage onEnterMissionControl={() => setView('mission-control')} />
      ) : (
        <MissionControlV24 onBack={() => setView('landing')} />
      )}
    </ThemeProvider>
  );
}

export default App;
