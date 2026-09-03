'use client';
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type PropsWithChildren } from 'react';
import { Alert, Snackbar } from '@mui/material';
import { SupplierDraftStore } from '@/services/Invoice/supplier-draft-store';
import { supplierDraftApi } from '@/services/Invoice/supplier-drafts';

const Context = createContext<SupplierDraftStore | null>(null);
export function SupplierDraftProvider({ children }: PropsWithChildren) {
  const [store] = useState(() => new SupplierDraftStore(supplierDraftApi));
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => {
    const timer = setInterval(() => store.tick(), 3000);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      const state = store.getSnapshot();
      if (state.dirty.length || state.uploading || state.busy.length) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => { clearInterval(timer); window.removeEventListener('beforeunload', beforeUnload); };
  }, [store]);
  return <Context.Provider value={store}>{children}
    <Snackbar open={Boolean(state.error)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <Alert severity="error">{state.error}</Alert>
    </Snackbar>
  </Context.Provider>;
}
export function useSupplierDrafts() {
  const store = useContext(Context);
  if (!store) throw new Error('SupplierDraftProvider missing');
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => { store.activate(); }, [store]);
  return { store, ...state };
}
