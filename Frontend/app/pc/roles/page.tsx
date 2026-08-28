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
import ManageAccountsRoundedIcon from '@mui/icons-material/ManageAccountsRounded';
import { CAppPageLayout, resolveVariantFilters } from 'orbcafe-ui';
import type { FilterField, FilterValue } from '@/components/Structures/CSmartFilter';
import type { TableLayout } from '@/components/Structures/CTable/types';
import { useRouter } from 'next/navigation';
import { usePcI18n } from '../_components/PcI18nProvider';
import { getSessionUser, type SessionUser } from '../_components/session';
import { useMessageBox } from '../_components/useMessageBox';
import { listRoles, type RoleRecord } from '../../../services/Role/list';
import { listUsers, listUserRoles, type UserListRow } from '../../../services/User/list';
import { assignRole } from '../../../services/User/assignrole';
import { removeRole } from '../../../services/User/removerole';
import { variantService } from '../../../services/common/variant-service';
import { createRole } from '../../../services/Role/create';
import { buildPcMenuData, HeaderLogo } from '../_components/nav';
import { BusyStandardPage, BusyTable } from '../_components/TableLoadingMarquee';
import type { VariantMetadata } from '@/components/Molecules/CVariantManagement';
import { PcContentLayout } from '../_components/PcContentLayout';
import { performClientLogout } from '../../../services/Auth/logoutClient';

const defaultFilters: Record<string, FilterValue> = {
  roleid: { value: '', operator: 'contains' },
  description: { value: '', operator: 'contains' },
};

