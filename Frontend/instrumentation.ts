export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NEXT_PHASE !== 'phase-production-build'
    && process.env.SUPPLIER_DRAFT_WORKER_DISABLED !== '1') {
    // Runtime isolation required by Next: Node filesystem/DB adapters must not enter the Edge bundle.
    const { registerSupplierDraftWorker } = await import('./services/_server/supplier-drafts/entry');
    registerSupplierDraftWorker();
  }
}
