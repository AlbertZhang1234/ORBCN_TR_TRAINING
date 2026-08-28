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
import ManageAccountsRoundedIcon from '@mui/icons-material/ManageAccountsRounded';
import LockResetRoundedIcon from '@mui/icons-material/LockResetRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import {
  CAppPageLayout,
  resolveVariantFilters,
} from 'orbcafe-ui';
import type { FilterField, FilterValue } from '@/components/Structures/CSmartFilter';
import type { TableLayout } from '@/components/Structures/CTable/types';
import { usePcI18n } from '../_components/PcI18nProvider';
import { getSessionUser, type SessionUser } from '../_components/session';
import { useMessageBox } from '../_components/useMessageBox';
import { listUsers, listUserRoles, UserListRow } from '../../../services/User/list';
import { variantService } from '../../../services/common/variant-service';
import { useRouter } from 'next/navigation';
import { listRoles, type RoleRecord } from '../../../services/Role/list';
import { assignRole } from '../../../services/User/assignrole';
import { removeRole } from '../../../services/User/removerole';
import { resetPassword } from '../../../services/User/resetpassword';
import { createUser } from '../../../services/User/create';
import { changeUser } from '../../../services/User/change';
import { buildPcMenuData, HeaderLogo } from '../_components/nav';
import { BusyStandardPage, BusyTable } from '../_components/TableLoadingMarquee';
import type { VariantMetadata } from '@/components/Molecules/CVariantManagement';
import { PcContentLayout } from '../_components/PcContentLayout';
import { performClientLogout } from '../../../services/Auth/logoutClient';

const defaultFilters: Record<string, FilterValue> = {
  userid: { value: '', operator: 'contains' },
  email: { value: '', operator: 'contains' },
  firstname: { value: '', operator: 'contains' },
  lastname: { value: '', operator: 'contains' },
  mobile: { value: '', operator: 'contains' },
  sap_supplier_id: { value: '', operator: 'contains' },
};

