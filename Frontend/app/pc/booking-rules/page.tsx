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
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { useRouter } from 'next/navigation';
import { CAppPageLayout } from 'orbcafe-ui';
import { usePcI18n } from '../_components/PcI18nProvider';
import { getSessionUser, type SessionUser } from '../_components/session';
import { useMessageBox } from '../_components/useMessageBox';
import { buildPcMenuData, HeaderLogo } from '../_components/nav';
import { PcContentLayout } from '../_components/PcContentLayout';
import { performClientLogout } from '../../../services/Auth/logoutClient';
import {
  listBookingRules,
  saveBookingRule,
  type BookingRuleRecord,
} from '../../../services/Invoice/booking-rules';

const emptyRule: BookingRuleRecord = {
  code: '',
  category: 'other',
  name_zh: '',
  name_en: '',
  description: '',
  keywords: [],
  costcenter: '',
  accountingsubject: '',
  sort_order: 0,
  is_active: true,
};

export default function BookingRulesPage() {
  const router = useRouter();
  const { t, lang, changeLanguage } = usePcI18n();
  const { showError, showSuccess, messageBox } = useMessageBox(t);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [rows, setRows] = useState<BookingRuleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [draft, setDraft] = useState<BookingRuleRecord>(emptyRule);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await listBookingRules(false));
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load booking rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const user = getSessionUser();
    if (!user) {
      router.replace('/pc/login');
      return;
    }
    if (!user.permissions?.isAdmin) {
      router.replace('/pc');
      return;
    }
    setSessionUser(user);
    void load();
  }, [router]);

  const openCreate = () => {
    setEditingCode(null);
    setDraft({ ...emptyRule, keywords: [] });
    setDialogOpen(true);
  };

  const openEdit = (row: BookingRuleRecord) => {
    setEditingCode(row.code);
    setDraft({ ...row, keywords: Array.isArray(row.keywords) ? row.keywords : [] });
    setDialogOpen(true);
  };

  const updateDraft = (field: keyof BookingRuleRecord, value: unknown) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveBookingRule(
        { ...draft, code: editingCode ?? draft.code },
        editingCode === null,
      );
      setDialogOpen(false);
      await load();
      showSuccess(t('booking_rule_saved', 'Booking rule saved'));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Failed to save booking rule';
      setError(message);
      showError(message);
    } finally {
      setSaving(false);
    }
  };

  const headerUser = useMemo(() => {
    if (!sessionUser) return undefined;
    const name = [sessionUser.firstname, sessionUser.lastname].filter(Boolean).join(' ') || sessionUser.userid;
    return { name, subtitle: sessionUser.email ?? '', avatarText: name.slice(0, 1).toUpperCase() };
  }, [sessionUser]);

  if (!sessionUser) return null;

  const menuData = buildPcMenuData(t);

  return (
    <PcContentLayout
      contentSx={{ height: '100%', overflow: 'hidden' }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <div style={{ height: '100%' }}>
            <Box sx={{ height: '100%', overflow: 'auto', p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box component="h1" sx={{ fontSize: 22, m: 0 }}>{t('booking_rules', 'Booking Rules')}</Box>
                <Tooltip title={t('create_booking_rule', 'Create Booking Rule')}>
                  <IconButton onClick={openCreate} color="primary"><AddRoundedIcon /></IconButton>
                </Tooltip>
              </Box>
              {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
              <Paper variant="outlined">
                <Table size="small" stickyHeader>
                  <TableHead><TableRow>
                    <TableCell>{t('code', 'Code')}</TableCell><TableCell>{t('category', 'Category')}</TableCell>
                    <TableCell>{t('name', 'Name')}</TableCell><TableCell>{t('cost_center', 'Cost Center')}</TableCell>
                    <TableCell>{t('accounting_subject', 'Accounting Subject')}</TableCell>
                    <TableCell>{t('status', 'Status')}</TableCell><TableCell align="right"> </TableCell>
                  </TableRow></TableHead>
                  <TableBody>
                    {rows.map((row) => <TableRow key={row.code} hover>
                      <TableCell>{row.code}</TableCell><TableCell>{row.category}</TableCell>
                      <TableCell>{row.name_zh}{row.name_en ? ` / ${row.name_en}` : ''}</TableCell>
                      <TableCell>{row.costcenter || '-'}</TableCell><TableCell>{row.accountingsubject || '-'}</TableCell>
                      <TableCell>{row.is_active === false ? t('inactive', 'Inactive') : t('active', 'Active')}</TableCell>
                      <TableCell align="right"><IconButton size="small" onClick={() => openEdit(row)}><EditRoundedIcon fontSize="small" /></IconButton></TableCell>
                    </TableRow>)}
                    {!loading && rows.length === 0 ? <TableRow><TableCell colSpan={7}>{t('no_data', 'No data')}</TableCell></TableRow> : null}
                  </TableBody>
                </Table>
              </Paper>
            </Box>
          </div>
        </Box>
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingCode ? t('edit_booking_rule', 'Edit Booking Rule') : t('create_booking_rule', 'Create Booking Rule')}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: 2 }}>
          <TextField label={t('code', 'Code')} value={draft.code} disabled={Boolean(editingCode)} onChange={(e) => updateDraft('code', e.target.value.toUpperCase())} />
          <TextField select label={t('category', 'Category')} value={draft.category} onChange={(e) => updateDraft('category', e.target.value)}>
            {['transport', 'living', 'office', 'other'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
          </TextField>
          <TextField label={t('name_zh', 'Chinese Name')} value={draft.name_zh} onChange={(e) => updateDraft('name_zh', e.target.value)} />
          <TextField label={t('name_en', 'English Name')} value={draft.name_en ?? ''} onChange={(e) => updateDraft('name_en', e.target.value)} />
          <TextField label={t('description', 'Description')} value={draft.description ?? ''} multiline minRows={2} onChange={(e) => updateDraft('description', e.target.value)} />
          <TextField label={t('keywords', 'Keywords')} value={(draft.keywords ?? []).join(', ')} helperText={t('keywords_hint', 'Separate keywords with commas')} onChange={(e) => updateDraft('keywords', e.target.value.split(',').map((item) => item.trim()).filter(Boolean))} />
          <TextField label={t('cost_center', 'Cost Center')} value={draft.costcenter ?? ''} onChange={(e) => updateDraft('costcenter', e.target.value)} />
          <TextField label={t('accounting_subject', 'Accounting Subject')} value={draft.accountingsubject ?? ''} onChange={(e) => updateDraft('accountingsubject', e.target.value)} />
          <TextField type="number" label={t('sort_order', 'Sort Order')} value={draft.sort_order ?? 0} onChange={(e) => updateDraft('sort_order', Number(e.target.value))} />
          <TextField select label={t('status', 'Status')} value={draft.is_active === false ? 'inactive' : 'active'} onChange={(e) => updateDraft('is_active', e.target.value === 'active')}>
            <MenuItem value="active">{t('active', 'Active')}</MenuItem><MenuItem value="inactive">{t('inactive', 'Inactive')}</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions><Button onClick={() => setDialogOpen(false)} disabled={saving}>{t('cancel', 'Cancel')}</Button><Button onClick={() => void save()} variant="contained" disabled={saving}>{t('save', 'Save')}</Button></DialogActions>
      </Dialog>
      {messageBox}
    </PcContentLayout>
  );
}
