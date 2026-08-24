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
  type ReimbursementListRow,
} from '../../../services/TravelReimbursement/list';
import { deleteTravelReimbursement } from '../../../services/TravelReimbursement/delete';
import { approveTravelReimbursement } from '../../../services/TravelReimbursement/approve';
import { listProjects, type ProjectListRow } from '../../../services/Projects/list';
import { listTravelEntries, type TravelEntryListRow } from '../../../services/TravelEntry/list';
import { listInvoices, type InvoiceListRow } from '../../../services/Invoice/list';
import { listTravelReportRows } from '../../../services/TravelReport/list';
import { openReimbursementDetail, toFilter } from './helpers';
import { groupReportRowsToReimbursements } from './reportView';
import ReimbursementList from './ReimbursementList';
import ReimbursementEditor from './ReimbursementEditor';

type EditMode = 'create' | 'edit';
const REIMBURSEMENT_PREFILL_STORAGE_KEY = 'pc_reimbursement_create_prefill';

export default function ReimbursementsPage() {
  const router = useRouter();
  const { t, lang, changeLanguage } = usePcI18n();
  const { showError, showSuccess, messageBox } = useMessageBox(t);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);

  const [rows, setRows] = useState<ReimbursementListRow[]>([]);
  const [projects, setProjects] = useState<ProjectListRow[]>([]);
  const [travelEntries, setTravelEntries] = useState<TravelEntryListRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceListRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditMode>('create');
  const [editorPrefillData, setEditorPrefillData] = useState<{
    invoiceNos: string[];
    applicant?: string;
    travelFilterId?: string;
  } | null>(null);

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

  const load = async (requestUserId: string) => {
    setLoading(true);
    setError('');
    try {
      const [reportRows, projectRows, travelRows, invoiceRows] = await Promise.all([
        listTravelReportRows(requestUserId),
        listProjects(),
        listTravelEntries(),
        listInvoices(),
      ]);
      setRows(groupReportRowsToReimbursements(reportRows));
      setProjects(projectRows);
      setTravelEntries(travelRows);
      setInvoices(invoiceRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('failed_load_reimbursements', 'Failed to load reimbursements'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionUser?.userid) {
      return;
    }
    void load(sessionUser.userid);
  }, [sessionUser]);

  useEffect(() => {
    if (!sessionUser || typeof window === 'undefined') {
      return;
    }
    const raw = window.localStorage.getItem(REIMBURSEMENT_PREFILL_STORAGE_KEY);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as {
        invoiceNos?: unknown;
        applicant?: unknown;
        travelFilterId?: unknown;
      };
      const invoiceNos = Array.isArray(parsed.invoiceNos)
        ? parsed.invoiceNos.map((item) => String(item).trim()).filter(Boolean)
        : [];
      if (invoiceNos.length > 0) {
        setEditorMode('create');
        setEditorPrefillData({
          invoiceNos,
          applicant: String(parsed.applicant ?? '').trim() || undefined,
          travelFilterId: String(parsed.travelFilterId ?? '').trim() || undefined,
        });
        setEditorOpen(true);
      }
    } catch {
      // Ignore invalid prefill payload.
    } finally {
      window.localStorage.removeItem(REIMBURSEMENT_PREFILL_STORAGE_KEY);
    }
  }, [sessionUser]);

  const getSelectedRow = (): ReimbursementListRow | null => {
    if (selected.length !== 1) {
      return null;
    }
    const key = selected[0];
    return (
      rows.find((row) => {
        if (String(row.id ?? '') === key) {
          return true;
        }
        return String(row.trno ?? '') === key;
      }) ?? null
    );
  };

  const openCreateDialog = () => {
    setEditorMode('create');
    setEditorPrefillData(null);
    setEditorOpen(true);
  };

  const openEditDialog = () => {
    const current = getSelectedRow();
    if (!current) {
      reportError(t('please_select_one_reimbursement', 'Please select one reimbursement record'));
      return;
    }
    setEditorMode('edit');
    setEditorOpen(true);
  };

  const removeSelected = async () => {
    const current = getSelectedRow();
    if (!current) {
      reportError(t('please_select_one_reimbursement', 'Please select one reimbursement record'));
      return;
    }
    if (typeof window !== 'undefined' && !window.confirm(t('confirm_delete_reimbursement', 'Confirm delete this reimbursement?'))) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      await deleteTravelReimbursement(toFilter(current));
      setSelected([]);
      if (sessionUser?.userid) {
        await load(sessionUser.userid);
      }
    } catch (err) {
      reportError(err instanceof Error ? err.message : t('failed_delete_reimbursement', 'Failed to delete reimbursement'));
    } finally {
      setLoading(false);
    }
  };

  const approveSelected = async () => {
    const current = getSelectedRow();
    if (!current) {
      reportError(t('please_select_one_reimbursement', 'Please select one reimbursement record'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      await approveTravelReimbursement({
        filter: toFilter(current),
        approvalStatus: 'approved',
        approver: sessionUser?.userid,
      });
      showSuccess(t('reimbursement_approved_success', 'Reimbursement approved successfully'));
      if (sessionUser?.userid) {
        await load(sessionUser.userid);
      }
    } catch (err) {
      reportError(err instanceof Error ? err.message : t('failed_approve_reimbursement', 'Failed to approve reimbursement'));
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
      appTitle={t('reimbursements', 'Reimbursement Management')}
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
          {error ? <Alert severity="error">{error}</Alert> : null}
          <ReimbursementList
            rows={rows}
            projects={projects}
            loading={loading}
            selected={selected}
            onSelectionChange={setSelected}
            onOpenCreate={openCreateDialog}
            onOpenEdit={openEditDialog}
            onDelete={removeSelected}
            onApprove={approveSelected}
            onDetail={openDetail}
            t={t}
          />
        </Box>
      </Box>

      <ReimbursementEditor
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setEditorPrefillData(null);
        }}
        mode={editorMode}
        targetRow={editorMode === 'edit' ? getSelectedRow() : null}
        sessionUser={sessionUser}
        projects={projects}
        travelEntries={travelEntries}
        invoices={invoices}
        prefillData={editorMode === 'create' ? editorPrefillData : null}
        onSaved={async () => {
          setEditorOpen(false);
          setEditorPrefillData(null);
          if (sessionUser?.userid) {
            await load(sessionUser.userid);
          }
          showSuccess(
            editorMode === 'create'
              ? t('reimbursement_created_success', 'Reimbursement created successfully')
              : t('reimbursement_saved_success', 'Reimbursement saved successfully'),
          );
        }}
      />
      {messageBox}
    </CAppPageLayout>
  );
}
