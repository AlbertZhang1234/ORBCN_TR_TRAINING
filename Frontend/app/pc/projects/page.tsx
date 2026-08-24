'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  TextField,
  Tooltip,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import { CAppPageLayout, resolveVariantFilters } from 'orbcafe-ui';
import type { FilterField, FilterValue } from '@/components/Structures/CSmartFilter';
import type { TableLayout } from '@/components/Structures/CTable/types';
import { useRouter } from 'next/navigation';
import { usePcI18n } from '../_components/PcI18nProvider';
import { getSessionUser, type SessionUser } from '../_components/session';
import { useMessageBox } from '../_components/useMessageBox';
import { buildPcMenuData, HeaderLogo } from '../_components/nav';
import { performClientLogout } from '../../../services/Auth/logoutClient';
import { variantService } from '../../../services/common/variant-service';
import { listProjects, type ProjectListRow } from '../../../services/Projects/list';
import { createProject } from '../../../services/Projects/create';
import { changeProject } from '../../../services/Projects/change';
import { deleteProject } from '../../../services/Projects/delete';
import { listUsers, type UserListRow } from '../../../services/User/list';
import { listCustomers, type CustomerListRow } from '../../../services/Customer/list';
import { BusyStandardPage } from '../_components/TableLoadingMarquee';
import type { VariantMetadata } from '@/components/Molecules/CVariantManagement';

const defaultFilters: Record<string, FilterValue> = {
  projectid: { value: '', operator: 'contains' },
  description: { value: '', operator: 'contains' },
  customerid: { value: [], operator: 'anyOf' },
  paymentterm: { value: '', operator: 'contains' },
  projectmanager: { value: [], operator: 'anyOf' },
  salesperson: { value: [], operator: 'anyOf' },
  trchargeable: { value: [], operator: 'anyOf' },
  txchargeable: { value: [], operator: 'anyOf' },
};

function readMultiFilterValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
  }
  const single = String(value ?? '').trim().toLowerCase();
  return single ? [single] : [];
}

function normalizeBool(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  return false;
}

