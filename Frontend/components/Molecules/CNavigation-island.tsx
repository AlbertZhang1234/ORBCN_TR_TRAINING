'use client';

import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import {
  NavigationIsland,
  useNavigationIsland,
  type TreeMenuItem,
} from 'orbcafe-ui';

export interface NavigationItem {
  key: string;
  label: string;
  href: string;
  icon: ReactNode;
}

export interface CNavigationIslandProps {
  items?: NavigationItem[];
  menuData?: TreeMenuItem[];
  widthExpanded?: number;
  widthCollapsed?: number;
  title?: string;
  mode?: 'light' | 'dark';
}

const defaultItems: NavigationItem[] = [
  { key: 'home', label: 'Home', href: '/pc/home', icon: <HomeRoundedIcon fontSize="small" /> },
  {
    key: 'users',
    label: 'Users',
    href: '/pc/users',
    icon: <GroupRoundedIcon fontSize="small" />,
  },
  {
    key: 'roles',
    label: 'Roles',
    href: '/pc/roles',
    icon: <AdminPanelSettingsRoundedIcon fontSize="small" />,
  },
];

export function CNavigationIsland({
  items,
  menuData,
  mode = 'dark',
}: CNavigationIslandProps) {
  const treeData = useMemo<TreeMenuItem[]>(
    () => {
      if (menuData) return menuData;
      const currentItems = items || defaultItems;
      return currentItems.map((item) => ({
        id: item.key,
        title: item.label,
        label: item.label, // Ensure compatibility with newer orbcafe-ui
        href: item.href,
        icon: item.icon,
      }));
    },
    [items, menuData],
  );

  const { navigationIslandProps, setMenuData } = useNavigationIsland({
    initialCollapsed: false,
    content: treeData,
  });

  useEffect(() => {
    setMenuData(treeData);
  }, [setMenuData, treeData]);

  return (
    <NavigationIsland
      {...navigationIslandProps}
      colorMode={mode}
    />
  );
}

export default CNavigationIsland;
