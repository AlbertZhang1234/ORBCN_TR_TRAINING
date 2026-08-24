/**
 * @file 10_Frontend/components/sap/ui/Common/Molecules/CList.tsx
 * 
 * @summary Core frontend CList module for the ORBAI Core project
 * @author ORBAICODER
 * @version 1.0.0
 * @date 2025-01-19
 * 
 * @description
 * This file is responsible for:
 *  - Implementing CList functionality within frontend workflows
 *  - Integrating with shared ORBAI Core application processes under frontend
 * 
 * @logic
 * 1. Import required dependencies and configuration
 * 2. Execute the primary logic for CList
 * 3. Export the resulting APIs, hooks, or components for reuse
 * 
 * @changelog
 * V1.0.0 - 2025-01-19 - Initial creation
 */

/**
 * File Overview
 * 
 * START CODING
 * 
 * --------------------------
 * SECTION 1: CList Core Logic
 * Section overview and description.
 * --------------------------
 */

import React from 'react';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import ListItemAvatar from '@mui/material/ListItemAvatar';

import type { ListProps } from '@mui/material/List';
import type { ListItemProps } from '@mui/material/ListItem';
import type { ListItemButtonProps } from '@mui/material/ListItemButton';
import type { ListItemIconProps } from '@mui/material/ListItemIcon';
import type { ListItemTextProps } from '@mui/material/ListItemText';
import type { ListSubheaderProps } from '@mui/material/ListSubheader';
import type { ListItemAvatarProps } from '@mui/material/ListItemAvatar';

export type CListProps = ListProps;
export const CList: React.FC<CListProps> = (props) => <List {...props} />;

export type CListItemProps = ListItemProps;
export const CListItem: React.FC<CListItemProps> = (props) => <ListItem {...props} />;

export type CListItemButtonProps = ListItemButtonProps;
export const CListItemButton: React.FC<CListItemButtonProps> = (props) => <ListItemButton {...props} />;

export type CListItemIconProps = ListItemIconProps;
export const CListItemIcon: React.FC<CListItemIconProps> = (props) => <ListItemIcon {...props} />;

export type CListItemTextProps = ListItemTextProps;
export const CListItemText: React.FC<CListItemTextProps> = (props) => <ListItemText {...props} />;

export type CListSubheaderProps = ListSubheaderProps;
export const CListSubheader: React.FC<CListSubheaderProps> = (props) => <ListSubheader {...props} />;

export type CListItemAvatarProps = ListItemAvatarProps;
export const CListItemAvatar: React.FC<CListItemAvatarProps> = (props) => <ListItemAvatar {...props} />;
