import { ThemeProvider } from './hooks/useTheme';
import { MissionControlV24 } from './app-os/MissionControlV24';

export function App() {
  return (
    <ThemeProvider>
      <MissionControlV24 />
    </ThemeProvider>
  );
}

export default App;
