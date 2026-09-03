# Invoice import dialog design QA

- Source visual truth: `C:\Users\ORBIS\AppData\Local\Temp\codex-clipboard-7196e42a-14e5-4457-8e07-b61d2460578b.png`
- Source pixels: 1910 x 917
- Intended implementation: `http://127.0.0.1:8200/pc/invoices`
- Browser viewport: 1178 x 872 CSS px, device scale not exposed by the in-app browser
- State requested: initial expanded setup and post-upload collapsed setup
- Implementation screenshot: unavailable; the authenticated route redirected to `/pc/login`

## Full-view comparison evidence

The supplied source image was opened and inspected. The implementation route was opened in the Codex in-app browser, but the current browser session has no authenticated application session and therefore shows the login screen instead of the invoice import dialog. A same-state visual comparison cannot be made yet.

## Focused region comparison evidence

Blocked for the same authentication reason. The setup panel, result table, and fixed action area are not present on the login screen.

## Automated checks completed

- TypeScript: `npx tsc --noEmit` passed.
- Import normalization tests: 4 passed.
- Expanded and collapsed setup components both completed a server-render smoke test.
- Production build: `npm run build` passed.
- Browser console: no error entries were returned on the login screen.

## Findings

- [P1] Authenticated implementation view unavailable.
  - Evidence: `/pc/invoices` redirects the in-app browser to `/pc/login`.
  - Impact: spacing, table height, collapse animation, and primary interactions cannot be visually accepted.
  - Next verification: sign in, open the import dialog, capture the expanded state, import sample files, capture the collapsed state, and test expand/add-files controls.

## Comparison history

- Initial pass: blocked before visual comparison; no implementation screenshot was available to evaluate or fix.

## Final result

final result: blocked
