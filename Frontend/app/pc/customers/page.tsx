'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
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
import { listCustomers, type CustomerListRow } from '../../../services/Customer/list';
import { createCustomer } from '../../../services/Customer/create';
import { changeCustomer } from '../../../services/Customer/change';
import { deleteCustomer } from '../../../services/Customer/delete';
import { BusyStandardPage } from '../_components/TableLoadingMarquee';
import { PcContentLayout } from '../_components/PcContentLayout';
import type { VariantMetadata } from '@/components/Molecules/CVariantManagement';

const defaultFilters: Record<string, FilterValue> = {
  customerid: { value: '', operator: 'contains' },
  customername: { value: [], operator: 'anyOf' },
  taxcode: { value: '', operator: 'contains' },
  contactperson: { value: [], operator: 'anyOf' },
  mobile: { value: '', operator: 'contains' },
  email: { value: '', operator: 'contains' },
  language: { value: [], operator: 'anyOf' },
  actualpaymentterm: { value: '', operator: 'contains' },
  bankaccount: { value: '', operator: 'contains' },
};

function readMultiFilterValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
  }
  const single = String(value ?? '').trim().toLowerCase();
  return single ? [single] : [];
}

export default function CustomersPage() {
  const router = useRouter();
  const { t, lang, changeLanguage } = usePcI18n();
  const { showError, showSuccess, messageBox } = useMessageBox(t);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);

  const [rows, setRows] = useState<CustomerListRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [layout, setLayout] = useState<TableLayout | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<Record<string, FilterValue>>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<Record<string, FilterValue>>(defaultFilters);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [address, setAddress] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [mobile, setMobile] = useState('');
  const [fullnameZh, setFullnameZh] = useState('');
  const [fullnameEn, setFullnameEn] = useState('');
  const [email, setEmail] = useState('');
  const [language, setLanguage] = useState('');
  const [actualPaymentTerm, setActualPaymentTerm] = useState('');
  const [bankAccount, setBankAccount] = useState('');

  const LAYOUT_KEY = 'pc_customers_default_layout_v1';

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
      setRows(await listCustomers());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customers');
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
    setCustomerId('');
    setCustomerName('');
    setTaxCode('');
    setAddress('');
    setContactPerson('');
    setMobile('');
    setFullnameZh('');
    setFullnameEn('');
    setEmail('');
    setLanguage('');
    setActualPaymentTerm('');
    setBankAccount('');
    setError('');
    setCreateOpen(true);
  };

  const openEditDialog = () => {
    if (selected.length !== 1) {
      reportError(t('please_select_one_customer_edit', 'Please select one customer to edit'));
      return;
    }
    const current = rows.find((row) => String(row.customerid) === selected[0]);
    if (!current) {
      reportError(t('failed_load_customers', 'Failed to load customers'));
      return;
    }
    setCustomerId(String(current.customerid ?? ''));
    setCustomerName(String(current.customername ?? ''));
    setTaxCode(String(current.taxcode ?? ''));
    setAddress(String(current.address ?? ''));
    setContactPerson(String(current.contactperson ?? ''));
    setMobile(String(current.mobile ?? ''));
    setFullnameZh(String(current.fullname_zh ?? ''));
    setFullnameEn(String(current.fullname_en ?? ''));
    setEmail(String(current.email ?? ''));
    setLanguage(String(current.language ?? ''));
    setActualPaymentTerm(String(current.actualpaymentterm ?? ''));
    setBankAccount(String(current.bankaccount ?? ''));
    setError('');
    setEditOpen(true);
  };

  const saveCreate = async () => {
    const id = customerId.trim();
    if (!id) {
      reportError(t('please_enter_customer_id', 'Please enter Customer ID'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createCustomer({
        customerid: id,
        customername: customerName.trim(),
        taxcode: taxCode.trim(),
        address: address.trim(),
        contactperson: contactPerson.trim(),
        mobile: mobile.trim(),
        fullname_zh: fullnameZh.trim(),
        fullname_en: fullnameEn.trim(),
        email: email.trim(),
        language: language.trim(),
        actualpaymentterm: actualPaymentTerm.trim(),
        bankaccount: bankAccount.trim(),
      });
      setCreateOpen(false);
      await load();
      showSuccess(t('customer_created_success', 'Customer created successfully'));
    } catch (err) {
      reportError(err instanceof Error ? err.message : t('failed_create_customer', 'Failed to create customer'));
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    const id = customerId.trim();
    if (!id) {
      reportError(t('please_enter_customer_id', 'Please enter Customer ID'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await changeCustomer(id, {
        customername: customerName.trim(),
        taxcode: taxCode.trim(),
        address: address.trim(),
        contactperson: contactPerson.trim(),
        mobile: mobile.trim(),
        fullname_zh: fullnameZh.trim(),
        fullname_en: fullnameEn.trim(),
        email: email.trim(),
        language: language.trim(),
        actualpaymentterm: actualPaymentTerm.trim(),
        bankaccount: bankAccount.trim(),
      });
      setEditOpen(false);
      await load();
      showSuccess(t('customer_saved_success', 'Customer saved successfully'));
    } catch (err) {
      reportError(err instanceof Error ? err.message : t('failed_change_customer', 'Failed to change customer'));
    } finally {
      setSaving(false);
    }
  };

  const removeSelected = async () => {
    if (selected.length === 0) {
      reportError(t('please_select_customers_delete', 'Please select customers to delete'));
      return;
    }
    if (typeof window !== 'undefined' && !window.confirm(t('confirm_delete_customers', 'Confirm delete selected customers?'))) {
      return;
    }
    setLoading(true);
    setError('');
    try {
      for (const id of selected) {
        await deleteCustomer(id);
      }
      setSelected([]);
      await load();
      showSuccess(t('customer_deleted_success', 'Customers deleted successfully'));
    } catch (err) {
      reportError(err instanceof Error ? err.message : t('failed_delete_customer', 'Failed to delete customer'));
    } finally {
      setLoading(false);
    }
  };

  const filterFields = useMemo<FilterField[]>(
    () => {
      const buildOptions = (values: string[]) =>
        Array.from(new Set(values.filter(Boolean)))
          .sort((a, b) => a.localeCompare(b))
          .map((value) => ({ value, label: value }));

      return [
        { id: 'customerid', label: t('customer_id', 'Customer ID'), type: 'text' },
        {
          id: 'customername',
          label: t('customer_name', 'Customer Name'),
          type: 'multi-select',
          options: buildOptions(rows.map((row) => String(row.customername ?? '').trim())),
        },
        { id: 'taxcode', label: t('tax_code', 'Tax Code'), type: 'text' },
        {
          id: 'contactperson',
          label: t('contact_person', 'Contact Person'),
          type: 'multi-select',
          options: buildOptions(rows.map((row) => String(row.contactperson ?? '').trim())),
        },
        { id: 'mobile', label: t('mobile', 'Mobile'), type: 'text' },
        { id: 'email', label: t('email', 'Email'), type: 'text' },
        {
          id: 'language',
          label: t('language', 'Language'),
          type: 'multi-select',
          options: buildOptions(rows.map((row) => String(row.language ?? '').trim())),
        },
        { id: 'actualpaymentterm', label: t('actual_payment_term', 'Actual Payment Term'), type: 'text' },
        { id: 'bankaccount', label: t('bank_account', 'Bank Account'), type: 'text' },
      ];
    },
    [rows, t],
  );

  const filteredRows = useMemo(() => {
    const idFilter = String(appliedFilters.customerid?.value ?? '').trim().toLowerCase();
    const nameFilters = readMultiFilterValues(appliedFilters.customername?.value);
    const taxCodeFilter = String(appliedFilters.taxcode?.value ?? '').trim().toLowerCase();
    const contactFilters = readMultiFilterValues(appliedFilters.contactperson?.value);
    const mobileFilter = String(appliedFilters.mobile?.value ?? '').trim().toLowerCase();
    const emailFilter = String(appliedFilters.email?.value ?? '').trim().toLowerCase();
    const languageFilters = readMultiFilterValues(appliedFilters.language?.value);
    const actualPaymentTermFilter = String(appliedFilters.actualpaymentterm?.value ?? '').trim().toLowerCase();
    const bankAccountFilter = String(appliedFilters.bankaccount?.value ?? '').trim().toLowerCase();
    return rows.filter((row) => {
      const id = String(row.customerid ?? '').trim().toLowerCase();
      const name = String(row.customername ?? '').trim().toLowerCase();
      const taxCode = String(row.taxcode ?? '').trim().toLowerCase();
      const contactPerson = String(row.contactperson ?? '').trim().toLowerCase();
      const phone = String(row.mobile ?? '').trim().toLowerCase();
      const emailAddress = String(row.email ?? '').trim().toLowerCase();
      const rowLanguage = String(row.language ?? '').trim().toLowerCase();
      const rowActualPaymentTerm = String(row.actualpaymentterm ?? '').trim().toLowerCase();
      const rowBankAccount = String(row.bankaccount ?? '').trim().toLowerCase();
      if (idFilter && !id.toLowerCase().includes(idFilter)) {
        return false;
      }
      if (nameFilters.length > 0 && !nameFilters.includes(name)) {
        return false;
      }
      if (taxCodeFilter && !taxCode.toLowerCase().includes(taxCodeFilter)) {
        return false;
      }
      if (contactFilters.length > 0 && !contactFilters.includes(contactPerson)) {
        return false;
      }
      if (mobileFilter && !phone.toLowerCase().includes(mobileFilter)) {
        return false;
      }
      if (emailFilter && !emailAddress.toLowerCase().includes(emailFilter)) {
        return false;
      }
      if (languageFilters.length > 0 && !languageFilters.includes(rowLanguage)) {
        return false;
      }
      if (actualPaymentTermFilter && !rowActualPaymentTerm.includes(actualPaymentTermFilter)) {
        return false;
      }
      if (bankAccountFilter && !rowBankAccount.includes(bankAccountFilter)) {
        return false;
      }
      return true;
    });
  }, [rows, appliedFilters]);

  const columns = useMemo<any[]>(
    () => [
      { id: 'customerid', label: t('customer_id', 'Customer ID'), minWidth: 150 },
      { id: 'customername', label: t('customer_name', 'Customer Name'), minWidth: 200 },
      { id: 'taxcode', label: t('tax_code', 'Tax Code'), minWidth: 180 },
      { id: 'address', label: t('address', 'Address'), minWidth: 260 },
      { id: 'contactperson', label: t('contact_person', 'Contact Person'), minWidth: 180 },
      { id: 'mobile', label: t('mobile', 'Mobile'), minWidth: 160 },
      { id: 'fullname_zh', label: t('fullname_zh', 'Full Name (ZH)'), minWidth: 200 },
      { id: 'fullname_en', label: t('fullname_en', 'Full Name (EN)'), minWidth: 200 },
      { id: 'email', label: t('email', 'Email'), minWidth: 200 },
      { id: 'language', label: t('language', 'Language'), minWidth: 140 },
      { id: 'actualpaymentterm', label: t('actual_payment_term', 'Actual Payment Term'), minWidth: 220 },
      { id: 'bankaccount', label: t('bank_account', 'Bank Account'), minWidth: 220 },
    ],
    [t],
  );

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

  const createAction = (
    <Tooltip title={t('create_customer', 'Create Customer')}>
      <IconButton onClick={openCreateDialog} aria-label={t('create_customer', 'Create Customer')}>
        <AddRoundedIcon />
      </IconButton>
    </Tooltip>
  );

  const editAction = (
    <Tooltip title={selected.length === 1 ? t('edit_customer', 'Edit Customer') : t('please_select_one_customer_edit', 'Please select one customer to edit')}>
      <span>
        <IconButton onClick={openEditDialog} disabled={selected.length !== 1} aria-label={t('edit_customer', 'Edit Customer')}>
          <EditRoundedIcon />
        </IconButton>
      </span>
    </Tooltip>
  );

  const deleteAction = (
    <Tooltip title={selected.length > 0 ? t('delete_customer', 'Delete Customer') : t('please_select_customers_delete', 'Please select customers to delete')}>
      <span>
        <IconButton onClick={removeSelected} disabled={selected.length === 0} aria-label={t('delete_customer', 'Delete Customer')}>
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
    <PcContentLayout
      contentSx={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      {error ? <Alert severity="error">{error}</Alert> : null}
      <BusyStandardPage
          busy={tableBusy}
          title={t('customers', 'Customer Management')}
          hideHeader
          spacing={1}
          filterConfig={{
            appId: 'pc-customers',
            tableKey: 'otto_customer',
            variantService,
            fields: filterFields,
            filters,
            onFilterChange: setFilters,
            onSearch: () => setAppliedFilters({ ...filters }),
            onVariantLoad: (v: any) => {
              const variant = v as VariantMetadata;
              const nextFilters =
                (resolveVariantFilters(variant, 'otto_customer') as Record<string, FilterValue> | null) ??
                (variant.filters as Record<string, FilterValue> | undefined) ??
                defaultFilters;
              setFilters(nextFilters);
              setAppliedFilters(nextFilters);
            },
          }}
          tableProps={{
            appId: 'pc-customers',
            title: t('customers', 'Customer Management'),
            columns,
            rows: filteredRows,
            rowKey: 'customerid',
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
        <DialogTitle>{t('create_customer', 'Create Customer')}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField
              label={t('customer_id', 'Customer ID')}
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              fullWidth
              autoFocus
            />
            <TextField
              label={t('customer_name', 'Customer Name')}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('tax_code', 'Tax Code')}
              value={taxCode}
              onChange={(e) => setTaxCode(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('address', 'Address')}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('contact_person', 'Contact Person')}
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('mobile', 'Mobile')}
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('fullname_zh', 'Full Name (ZH)')}
              value={fullnameZh}
              onChange={(e) => setFullnameZh(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('fullname_en', 'Full Name (EN)')}
              value={fullnameEn}
              onChange={(e) => setFullnameEn(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('email', 'Email')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('language', 'Language')}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('actual_payment_term', 'Actual Payment Term')}
              value={actualPaymentTerm}
              onChange={(e) => setActualPaymentTerm(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('bank_account', 'Bank Account')}
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              fullWidth
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
        <DialogTitle>{t('edit_customer', 'Edit Customer')}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField label={t('customer_id', 'Customer ID')} value={customerId} fullWidth disabled />
            <TextField
              label={t('customer_name', 'Customer Name')}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('tax_code', 'Tax Code')}
              value={taxCode}
              onChange={(e) => setTaxCode(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('address', 'Address')}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('contact_person', 'Contact Person')}
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('mobile', 'Mobile')}
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('fullname_zh', 'Full Name (ZH)')}
              value={fullnameZh}
              onChange={(e) => setFullnameZh(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('fullname_en', 'Full Name (EN)')}
              value={fullnameEn}
              onChange={(e) => setFullnameEn(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('email', 'Email')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('language', 'Language')}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('actual_payment_term', 'Actual Payment Term')}
              value={actualPaymentTerm}
              onChange={(e) => setActualPaymentTerm(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('bank_account', 'Bank Account')}
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              fullWidth
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
    </PcContentLayout>
  );
}
