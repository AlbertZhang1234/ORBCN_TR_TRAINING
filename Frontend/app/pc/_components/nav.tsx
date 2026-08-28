'use client';

import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import DatasetRoundedIcon from '@mui/icons-material/DatasetRounded';
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import FlightTakeoffRoundedIcon from '@mui/icons-material/FlightTakeoffRounded';
import ReceiptRoundedIcon from '@mui/icons-material/ReceiptRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import HowToRegRoundedIcon from '@mui/icons-material/HowToRegRounded';
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import PivotTableChartRoundedIcon from '@mui/icons-material/PivotTableChartRounded';
import RuleRoundedIcon from '@mui/icons-material/RuleRounded';
import { useTheme } from '@mui/material';
import type { TreeMenuItem } from 'orbcafe-ui';
import { getSessionUser } from './session';

type Translate = (key: string, fallback: string) => string;

export function HeaderLogo() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const src = isDark ? '/images/orbis-china-white.png' : '/images/2021_10_orbis_4C-BIG.png';

  return (
    <img
      src={src}
      alt="ORBAI"
      style={{ height: 36, width: 'auto', display: 'block', objectFit: 'contain' }}
    />
  );
}

export function buildPcMenuData(t: Translate) {
  const session = getSessionUser();
  const permissions = session?.permissions;
  const isAdmin = Boolean(permissions?.isAdmin);
  const isFinance = Boolean(permissions?.isFinance);
  const isProjectManager = Boolean(permissions?.isProjectManager);

  const menus: TreeMenuItem[] = [
    { id: 'home', title: t('home', 'Home'), href: '/pc/home', icon: <HomeRoundedIcon fontSize="small" /> },
  ];

  if (isAdmin) {
    menus.push({
      id: 'system_management',
      title: t('system_management', 'System Management'),
      icon: <SettingsRoundedIcon fontSize="small" />,
      children: [
        {
          id: 'users',
          title: t('users', 'User Management'),
          href: '/pc/users',
          icon: <GroupRoundedIcon fontSize="small" />,
        },
        {
          id: 'roles',
          title: t('roles', 'Role Management'),
          href: '/pc/roles',
          icon: <AdminPanelSettingsRoundedIcon fontSize="small" />,
        },
      ],
    });
  }

  const masterDataChildren: TreeMenuItem[] = [
    {
      id: 'customers',
      title: t('customers', 'Customer Management'),
      href: '/pc/customers',
      icon: <BusinessRoundedIcon fontSize="small" />,
    },
    {
      id: 'projects',
      title: t('projects', 'Project Management'),
      href: '/pc/projects',
      icon: <AssignmentRoundedIcon fontSize="small" />,
    },
  ];
  if (isAdmin) {
    masterDataChildren.push({
      id: 'booking_rules',
      title: t('booking_rules', 'Booking Rules'),
      href: '/pc/booking-rules',
      icon: <RuleRoundedIcon fontSize="small" />,
    });
  }

  menus.push({
    id: 'master_data',
    title: t('master_data', 'Master Data Maintenance'),
    icon: <DatasetRoundedIcon fontSize="small" />,
    children: masterDataChildren,
  });

  const reimbursementChildren: TreeMenuItem[] = [
    {
      id: 'travel_entries',
      title: t('travel_entries', 'Travel Management'),
      href: '/pc/travel-entries',
      icon: <FlightTakeoffRoundedIcon fontSize="small" />,
    },
    {
      id: 'invoices',
      title: t('invoices', 'Invoice Management'),
      href: '/pc/invoices',
      icon: <ReceiptRoundedIcon fontSize="small" />,
    },
    {
      id: 'reimbursements',
      title: t('reimbursements_menu', 'Reimbursement Forms'),
      href: '/pc/reimbursements',
      icon: <DescriptionRoundedIcon fontSize="small" />,
    },
  ];

  if (isProjectManager || isAdmin) {
    reimbursementChildren.push({
      id: 'approve',
      title: t('approve', 'Approval'),
      href: '/pc/approve',
      icon: <HowToRegRoundedIcon fontSize="small" />,
    });
  }

  menus.push({
    id: 'reimbursement',
    title: t('reimbursement_group', 'Reimbursement'),
    icon: <ReceiptLongRoundedIcon fontSize="small" />,
    children: reimbursementChildren,
  });

  if (isFinance || isAdmin) {
    menus.push({
      id: 'finance',
      title: t('finance_group', 'Finance'),
      icon: <AccountBalanceRoundedIcon fontSize="small" />,
      children: [
        {
          id: 'tr_booking',
          title: t('finance_booking_archive', 'Finance Booking & Archive'),
          href: '/pc/tr-booking',
          icon: <TaskAltRoundedIcon fontSize="small" />,
        },
        {
          id: 'tr_report',
          title: t('tr_report_menu', 'Reimbursement Report'),
          href: '/pc/tr-report',
          icon: <PivotTableChartRoundedIcon fontSize="small" />,
        },
      ],
    });
  }

  return menus;
}