export default function RolesPage() {
  const router = useRouter();
  const { t, lang, changeLanguage } = usePcI18n();
  const { showError, showSuccess, messageBox } = useMessageBox(t);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);

  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [users, setUsers] = useState<UserListRow[]>([]);
  const [userRoles, setUserRoles] = useState<Array<{ userid: string; roleid: string }>>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [layout, setLayout] = useState<TableLayout | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<Record<string, FilterValue>>(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<Record<string, FilterValue>>(defaultFilters);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [savingRole, setSavingRole] = useState(false);
  const [savingUsers, setSavingUsers] = useState(false);
  const [newRoleId, setNewRoleId] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [targetRoleId, setTargetRoleId] = useState<string>('');
  const [initialUserIds, setInitialUserIds] = useState<string[]>([]);
  const [userSelection, setUserSelection] = useState<string[]>([]);
  const LAYOUT_KEY = 'pc_roles_default_layout_v1';

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
      const [rolesData, usersData, userRoleData] = await Promise.all([
        listRoles(),
        listUsers(),
        listUserRoles(),
      ]);
      setRoles(rolesData);
      setUsers(usersData);
      setUserRoles(
        userRoleData.map((x) => ({
          userid: String(x.userid ?? ''),
          roleid: String(x.roleid ?? ''),
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roles');
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

  const openCreateRoleDialog = () => {
    setError('');
    setNewRoleId('');
    setNewRoleDescription('');
    setCreateDialogOpen(true);
  };

  const closeCreateRoleDialog = () => {
    setCreateDialogOpen(false);
  };

  const roleUserMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const row of userRoles) {
      if (!row.roleid) {
        continue;
      }
      if (!map[row.roleid]) {
        map[row.roleid] = [];
      }
      map[row.roleid].push(row.userid);
    }
    return map;
  }, [userRoles]);

  const openAssignUsersDialog = () => {
    if (selected.length !== 1) {
      reportError(t('please_select_one_role_assign', 'Please select one role to assign users'));
      return;
    }
    const roleId = selected[0];
    const assigned = roleUserMap[roleId] ?? [];
    setTargetRoleId(roleId);
    setInitialUserIds(assigned);
    setUserSelection(assigned);
    setAssignDialogOpen(true);
  };

  const closeAssignUsersDialog = () => {
    setAssignDialogOpen(false);
    setTargetRoleId('');
    setInitialUserIds([]);
    setUserSelection([]);
  };

  const saveCreateRole = async () => {
    const roleid = newRoleId.trim();
    const description = newRoleDescription.trim();
    if (!roleid) {
      reportError(t('please_enter_role_id', 'Please enter Role ID'));
      return;
    }

    setSavingRole(true);
    setError('');
    try {
      await createRole({ roleid, description });
      closeCreateRoleDialog();
      await load();
      showSuccess(t('role_created_success', 'Role created successfully'));
    } catch (err) {
      reportError(err instanceof Error ? err.message : t('failed_create_role', 'Failed to create role'));
    } finally {
      setSavingRole(false);
    }
  };

  const saveAssignedUsers = async () => {
    if (!targetRoleId) {
      return;
    }

    setSavingUsers(true);
    setError('');
    try {
      const before = new Set(initialUserIds);
      const after = new Set(userSelection);
      const toAdd = [...after].filter((userId) => !before.has(userId));
      const toRemove = [...before].filter((userId) => !after.has(userId));

      await Promise.all([
        ...toAdd.map((userId) => assignRole({ userid: userId, roleid: targetRoleId })),
        ...toRemove.map((userId) => removeRole(userId, targetRoleId)),
      ]);

      const latestUserRoles = await listUserRoles();
      setUserRoles(
        latestUserRoles.map((x) => ({
          userid: String(x.userid ?? ''),
          roleid: String(x.roleid ?? ''),
        })),
      );
      closeAssignUsersDialog();
      showSuccess(t('users_assigned_success', 'Users assigned successfully'));
    } catch (err) {
      reportError(err instanceof Error ? err.message : t('failed_assign_users', 'Failed to assign users'));
    } finally {
      setSavingUsers(false);
    }
  };

  const filterFields = useMemo<FilterField[]>(
    () => [
      { id: 'roleid', label: t('role_id', 'Role ID'), type: 'text' },
      { id: 'description', label: t('description', 'Description'), type: 'text' },
    ],
    [t],
  );

  const rows = useMemo<RoleRecord[]>(() => {
    const roleIdFilter = String(appliedFilters.roleid?.value ?? '').trim().toLowerCase();
    const descriptionFilter = String(appliedFilters.description?.value ?? '').trim().toLowerCase();

    return roles.filter((role) => {
      const roleId = String(role.roleid ?? '');
      const description = String(role.description ?? '');
      if (roleIdFilter && !roleId.toLowerCase().includes(roleIdFilter)) {
        return false;
      }
      if (descriptionFilter && !description.toLowerCase().includes(descriptionFilter)) {
        return false;
      }
      return true;
    });
  }, [roles, appliedFilters]);

  const columns = useMemo<any[]>(
    () => [
      { id: 'roleid', label: t('role_id', 'Role ID'), minWidth: 220 },
      { id: 'description', label: t('description', 'Description'), minWidth: 320 },
    ],
    [],
  );

  const userColumns = useMemo<any[]>(
    () => [
      { id: 'userid', label: t('user_id', 'User ID'), minWidth: 180 },
      { id: 'email', label: t('email', 'Email'), minWidth: 240 },
      { id: 'firstname', label: t('first_name', 'First Name'), minWidth: 160 },
      { id: 'lastname', label: t('last_name', 'Last Name'), minWidth: 160 },
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

  const createRoleAction = (
    <Tooltip title={t('create_role', 'Create Role')}>
      <IconButton onClick={openCreateRoleDialog} aria-label={t('create_role', 'Create Role')}>
        <AddRoundedIcon />
      </IconButton>
    </Tooltip>
  );

  const assignUserAction = (
    <Tooltip title={selected.length === 1 ? t('assign_users', 'Assign Users') : t('please_select_one_role_assign', 'Please select one role to assign users')}>
      <span>
        <IconButton onClick={openAssignUsersDialog} disabled={selected.length !== 1} aria-label={t('assign_users', 'Assign Users')}>
          <ManageAccountsRoundedIcon />
        </IconButton>
      </span>
    </Tooltip>
  );

  if (!sessionUser) {
    return null;
  }

  const tableBusy = loading || savingRole || savingUsers;

  return (
    <PcContentLayout
      contentSx={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      {error ? <Alert severity="error">{error}</Alert> : null}
      <BusyStandardPage
          busy={tableBusy}
          title={t('roles', 'Role Management')}
          hideHeader
          spacing={1}
          filterConfig={{
            appId: 'pc-roles',
            tableKey: 'otto_role',
            variantService,
            fields: filterFields,
            filters,
            onFilterChange: setFilters,
            onSearch: () => setAppliedFilters({ ...filters }),
            onVariantLoad: (v: any) => {
              const variant = v as VariantMetadata;
              const nextFilters =
                (resolveVariantFilters(variant, 'otto_role') as Record<string, FilterValue> | null) ??
                (variant.filters as Record<string, FilterValue> | undefined) ??
                defaultFilters;
              setFilters(nextFilters);
              setAppliedFilters(nextFilters);
            },
          }}
          tableProps={{
            appId: 'pc-roles',
            title: t('roles', 'Role Management'),
            columns,
            rows,
            rowKey: 'roleid',
            fitContainer: true,
            selectionMode: 'multiple',
            selected,
            onSelectionChange: (rowsSelected: unknown[]) =>
              setSelected(rowsSelected.map((item) => String(item))),
            layout: layout ?? undefined,
            onLayoutSave: handleSaveLayout,
            actions: [createRoleAction, assignUserAction],
          }}
        />
      <Dialog open={createDialogOpen} onClose={closeCreateRoleDialog} fullWidth maxWidth="sm">
        <DialogTitle>{t('create_role', 'Create Role')}</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            <TextField
              label={t('role_id', 'Role ID')}
              value={newRoleId}
              onChange={(e) => setNewRoleId(e.target.value)}
              fullWidth
              autoFocus
            />
            <TextField
              label={t('description', 'Description')}
              value={newRoleDescription}
              onChange={(e) => setNewRoleDescription(e.target.value)}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeCreateRoleDialog} disabled={savingRole}>
            {t('cancel', 'Cancel')}
          </Button>
          <Button onClick={saveCreateRole} variant="contained" disabled={savingRole}>
            {t('save', 'Save')}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={assignDialogOpen} onClose={closeAssignUsersDialog} fullWidth maxWidth="lg">
        <DialogTitle>{`${t('assign_users', 'Assign Users')} - ${targetRoleId || ''}`}</DialogTitle>
        <DialogContent>
          <Box sx={{ '& .MuiToolbar-root': { display: 'none' } }}>
            <BusyTable
              appId="pc-roles"
              busy={loading || savingUsers}
              title={t('user_selection', 'User Selection')}
              columns={userColumns}
              rows={users}
              rowKey="userid"
              fullWidth
              selectionMode="multiple"
              selected={userSelection}
              onSelectionChange={(rowsSelected: unknown[]) =>
                setUserSelection(rowsSelected.map((item) => String(item)))
              }
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAssignUsersDialog} disabled={savingUsers}>
            {t('cancel', 'Cancel')}
          </Button>
          <Button onClick={saveAssignedUsers} variant="contained" disabled={savingUsers}>
            {t('save', 'Save')}
          </Button>
        </DialogActions>
      </Dialog>
      {messageBox}
    </PcContentLayout>
  );
}
