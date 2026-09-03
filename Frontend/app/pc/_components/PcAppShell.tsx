'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { CAppHeader, NavigationIsland, useNavigationIsland } from 'orbcafe-ui';
import { Box } from '@mui/material';
import { usePathname, useRouter } from 'next/navigation';
import { usePcI18n } from './PcI18nProvider';
import { usePcColorMode } from './color-mode';
import { buildPcMenuData, HeaderLogo } from './nav';
import { getSessionUser, type SessionUser } from './session';
import { performClientLogout } from '../../../services/Auth/logoutClient';
import { SupplierDraftProvider } from './SupplierDraftProvider';

const pageTitles: Record<string, [string, string]> = {
  '/pc/home': ['home', 'Home'],
  '/pc/users': ['users', 'User Management'],
  '/pc/roles': ['roles', 'Role Management'],
  '/pc/customers': ['customers', 'Customer Management'],
  '/pc/projects': ['projects', 'Project Management'],
  '/pc/booking-rules': ['booking_rules', 'Booking Rules'],
  '/pc/travel-entries': ['travel_entries', 'Travel Management'],
  '/pc/invoices': ['invoices', 'Invoice Management'],
  '/pc/supplier-invoice-recognition': ['supplier_invoice_recognition', 'Supplier Invoice Recognition'],
  '/pc/supplier-invoices': ['supplier_invoice_management', 'Supplier Invoice Management'],
  '/pc/reimbursements': ['reimbursements', 'Reimbursement Management'],
  '/pc/approve': ['approve', 'Approval'],
  '/pc/tr-booking': ['tr_booking_title', 'TR Booking & Archive'],
  '/pc/tr-report': ['tr_report_title', 'TRReport - Reimbursement Pivot'],
};

type HeaderSearchHandler = ((query: string) => void) | null;
interface PcHeaderContextValue {
  registerSearchHandler: (handler: HeaderSearchHandler) => void;
}
const PcHeaderContext = createContext<PcHeaderContextValue | null>(null);

export function usePcHeaderSearch(handler: HeaderSearchHandler) {
  const context = useContext(PcHeaderContext);
  useEffect(() => {
    context?.registerSearchHandler(handler);
    return () => context?.registerSearchHandler(null);
  }, [context, handler]);
}

function resolveTitle(pathname: string | null, t: (key: string, fallback: string) => string) {
  const path = pathname ?? '/pc/home';
  const exact = pageTitles[path];
  if (exact) return t(exact[0], exact[1]);

  const parent = Object.keys(pageTitles).find((candidate) => path.startsWith(`${candidate}/`));
  if (parent) {
    const [key, fallback] = pageTitles[parent];
    return t(key, fallback);
  }
  return t('home', 'Home');
}

function isStandaloneDetailRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname === '/pc/tr-booking/detail' ||
    pathname === '/pc/reimbursements/detail' ||
    pathname === '/pc/approve/detail'
  );
}

export function PcAppShell({ children }: PropsWithChildren) {
  const router = useRouter();
  const pathname = usePathname();
  const isPublicRoute = Boolean(pathname && (
    pathname === '/pc/login' ||
    pathname.startsWith('/pc/login/') ||
    pathname === '/pc/forgot-password' ||
    pathname === '/pc/reset-password' ||
    pathname === '/pc/register'
  ));
  const { t, lang, changeLanguage } = usePcI18n();
  const { mode, toggleMode } = usePcColorMode();
  const hideNavigation = isStandaloneDetailRoute(pathname);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const searchHandlerRef = useRef<HeaderSearchHandler>(null);
  const registerSearchHandler = useCallback((handler: HeaderSearchHandler) => {
    searchHandlerRef.current = handler;
  }, []);
  const menuData = useMemo(() => buildPcMenuData(t), [t]);
  const { navigationIslandProps, setMenuData } = useNavigationIsland({
    initialCollapsed: false,
    content: menuData,
  });

  useEffect(() => {
    setMenuData(menuData);
  }, [menuData, setMenuData]);

  useEffect(() => {
    if (isPublicRoute) return;
    const user = getSessionUser();
    if (!user) {
      router.replace('/pc/login');
      return;
    }
    setSessionUser(user);
  }, [isPublicRoute, router]);

  const headerUser = useMemo(() => {
    if (!sessionUser) return undefined;
    const name =
      sessionUser.firstname && sessionUser.lastname
        ? `${sessionUser.firstname} ${sessionUser.lastname}`
        : sessionUser.userid;
    return {
      name,
      subtitle: sessionUser.email ?? '',
      avatarText: name.slice(0, 1).toUpperCase(),
    };
  }, [sessionUser]);

  if (isPublicRoute) return <>{children}</>;
  if (!sessionUser) return null;

  return (
    <PcHeaderContext.Provider value={{ registerSearchHandler }}>
      <SupplierDraftProvider key={sessionUser.session_id}>
      <Box
        sx={(theme) => ({
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: theme.palette.background.default,
        })}
      >
        <CAppHeader
          appTitle={resolveTitle(pathname, t)}
          logo={<HeaderLogo />}
          mode={mode}
          onToggleMode={toggleMode}
          user={headerUser}
          locale={lang}
          onLocaleChange={(value) => changeLanguage(value as 'en' | 'zh')}
          localeOptions={['en', 'zh']}
          onSearch={(query) => searchHandlerRef.current?.(query)}
          onUserLogout={() => void performClientLogout({ router, replace: true })}
        />
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
          {!hideNavigation ? (
            <Box sx={{ p: 1.5, display: 'flex', alignItems: 'flex-start', flexShrink: 0 }}>
              <NavigationIsland
                {...navigationIslandProps}
                colorMode={mode}
              />
            </Box>
          ) : null}
          <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto', p: 1.5 }}>
            {children}
          </Box>
        </Box>
      </Box>
      </SupplierDraftProvider>
    </PcHeaderContext.Provider>
  );
}
