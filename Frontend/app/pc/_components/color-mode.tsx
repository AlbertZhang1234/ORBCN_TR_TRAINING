'use client';

import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { CssBaseline } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';

type Mode = 'light' | 'dark';

interface PcColorModeValue {
  mode: Mode;
  toggleMode: () => void;
}

const PcColorModeContext = createContext<PcColorModeValue | null>(null);

const STORAGE_KEY = 'pc_color_mode';
type ModeSource = 'system' | 'storage' | 'query';

function parseMode(value: unknown): Mode | null {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'light') {
    return 'light';
  }
  if (normalized === 'dark') {
    return 'dark';
  }
  return null;
}

function buildTheme(mode: Mode) {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? '#6ea8ff' : '#2455c3',
      },
      background: {
        // Keep dark mode in black/deep-gray family to match the main app shell.
        default: isDark ? '#0b0d10' : '#eef4ff',
        paper: isDark ? '#171b21' : '#ffffff',
      },
    },
    typography: {
      fontFamily: [
        '"72"',
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        '"Helvetica Neue"',
        'Arial',
        'sans-serif',
      ].join(','),
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 10,
          },
        },
      },
    },
  });
}

export function PcColorModeProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState<Mode>('dark');
  const [modeSource, setModeSource] = useState<ModeSource>('system');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const searchMode = parseMode(new URLSearchParams(window.location.search).get('mode'));
    if (searchMode) {
      setModeSource('query');
      setMode(searchMode);
      setInitialized(true);
      return;
    }

    const stored = parseMode(window.localStorage.getItem(STORAGE_KEY));
    if (stored) {
      setModeSource('storage');
      setMode(stored);
      setInitialized(true);
      return;
    }

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setModeSource('system');
    setMode(prefersDark ? 'dark' : 'light');
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (!initialized) {
      return;
    }
    document.documentElement.dataset.pcTheme = mode;
    if (modeSource !== 'query') {
      window.localStorage.setItem(STORAGE_KEY, mode);
    }
  }, [initialized, mode, modeSource]);

  useEffect(() => {
    if (!initialized || modeSource === 'query') {
      return;
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) {
        return;
      }
      const next = parseMode(event.newValue);
      if (next) {
        setModeSource('storage');
        setMode(next);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [initialized, modeSource]);

  const value = useMemo<PcColorModeValue>(
    () => ({
      mode,
      toggleMode: () => {
        setModeSource('storage');
        setMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
      },
    }),
    [mode],
  );

  const theme = useMemo(() => buildTheme(mode), [mode]);

  return (
    <PcColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </PcColorModeContext.Provider>
  );
}

export function usePcColorMode() {
  const ctx = useContext(PcColorModeContext);
  if (!ctx) {
    throw new Error('usePcColorMode must be used inside PcColorModeProvider');
  }
  return ctx;
}
