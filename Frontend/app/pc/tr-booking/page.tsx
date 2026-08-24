'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
} from '@mui/material';
import {
  CAppPageLayout,
} from 'orbcafe-ui';
import { useRouter } from 'next/navigation';
import { usePcI18n } from '../_components/PcI18nProvider';
import { getSessionUser, type SessionUser } from '../_components/session';
import { buildPcMenuData, HeaderLogo } from '../_components/nav';
import { useMessageBox } from '../_components/useMessageBox';
import { performClientLogout } from '../../../services/Auth/logoutClient';
import {
  listReimbursementInvoiceNos,
  type ReimbursementListRow,
} from '../../../services/TravelReimbursement/list';
import { listProjects, type ProjectListRow } from '../../../services/Projects/list';
import { bookingInvoices } from '../../../services/Invoice/booking';
import { listTravelReportRows } from '../../../services/TravelReport/list';
import { groupReportRowsToReimbursements } from '../reimbursements/reportView';
import { openReimbursementDetail, toFilter } from './helpers';
import ReimbursementList from './ReimbursementList';

export default function TRBookingPage() {
  const router = useRouter();
  const { t, lang, changeLanguage } = usePcI18n();
  const { showError, showSuccess, messageBox } = useMessageBox(t);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);

  const [rows, setRows] = useState<ReimbursementListRow[]>([]);
  const [projects, setProjects] = useState<ProjectListRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const hasAccess = Boolean(sessionUser?.permissions?.isFinance || sessionUser?.permissions?.isAdmin);

  const reportError = (message: string) => {
    setError(message);
    showError(message);
  };

  useEffect(() => {
    const user = getSessionUser();
    if (!user) {
      router.replace('/pc/login');
      return;
    }
    setSessionUser(user);
  }, [router]);

  const load = async () => {
    if (!hasAccess) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [reportRows, projectRows] = await Promise.all([listTravelReportRows(sessionUser.userid), listProjects()]);
      setRows(groupReportRowsToReimbursements(reportRows));
      setProjects(projectRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failed_load_reimbursements', 'Failed to load reimbursements'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionUser || !hasAccess) {
      return;
    }
    void load();
  }, [sessionUser, hasAccess]);

  const getSelectedRows = (): ReimbursementListRow[] => {
    if (selected.length === 0) {
      return [];
    }
    const keySet = new Set(selected.map((item) => String(item)));
    return rows.filter((row) => {
      const idKey = String(row.id ?? '');
      const trnoKey = String(row.trno ?? '');
      return keySet.has(idKey) || keySet.has(trnoKey);
    });
  };

  const bookSelected = async () => {
    const targets = getSelectedRows();
    if (targets.length === 0) {
      reportError(t('please_select', 'Please select'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      let successCount = 0;
      const failures: string[] = [];

      for (const row of targets) {
        const displayId = String(row.id ?? row.trno ?? '').trim() || '-';
        try {
          const filter = toFilter(row);
          const lineNos = await listReimbursementInvoiceNos(filter);
          if (lineNos.length === 0) {
            throw new Error(t('no_invoice_lines_to_book', 'No invoice lines to book for current reimbursement'));
          }

          await bookingInvoices({
            invoiceNos: lineNos,
            reimbursementId: filter.id,
            reimbursementNo: filter.trno,
            bookedBy: sessionUser?.userid,
          });
          successCount += 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : t('failed_book_reimbursement', 'Failed to book reimbursement');
          failures.push(`${displayId}: ${message}`);
        }
      }

      if (successCount > 0 && failures.length === 0) {
        showSuccess(t('reimbursement_booked_success', 'Reimbursement booked successfully'));
      } else if (successCount > 0) {
        const head = `Booked ${successCount}, failed ${failures.length}.`;
        const detail = failures.slice(0, 3).join(' | ');
        reportError(detail ? `${head} ${detail}` : head);
      } else {
        reportError(failures[0] ?? t('failed_book_reimbursement', 'Failed to book reimbursement'));
      }

      setSelected([]);
      await load();
    } catch (err) {
      reportError(err instanceof Error ? err.message : t('failed_book_reimbursement', 'Failed to book reimbursement'));
    } finally {
      setLoading(false);
    }
  };

  const openDetail = (row: ReimbursementListRow) => {
    openReimbursementDetail(row, router, {
      invalidMessage: t('invalid_reimbursement', 'Invalid reimbursement record'),
      onInvalid: reportError,
    });
  };

  const menuData = useMemo(() => buildPcMenuData(t), [t]);

  const headerUser = useMemo(() => {
    if (!sessionUser) {
      return undefined;
    }
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

  if (!sessionUser) {
    return null;
  }

  return (
    <CAppPageLayout
      appTitle={t('tr_booking_title', 'TR Booking & Archive')}
      menuData={menuData}
      logo={<HeaderLogo />}
      user={headerUser}
      locale={lang}
      onLocaleChange={(l) => changeLanguage(l as any)}
      localeOptions={['en', 'zh']}
      onUserLogout={() => void performClientLogout({ router, replace: true })}
      contentSx={{ height: '100%', overflow: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      <Box sx={{ position: 'relative', width: '100%', flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {!hasAccess ? (
            <Alert severity="warning">{t('tr_booking_no_permission', 'Only finance and admin can access TR Booking')}</Alert>
          ) : (
            <>
              {error ? <Alert severity="error">{error}</Alert> : null}
              <ReimbursementList
                rows={rows}
                projects={projects}
                loading={loading}
                selected={selected}
                onSelectionChange={setSelected}
                onBook={bookSelected}
                onDetail={openDetail}
                t={t}
              />
            </>
          )}
        </Box>
      </Box>
      {messageBox}
    </CAppPageLayout>
  );
}
