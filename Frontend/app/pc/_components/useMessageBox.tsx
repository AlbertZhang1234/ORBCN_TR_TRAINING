'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { CMessageBox, type CMessageBoxType } from '@/components/Molecules/CMessageBox';

type TranslateFn = (key: string, fallback: string) => string;

interface MessageBoxState {
  open: boolean;
  type: CMessageBoxType;
  title: string;
  message: ReactNode;
}

interface ShowMessageOptions {
  type?: CMessageBoxType;
  title?: string;
  message: ReactNode;
}

function defaultTitle(type: CMessageBoxType, t?: TranslateFn): string {
  if (!t) {
    if (type === 'success') return 'Success';
    if (type === 'error') return 'Error';
    if (type === 'warning') return 'Warning';
    if (type === 'info') return 'Info';
    return 'Message';
  }
  if (type === 'success') return t('success', 'Success');
  if (type === 'error') return t('error', 'Error');
  if (type === 'warning') return t('warning', 'Warning');
  if (type === 'info') return t('info', 'Info');
  return t('message', 'Message');
}

export function useMessageBox(t?: TranslateFn) {
  const [state, setState] = useState<MessageBoxState>({
    open: false,
    type: 'info',
    title: defaultTitle('info', t),
    message: '',
  });

  const closeMessage = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  const showMessage = useCallback(
    (options: ShowMessageOptions) => {
      const type = options.type ?? 'info';
      setState({
        open: true,
        type,
        title: options.title ?? defaultTitle(type, t),
        message: options.message,
      });
    },
    [t],
  );

  const showSuccess = useCallback(
    (message: ReactNode, title?: string) => {
      showMessage({ type: 'success', title, message });
    },
    [showMessage],
  );

  const showError = useCallback(
    (message: ReactNode, title?: string) => {
      showMessage({ type: 'error', title, message });
    },
    [showMessage],
  );

  const showWarning = useCallback(
    (message: ReactNode, title?: string) => {
      showMessage({ type: 'warning', title, message });
    },
    [showMessage],
  );

  const showInfo = useCallback(
    (message: ReactNode, title?: string) => {
      showMessage({ type: 'info', title, message });
    },
    [showMessage],
  );

  const messageBox = useMemo(
    () => (
      <CMessageBox
        open={state.open}
        type={state.type}
        title={state.title}
        message={state.message}
        onClose={closeMessage}
        showCancel={false}
        confirmText={t ? t('ok', 'OK') : 'OK'}
      />
    ),
    [closeMessage, state.message, state.open, state.title, state.type, t],
  );

  return {
    showMessage,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    closeMessage,
    messageBox,
  };
}