export default function ProjectsPage() {
  const router = useRouter();
  const { t, lang, changeLanguage } = usePcI18n();
  const { showError, showSuccess, messageBox } = useMessageBox(t);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);

  const [rows, setRows] = useState<ProjectListRow[]>([]);
  const [users, setUsers] = useState<UserListRow[]>([]);
  const [customers, setCustomers] = useState<CustomerListRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [layout, setLayout] = useState<TableLayout | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<Record<string, FilterValue>>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<Record<string, FilterValue>>(defaultFilters);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [description, setDescription] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [paymentTerm, setPaymentTerm] = useState('');
  const [projectManager, setProjectManager] = useState('');
  const [salesperson, setSalesperson] = useState('');
  const [trChargeable, setTrChargeable] = useState(false);
  const [txChargeable, setTxChargeable] = useState(false);

  const LAYOUT_KEY = 'pc_projects_default_layout_v1';

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
    setLoading(true);
    setError('');
    try {
      const [projectRows, userRows, customerRows] = await Promise.all([
        listProjects(),
        listUsers(),
        listCustomers(),
      ]);
      setRows(projectRows);
      setUsers(userRows);
      setCustomers(customerRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const raw = window.localStorage.getItem(LAYOUT_KEY);
      if (raw) {
        setLayout(JSON.parse(raw) as TableLayout);
      }
    } catch {
      // ignore broken layout cache
    }
  }, []);

  const handleSaveLayout = (nextLayout: TableLayout) => {
    setLayout(nextLayout);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(nextLayout));
    }
  };

  const openCreateDialog = () => {
    setProjectId('');
    setDescription('');
    setCustomerId('');
    setPaymentTerm('');
    setProjectManager('');
    setSalesperson('');
    setTrChargeable(false);
    setTxChargeable(false);
    setError('');
    setCreateOpen(true);
  };

  const openEditDialog = () => {
    if (selected.length !== 1) {
      reportError(t('please_select_one_project_edit', 'Please select one project to edit'));
      return;
    }
    const current = rows.find((row) => String(row.projectid) === selected[0]);
    if (!current) {
      reportError(t('failed_load_projects', 'Failed to load projects'));
      return;
    }
    setProjectId(String(current.projectid ?? ''));
    setDescription(String(current.description ?? ''));
    setCustomerId(String(current.customerid ?? ''));
    setPaymentTerm(String(current.paymentterm ?? ''));
    setProjectManager(String(current.projectmanager ?? ''));
    setSalesperson(String(current.salesperson ?? ''));
    setTrChargeable(normalizeBool(current.trchargeable));
    setTxChargeable(normalizeBool(current.txchargeable));
    setError('');
    setEditOpen(true);
  };

  const saveCreate = async () => {
    const id = projectId.trim();
    const desc = description.trim();
    const customer = customerId.trim();
    if (!id) {
      reportError(t('please_enter_project_id', 'Please enter Project ID'));
      return;
    }
    if (!desc) {
      reportError(t('please_enter_description', 'Please enter Description'));
      return;
    }
    if (!customer) {
      reportError(t('please_enter_customer_id', 'Please enter Customer ID'));
      return;
    }

    setSaving(true);
    setError('');
    try {
      await createProject({
        projectid: id,
        description: desc,
        customerid: customer,
        paymentterm: paymentTerm.trim() || undefined,
        projectmanager: projectManager.trim() || undefined,
        salesperson: salesperson.trim() || undefined,
        trchargeable: trChargeable,
        txchargeable: txChargeable,
      });
      setCreateOpen(false);
      await load();
      showSuccess(t('project_created_success', 'Project created successfully'));
    } catch (err) {
      reportError(err instanceof Error ? err.message : t('failed_create_project', 'Failed to create project'));
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    const id = projectId.trim();
    if (!id) {
      reportError(t('please_enter_project_id', 'Please enter Project ID'));
      return;
    }

    setSaving(true);
    setError('');
    try {
      await changeProject(id, {
        description: description.trim(),
        customerid: customerId.trim() || null,
        paymentterm: paymentTerm.trim() || null,
        projectmanager: projectManager.trim() || null,
        salesperson: salesperson.trim() || null,
        trchargeable: trChargeable,
        txchargeable: txChargeable,
      });
      setEditOpen(false);
      await load();
      showSuccess(t('project_saved_success', 'Project saved successfully'));
    } catch (err) {
      reportError(err instanceof Error ? err.message : t('failed_change_project', 'Failed to change project'));
    } finally {
      setSaving(false);
    }
  };

  const removeSelected = async () => {
    if (selected.length === 0) {
      reportError(t('please_select_projects_delete', 'Please select projects to delete'));
      return;
    }
    if (typeof window !== 'undefined' && !window.confirm(t('confirm_delete_projects', 'Confirm delete selected projects?'))) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      for (const id of selected) {
        await deleteProject(id);
      }
      setSelected([]);
      await load();
      showSuccess(t('project_deleted_success', 'Projects deleted successfully'));
    } catch (err) {
      reportError(err instanceof Error ? err.message : t('failed_delete_project', 'Failed to delete project'));
    } finally {
      setLoading(false);
    }
  };

  const filterFields = useMemo<FilterField[]>(
    () => {
      const buildOptions = (values: string[], mapLabel?: (value: string) => string) =>
        Array.from(new Set(values.filter(Boolean)))
          .sort((a, b) => a.localeCompare(b))
          .map((value) => ({
            value,
            label: mapLabel ? mapLabel(value) : value,
          }));

      const boolValues = ['true', 'false'];
      const customerNameById = new Map(
        customers.map((customer) => [
          String(customer.customerid ?? '').trim(),
          String(customer.customername ?? '').trim(),
        ]),
      );

      return [
        { id: 'projectid', label: t('project_id', 'Project ID'), type: 'text' },
        { id: 'description', label: t('description', 'Description'), type: 'text' },
        {
          id: 'customerid',
          label: t('customer_id', 'Customer ID'),
          type: 'multi-select',
          options: buildOptions(
            rows.map((row) => String(row.customerid ?? '').trim()),
            (value) => {
              const name = customerNameById.get(value) ?? '';
              return name ? `${value} - ${name}` : value;
            },
          ),
        },
        { id: 'paymentterm', label: t('payment_term', 'Payment Term'), type: 'text' },
        {
          id: 'projectmanager',
          label: t('project_manager', 'Project Manager'),
          type: 'multi-select',
          options: buildOptions(rows.map((row) => String(row.projectmanager ?? '').trim())),
        },
        {
          id: 'salesperson',
          label: t('salesperson', 'Salesperson'),
          type: 'multi-select',
          options: buildOptions(rows.map((row) => String(row.salesperson ?? '').trim())),
        },
        {
          id: 'trchargeable',
          label: t('tr_chargeable', 'TR Chargeable'),
          type: 'multi-select',
          options: buildOptions(boolValues, (value) =>
            value === 'true' ? t('yes', 'Yes') : t('no', 'No'),
          ),
        },
        {
          id: 'txchargeable',
          label: t('tx_chargeable', 'TX Chargeable'),
          type: 'multi-select',
          options: buildOptions(boolValues, (value) =>
            value === 'true' ? t('yes', 'Yes') : t('no', 'No'),
          ),
        },
      ];
    },
    [customers, rows, t],
  );

  const filteredRows = useMemo(() => {
    const idFilter = String(appliedFilters.projectid?.value ?? '').trim().toLowerCase();
    const descFilter = String(appliedFilters.description?.value ?? '').trim().toLowerCase();
    const customerFilters = readMultiFilterValues(appliedFilters.customerid?.value);
    const paymentTermFilter = String(appliedFilters.paymentterm?.value ?? '').trim().toLowerCase();
    const pmFilters = readMultiFilterValues(appliedFilters.projectmanager?.value);
    const salespersonFilters = readMultiFilterValues(appliedFilters.salesperson?.value);
    const trChargeableFilters = readMultiFilterValues(appliedFilters.trchargeable?.value);
    const txChargeableFilters = readMultiFilterValues(appliedFilters.txchargeable?.value);

    return rows.filter((row) => {
      const id = String(row.projectid ?? '').trim().toLowerCase();
      const desc = String(row.description ?? '').trim().toLowerCase();
      const customer = String(row.customerid ?? '').trim().toLowerCase();
      const paymentTerm = String(row.paymentterm ?? '').trim().toLowerCase();
      const pm = String(row.projectmanager ?? '').trim().toLowerCase();
      const sales = String(row.salesperson ?? '').trim().toLowerCase();
      const trChargeableText = String(normalizeBool(row.trchargeable)).trim().toLowerCase();
      const txChargeableText = String(normalizeBool(row.txchargeable)).trim().toLowerCase();

      if (idFilter && !id.toLowerCase().includes(idFilter)) {
        return false;
      }
      if (descFilter && !desc.toLowerCase().includes(descFilter)) {
        return false;
      }
      if (customerFilters.length > 0 && !customerFilters.includes(customer)) {
        return false;
      }
      if (paymentTermFilter && !paymentTerm.includes(paymentTermFilter)) {
        return false;
      }
      if (pmFilters.length > 0 && !pmFilters.includes(pm)) {
        return false;
      }
      if (salespersonFilters.length > 0 && !salespersonFilters.includes(sales)) {
        return false;
      }
      if (trChargeableFilters.length > 0 && !trChargeableFilters.includes(trChargeableText)) {
        return false;
      }
      if (txChargeableFilters.length > 0 && !txChargeableFilters.includes(txChargeableText)) {
        return false;
      }
      return true;
    });
  }, [rows, appliedFilters]);

  const columns = useMemo<any[]>(
    () => [
      { id: 'projectid', label: t('project_id', 'Project ID'), minWidth: 180 },
      { id: 'description', label: t('description', 'Description'), minWidth: 280 },
      { id: 'customerid', label: t('customer_id', 'Customer ID'), minWidth: 180 },
      { id: 'paymentterm', label: t('payment_term', 'Payment Term'), minWidth: 180 },
      { id: 'projectmanager', label: t('project_manager', 'Project Manager'), minWidth: 180 },
      { id: 'salesperson', label: t('salesperson', 'Salesperson'), minWidth: 180 },
      {
        id: 'trchargeable',
        label: t('tr_chargeable', 'TR Chargeable'),
        minWidth: 160,
        render: (value: unknown) => (normalizeBool(value) ? t('yes', 'Yes') : t('no', 'No')),
      },
      {
        id: 'txchargeable',
        label: t('tx_chargeable', 'TX Chargeable'),
        minWidth: 160,
        render: (value: unknown) => (normalizeBool(value) ? t('yes', 'Yes') : t('no', 'No')),
      },
    ],
    [t],
  );

  const menuData = useMemo(() => buildPcMenuData(t), [t]);

  const projectManagerOptions = useMemo(
    () =>
      users.map((user) => {
        const userid = String(user.userid ?? '');
        const fullname = [String(user.firstname ?? ''), String(user.lastname ?? '')]
          .join(' ')
          .trim();
        return {
          value: userid,
          label: fullname ? `${userid} - ${fullname}` : userid,
        };
      }),
    [users],
  );

  const salespersonOptions = projectManagerOptions;

  const customerOptions = useMemo(
    () =>
      customers.map((customer) => {
        const customerid = String(customer.customerid ?? '');
        const customername = String(customer.customername ?? '').trim();
        return {
          value: customerid,
          label: customername ? `${customerid} + ${customername}` : customerid,
        };
      }),
    [customers],
  );

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

  const createAction = (
    <Tooltip title={t('create_project', 'Create Project')}>
      <IconButton onClick={openCreateDialog} aria-label={t('create_project', 'Create Project')}>
        <AddRoundedIcon />
      </IconButton>
    </Tooltip>
  );

  const editAction = (
    <Tooltip title={selected.length === 1 ? t('edit_project', 'Edit Project') : t('please_select_one_project_edit', 'Please select one project to edit')}>
      <span>
        <IconButton onClick={openEditDialog} disabled={selected.length !== 1} aria-label={t('edit_project', 'Edit Project')}>
          <EditRoundedIcon />
        </IconButton>
      </span>
    </Tooltip>
  );

  const deleteAction = (
    <Tooltip title={selected.length > 0 ? t('delete_project', 'Delete Project') : t('please_select_projects_delete', 'Please select projects to delete')}>
      <span>
        <IconButton onClick={removeSelected} disabled={selected.length === 0} aria-label={t('delete_project', 'Delete Project')}>
          <DeleteRoundedIcon />
        </IconButton>
      </span>
    </Tooltip>
  );

  if (!sessionUser) {
    return null;
  }

  const tableBusy = loading || saving;

  return (
    <CAppPageLayout
      appTitle={t('projects', 'Project Management')}
      menuData={menuData}
      logo={<HeaderLogo />}
      user={headerUser}
      locale={lang}
      onLocaleChange={(l) => changeLanguage(l as any)}
      localeOptions={['en', 'zh']}
      onUserLogout={() => void performClientLogout({ router, replace: true })}
      contentSx={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      {error ? <Alert severity="error">{error}</Alert> : null}
      <BusyStandardPage
          busy={tableBusy}
          title={t('projects', 'Project Management')}
          hideHeader
          spacing={1}
          filterConfig={{
            appId: 'pc-projects',
            tableKey: 'otto_project',
            variantService,
            fields: filterFields,
            filters,
            onFilterChange: setFilters,
            onSearch: () => setAppliedFilters({ ...filters }),
            onVariantLoad: (v: any) => {
              const variant = v as VariantMetadata;
              const nextFilters =
                (resolveVariantFilters(variant, 'otto_project') as Record<string, FilterValue> | null) ??
                (variant.filters as Record<string, FilterValue> | undefined) ??
                defaultFilters;
              setFilters(nextFilters);
              setAppliedFilters(nextFilters);
            },
          }}
          tableProps={{
            appId: 'pc-projects',
            title: t('projects', 'Project Management'),
            columns,
            rows: filteredRows,
            rowKey: 'projectid',
            fitContainer: true,
            selectionMode: 'multiple',
            selected,
            onSelectionChange: (rowsSelected: unknown[]) => setSelected(rowsSelected.map((x) => String(x))),
            layout: layout ?? undefined,
            onLayoutSave: handleSaveLayout,
            actions: [createAction, editAction, deleteAction],
          }}
        />

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('create_project', 'Create Project')}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField
              label={t('project_id', 'Project ID')}
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              fullWidth
              autoFocus
            />
            <TextField
              label={t('description', 'Description')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('customer_id', 'Customer ID')}
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              fullWidth
              select
              disabled={customerOptions.length === 0}
              helperText={customerOptions.length === 0 ? t('no_customers_available', 'No customers available, please create a customer first') : undefined}
            >
              {customerOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={t('payment_term', 'Payment Term')}
              value={paymentTerm}
              onChange={(e) => setPaymentTerm(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('project_manager', 'Project Manager')}
              value={projectManager}
              onChange={(e) => setProjectManager(e.target.value)}
              fullWidth
              select
              disabled={projectManagerOptions.length === 0}
              helperText={projectManagerOptions.length === 0 ? t('no_users_available', 'No users available, please create a user first') : undefined}
            >
              <MenuItem value="">{t('none', '(None)')}</MenuItem>
              {projectManagerOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={t('salesperson', 'Salesperson')}
              value={salesperson}
              onChange={(e) => setSalesperson(e.target.value)}
              fullWidth
              select
              disabled={salespersonOptions.length === 0}
              helperText={salespersonOptions.length === 0 ? t('no_users_available', 'No users available, please create a user first') : undefined}
            >
              <MenuItem value="">{t('none', '(None)')}</MenuItem>
              {salespersonOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <FormControlLabel
              control={
                <Checkbox
                  checked={trChargeable}
                  onChange={(e) => setTrChargeable(e.target.checked)}
                />
              }
              label={t('tr_chargeable', 'TR Chargeable')}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={txChargeable}
                  onChange={(e) => setTxChargeable(e.target.checked)}
                />
              }
              label={t('tx_chargeable', 'TX Chargeable')}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} disabled={saving}>
            {t('cancel', 'Cancel')}
          </Button>
          <Button onClick={saveCreate} variant="contained" disabled={saving}>
            {t('save', 'Save')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{t('edit_project', 'Edit Project')}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField label={t('project_id', 'Project ID')} value={projectId} fullWidth disabled />
            <TextField
              label={t('description', 'Description')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('customer_id', 'Customer ID')}
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              fullWidth
              select
              disabled={customerOptions.length === 0}
              helperText={customerOptions.length === 0 ? t('no_customers_available', 'No customers available, please create a customer first') : undefined}
            >
              {customerOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={t('payment_term', 'Payment Term')}
              value={paymentTerm}
              onChange={(e) => setPaymentTerm(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('project_manager', 'Project Manager')}
              value={projectManager}
              onChange={(e) => setProjectManager(e.target.value)}
              fullWidth
              select
              disabled={projectManagerOptions.length === 0}
              helperText={projectManagerOptions.length === 0 ? t('no_users_available', 'No users available, please create a user first') : undefined}
            >
              <MenuItem value="">{t('none', '(None)')}</MenuItem>
              {projectManagerOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={t('salesperson', 'Salesperson')}
              value={salesperson}
              onChange={(e) => setSalesperson(e.target.value)}
              fullWidth
              select
              disabled={salespersonOptions.length === 0}
              helperText={salespersonOptions.length === 0 ? t('no_users_available', 'No users available, please create a user first') : undefined}
            >
              <MenuItem value="">{t('none', '(None)')}</MenuItem>
              {salespersonOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <FormControlLabel
              control={
                <Checkbox
                  checked={trChargeable}
                  onChange={(e) => setTrChargeable(e.target.checked)}
                />
              }
              label={t('tr_chargeable', 'TR Chargeable')}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={txChargeable}
                  onChange={(e) => setTxChargeable(e.target.checked)}
                />
              }
              label={t('tx_chargeable', 'TX Chargeable')}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} disabled={saving}>
            {t('cancel', 'Cancel')}
          </Button>
          <Button onClick={saveEdit} variant="contained" disabled={saving}>
            {t('save', 'Save')}
          </Button>
        </DialogActions>
      </Dialog>
      {messageBox}
    </CAppPageLayout>
  );
}