export default function UsersPage() {
  const router = useRouter();
  const { t, lang, changeLanguage } = usePcI18n();
  const { showError, showSuccess, messageBox } = useMessageBox(t);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);

  const [users, setUsers] = useState<UserListRow[]>([]);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [userRoles, setUserRoles] = useState<Array<{ userid: string; roleid: string }>>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [layout, setLayout] = useState<TableLayout | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingRoles, setSavingRoles] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<Record<string, FilterValue>>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<Record<string, FilterValue>>(defaultFilters);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [initialRoleIds, setInitialRoleIds] = useState<string[]>([]);
  const [roleSelection, setRoleSelection] = useState<string[]>([]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [savingEditUser, setSavingEditUser] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserFirstname, setNewUserFirstname] = useState('');
  const [newUserLastname, setNewUserLastname] = useState('');
  const [newUserMobile, setNewUserMobile] = useState('');
  const [newUserSapSupplierId, setNewUserSapSupplierId] = useState('');
  const [editUserId, setEditUserId] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserFirstname, setEditUserFirstname] = useState('');
  const [editUserLastname, setEditUserLastname] = useState('');
  const [editUserMobile, setEditUserMobile] = useState('');
  const [editUserSapSupplierId, setEditUserSapSupplierId] = useState('');
  const LAYOUT_KEY = 'pc_users_default_layout_v1';

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
      const [usersData, rolesData, userRoleData] = await Promise.all([
        listUsers(),
        listRoles(),
        listUserRoles(),
      ]);
      setUsers(usersData);
      setRoles(rolesData);
      setUserRoles(
        userRoleData.map((x) => ({
          userid: String(x.userid ?? ''),
          roleid: String(x.roleid ?? ''),
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
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
      // ignore broken saved layout
    }
  }, []);

  const handleSaveLayout = (nextLayout: TableLayout) => {
    setLayout(nextLayout);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(nextLayout));
    }
  };

  const userRoleMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const row of userRoles) {
      if (!row.userid) {
        continue;
      }
      if (!map[row.userid]) {
        map[row.userid] = [];
      }
      map[row.userid].push(row.roleid);
    }
    return map;
  }, [userRoles]);

  const openAssignRolesDialog = () => {
    if (selected.length !== 1) {
      reportError(t('please_select_one_user_assign', 'Please select one user to assign roles'));
      return;
    }
    const userId = selected[0];
    const assigned = userRoleMap[userId] ?? [];
    setTargetUserId(userId);
    setInitialRoleIds(assigned);
    setRoleSelection(assigned);
    setAssignDialogOpen(true);
  };

  const closeAssignRolesDialog = () => {
    setAssignDialogOpen(false);
    setTargetUserId('');
    setInitialRoleIds([]);
    setRoleSelection([]);
  };

  const openResetPasswordDialog = () => {
    if (selected.length !== 1) {
      reportError(t('please_select_one_user_reset', 'Please select one user to reset password'));
      return;
    }
    setTargetUserId(selected[0]);
    setNewPassword('');
    setConfirmPassword('');
    setResetDialogOpen(true);
  };

  const closeResetPasswordDialog = () => {
    setResetDialogOpen(false);
    setNewPassword('');
    setConfirmPassword('');
  };

  const openCreateUserDialog = () => {
    setError('');
    setNewUserId('');
    setNewUserEmail('');
    setNewUserFirstname('');
    setNewUserLastname('');
    setNewUserMobile('');
    setNewUserSapSupplierId('');
    setCreateDialogOpen(true);
  };

  const closeCreateUserDialog = () => {
    setCreateDialogOpen(false);
  };

  const openEditUserDialog = () => {
    if (selected.length !== 1) {
      reportError(t('please_select_one_user_edit', 'Please select one user to edit'));
      return;
    }
    const current = users.find((user) => String(user.userid ?? '') === selected[0]);
    if (!current) {
      reportError(t('failed_load_users', 'Failed to load users'));
      return;
    }
    setEditUserId(String(current.userid ?? ''));
    setEditUserEmail(String(current.email ?? ''));
    setEditUserFirstname(String(current.firstname ?? ''));
    setEditUserLastname(String(current.lastname ?? ''));
    setEditUserMobile(String(current.mobile ?? ''));
    setEditUserSapSupplierId(String(current.sap_supplier_id ?? ''));
    setError('');
    setEditDialogOpen(true);
  };

  const closeEditUserDialog = () => {
    setEditDialogOpen(false);
  };

  const saveAssignedRoles = async () => {
    if (!targetUserId) {
      return;
    }

    setSavingRoles(true);
    setError('');
    try {
      const before = new Set(initialRoleIds);
      const after = new Set(roleSelection);
      const toAdd = [...after].filter((roleId) => !before.has(roleId));
      const toRemove = [...before].filter((roleId) => !after.has(roleId));

      await Promise.all([
        ...toAdd.map((roleId) => assignRole({ userid: targetUserId, roleid: roleId })),
        ...toRemove.map((roleId) => removeRole(targetUserId, roleId)),
      ]);

      const latestUserRoles = await listUserRoles();
      setUserRoles(
        latestUserRoles.map((x) => ({
          userid: String(x.userid ?? ''),
          roleid: String(x.roleid ?? ''),
        })),
      );
      closeAssignRolesDialog();
      showSuccess(t('roles_saved_success', 'Roles saved successfully'));
    } catch (err) {
      reportError(err instanceof Error ? err.message : t('failed_assign_roles', 'Failed to assign roles'));
    } finally {
      setSavingRoles(false);
    }
  };

  const saveResetPassword = async () => {
    if (!targetUserId) {
      return;
    }
    if (!newPassword.trim()) {
      reportError(t('please_enter_new_password', 'Please enter new password'));
      return;
    }
    if (newPassword.length < 8) {
      reportError(t('password_min_length', 'Password must be at least 8 characters'));
      return;
    }
    if (newPassword !== confirmPassword) {
      reportError(t('passwords_do_not_match', 'Passwords do not match'));
      return;
    }

    setSavingPassword(true);
    setError('');
    try {
      await resetPassword(targetUserId, newPassword);
      closeResetPasswordDialog();
      showSuccess(t('password_reset_success', 'Password reset successfully'));
    } catch (err) {
      reportError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setSavingPassword(false);
    }
  };

  const saveCreateUser = async () => {
    const userid = newUserId.trim();
    const email = newUserEmail.trim();
    const firstname = newUserFirstname.trim();
    const lastname = newUserLastname.trim();
    const mobile = newUserMobile.trim();
    const sap_supplier_id = newUserSapSupplierId.trim();

    if (!userid) {
      reportError(t('please_enter_user_id', 'Please enter User ID'));
      return;
    }

    if (!email) {
      reportError(t('please_enter_email', 'Please enter Email'));
      return;
    }

    setSavingUser(true);
    setError('');
    try {
      await createUser({
        userid,
        email,
        firstname,
        lastname,
        mobile,
        sap_supplier_id,
        password: userid,
      });
      closeCreateUserDialog();
      await load();
      showSuccess(t('user_created_success', 'User created successfully'));
    } catch (err) {
      reportError(err instanceof Error ? err.message : t('failed_create_user', 'Failed to create user'));
    } finally {
      setSavingUser(false);
    }
  };

  const saveEditUser = async () => {
    const userId = editUserId.trim();
    const email = editUserEmail.trim();
    const sap_supplier_id = editUserSapSupplierId.trim();
    if (!userId) {
      reportError(t('please_select_one_user_edit', 'Please select one user to edit'));
      return;
    }
    if (!email) {
      reportError(t('please_enter_email', 'Please enter Email'));
      return;
    }
    if (sap_supplier_id.length > 10) {
      reportError(t('sap_supplier_id_max_length', 'SAP Supplier ID must not exceed 10 characters'));
      return;
    }

    setSavingEditUser(true);
    setError('');
    try {
      await changeUser(userId, {
        email,
        firstname: editUserFirstname.trim(),
        lastname: editUserLastname.trim(),
        mobile: editUserMobile.trim(),
        sap_supplier_id,
      });
      closeEditUserDialog();
      setSelected([]);
      await load();
      showSuccess(t('user_saved_success', 'User saved successfully'));
    } catch (err) {
      reportError(err instanceof Error ? err.message : t('failed_change_user', 'Failed to change user'));
    } finally {
      setSavingEditUser(false);
    }
  };

  const filterFields = useMemo<FilterField[]>(
    () => [
      { id: 'userid', label: t('user_id', 'User ID'), type: 'text' },
      { id: 'email', label: t('email', 'Email'), type: 'text' },
      { id: 'firstname', label: t('first_name', 'First Name'), type: 'text' },
      { id: 'lastname', label: t('last_name', 'Last Name'), type: 'text' },
      { id: 'mobile', label: t('mobile', 'Mobile'), type: 'text' },
      { id: 'sap_supplier_id', label: t('sap_supplier_id', 'SAP Supplier ID'), type: 'text' },
    ],
    [t],
  );

  const rows = useMemo<UserListRow[]>(() => {
    const useridFilter = String(appliedFilters.userid?.value ?? '').trim().toLowerCase();
    const emailFilter = String(appliedFilters.email?.value ?? '').trim().toLowerCase();
    const firstnameFilter = String(appliedFilters.firstname?.value ?? '').trim().toLowerCase();
    const lastnameFilter = String(appliedFilters.lastname?.value ?? '').trim().toLowerCase();
    const mobileFilter = String(appliedFilters.mobile?.value ?? '').trim().toLowerCase();
    const sapSupplierIdFilter = String(appliedFilters.sap_supplier_id?.value ?? '').trim().toLowerCase();

    return users
      .filter((user) => {
        const userId = String(user.userid ?? '');
        const email = String(user.email ?? '');
        const firstname = String(user.firstname ?? '');
        const lastname = String(user.lastname ?? '');
        const mobile = String(user.mobile ?? '');
        const sapSupplierId = String(user.sap_supplier_id ?? '');

        if (useridFilter && !userId.toLowerCase().includes(useridFilter)) {
          return false;
        }
        if (emailFilter && !email.toLowerCase().includes(emailFilter)) {
          return false;
        }
        if (firstnameFilter && !firstname.toLowerCase().includes(firstnameFilter)) {
          return false;
        }
        if (lastnameFilter && !lastname.toLowerCase().includes(lastnameFilter)) {
          return false;
        }
        if (mobileFilter && !mobile.toLowerCase().includes(mobileFilter)) {
          return false;
        }
        if (sapSupplierIdFilter && !sapSupplierId.toLowerCase().includes(sapSupplierIdFilter)) {
          return false;
        }

        return true;
      });
  }, [users, appliedFilters]);

  const columns = useMemo<any[]>(
    () => [
      { id: 'userid', label: t('user_id', 'User ID'), minWidth: 140 },
      { id: 'email', label: t('email', 'Email'), minWidth: 220 },
      { id: 'firstname', label: t('first_name', 'First Name'), minWidth: 160 },
      { id: 'lastname', label: t('last_name', 'Last Name'), minWidth: 160 },
      { id: 'mobile', label: t('mobile', 'Mobile'), minWidth: 150 },
      { id: 'sap_supplier_id', label: t('sap_supplier_id', 'SAP Supplier ID'), minWidth: 180 },
    ],
    [t],
  );

  const roleColumns = useMemo<any[]>(
    () => [
      { id: 'roleid', label: t('role_id', 'Role ID'), minWidth: 180 },
      { id: 'description', label: t('description', 'Description'), minWidth: 260 },
    ],
    [],
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

  const assignRoleAction = (
    <Tooltip title={selected.length === 1 ? t('assign_roles', 'Assign Roles') : t('please_select_one_user_assign', 'Please select one user to assign roles')}>
      <span>
        <IconButton onClick={openAssignRolesDialog} disabled={selected.length !== 1} aria-label={t('assign_roles', 'Assign Roles')}>
          <ManageAccountsRoundedIcon />
        </IconButton>
      </span>
    </Tooltip>
  );

  const resetPasswordAction = (
    <Tooltip title={selected.length === 1 ? t('reset_password', 'Reset Password') : t('please_select_one_user_reset', 'Please select one user to reset password')}>
      <span>
        <IconButton
          onClick={openResetPasswordDialog}
          disabled={selected.length !== 1}
          aria-label={t('reset_password', 'Reset Password')}
        >
          <LockResetRoundedIcon />
        </IconButton>
      </span>
    </Tooltip>
  );

  const createUserAction = (
    <Tooltip title={t('create_user', 'Create User')}>
      <IconButton onClick={openCreateUserDialog} aria-label={t('create_user', 'Create User')}>
        <AddRoundedIcon />
      </IconButton>
    </Tooltip>
  );

  const editUserAction = (
    <Tooltip title={selected.length === 1 ? t('edit_user', 'Edit User') : t('please_select_one_user_edit', 'Please select one user to edit')}>
      <span>
        <IconButton onClick={openEditUserDialog} disabled={selected.length !== 1} aria-label={t('edit_user', 'Edit User')}>
          <EditRoundedIcon />
        </IconButton>
      </span>
    </Tooltip>
  );

  if (!sessionUser) {
    return null;
  }

  const tableBusy = loading || savingRoles || savingPassword || savingUser || savingEditUser;

  return (
    <PcContentLayout
      contentSx={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      {error ? <Alert severity="error">{error}</Alert> : null}
      <BusyStandardPage
          busy={tableBusy}
          title={t('users', 'User Management')}
          hideHeader
          spacing={1}
          filterConfig={{
            appId: 'pc-users',
            tableKey: 'otto_user',
            variantService,
            fields: filterFields,
            filters,
            onFilterChange: setFilters,
            onSearch: () => setAppliedFilters({ ...filters }),
            onVariantLoad: (v: any) => {
              const variant = v as VariantMetadata;
              const nextFilters =
                (resolveVariantFilters(variant, 'otto_user') as Record<string, FilterValue> | null) ??
                (variant.filters as Record<string, FilterValue> | undefined) ??
                defaultFilters;
              setFilters(nextFilters);
              setAppliedFilters(nextFilters);
            },
          }}
          tableProps={{
            appId: 'pc-users',
            title: t('users', 'User Management'),
            columns,
            rows,
            rowKey: 'userid',
            fitContainer: true,
            selectionMode: 'single',
            selected,
            onSelectionChange: (rowsSelected: unknown[]) =>
              setSelected(rowsSelected.map((item) => String(item))),
            layout: layout ?? undefined,
            onLayoutSave: handleSaveLayout,
            actions: [createUserAction, editUserAction, assignRoleAction, resetPasswordAction],
          }}
        />
      <Dialog open={createDialogOpen} onClose={closeCreateUserDialog} fullWidth maxWidth="sm">
        <DialogTitle>{t('create_user', 'Create User')}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField
              label={t('user_id', 'User ID')}
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value)}
              fullWidth
              autoFocus
            />
            <TextField
              label={t('email', 'Email')}
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('first_name', 'First Name')}
              value={newUserFirstname}
              onChange={(e) => setNewUserFirstname(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('last_name', 'Last Name')}
              value={newUserLastname}
              onChange={(e) => setNewUserLastname(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('mobile', 'Mobile')}
              value={newUserMobile}
              onChange={(e) => setNewUserMobile(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('sap_supplier_id', 'SAP Supplier ID')}
              value={newUserSapSupplierId}
              onChange={(e) => setNewUserSapSupplierId(e.target.value)}
              inputProps={{ maxLength: 10 }}
              fullWidth
            />
            <Alert severity="info" sx={{ mt: 1 }}>
              {t('initial_password_notice', 'Initial password defaults to User ID. You can change it later using "Reset Password".')}
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeCreateUserDialog} disabled={savingUser}>
            {t('cancel', 'Cancel')}
          </Button>
          <Button onClick={saveCreateUser} variant="contained" disabled={savingUser}>
            {t('save', 'Save')}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={editDialogOpen} onClose={closeEditUserDialog} fullWidth maxWidth="sm">
        <DialogTitle>{t('edit_user', 'Edit User')}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField label={t('user_id', 'User ID')} value={editUserId} fullWidth disabled />
            <TextField
              label={t('email', 'Email')}
              value={editUserEmail}
              onChange={(e) => setEditUserEmail(e.target.value)}
              fullWidth
              autoFocus
            />
            <TextField
              label={t('first_name', 'First Name')}
              value={editUserFirstname}
              onChange={(e) => setEditUserFirstname(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('last_name', 'Last Name')}
              value={editUserLastname}
              onChange={(e) => setEditUserLastname(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('mobile', 'Mobile')}
              value={editUserMobile}
              onChange={(e) => setEditUserMobile(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('sap_supplier_id', 'SAP Supplier ID')}
              value={editUserSapSupplierId}
              onChange={(e) => setEditUserSapSupplierId(e.target.value)}
              inputProps={{ maxLength: 10 }}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEditUserDialog} disabled={savingEditUser}>
            {t('cancel', 'Cancel')}
          </Button>
          <Button onClick={saveEditUser} variant="contained" disabled={savingEditUser}>
            {t('save', 'Save')}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={assignDialogOpen} onClose={closeAssignRolesDialog} fullWidth maxWidth="md">
        <DialogTitle>{t('assign_users_title', 'Assign Users - {0}').replace('{0}', targetUserId || '')}</DialogTitle>
        <DialogContent>
            <Box sx={{ '& .MuiToolbar-root': { display: 'none' } }}>
            <BusyTable
              appId="pc-users"
              busy={loading || savingRoles}
              title={t('role_selection', 'Role Selection')}
              columns={roleColumns}
              rows={roles}
              rowKey="roleid"
              fullWidth
              selectionMode="multiple"
              selected={roleSelection}
              onSelectionChange={(rowsSelected: unknown[]) =>
                setRoleSelection(rowsSelected.map((item) => String(item)))
              }
            />
            </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAssignRolesDialog} disabled={savingRoles}>
            {t('cancel', 'Cancel')}
          </Button>
          <Button onClick={saveAssignedRoles} variant="contained" disabled={savingRoles}>
            {t('save', 'Save')}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={resetDialogOpen} onClose={closeResetPasswordDialog} fullWidth maxWidth="sm">
        <DialogTitle>{`${t('reset_password', 'Reset Password')} - ${targetUserId || ''}`}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField
              label={t('new_password', 'New Password')}
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              fullWidth
              autoFocus
            />
            <TextField
              label={t('confirm_password', 'Confirm Password')}
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeResetPasswordDialog} disabled={savingPassword}>
            {t('cancel', 'Cancel')}
          </Button>
          <Button onClick={saveResetPassword} variant="contained" disabled={savingPassword}>
            {t('save', 'Save')}
          </Button>
        </DialogActions>
      </Dialog>
      {messageBox}
    </PcContentLayout>
  );
}
