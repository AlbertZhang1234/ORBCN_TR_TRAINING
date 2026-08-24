import { useCallback } from 'react';

/**
 * Compatibility hook for SAP-style components.
 * Falls back to provided default text because this project does not
 * maintain a textelement dictionary yet.
 */
export function useTextelement(_scope?: string, _useGlobal?: boolean) {
  const getText = useCallback((key: string, fallback?: string) => {
    if (fallback && fallback.trim().length > 0) {
      return fallback;
    }
    return key;
  }, []);

  return { getText };
}
