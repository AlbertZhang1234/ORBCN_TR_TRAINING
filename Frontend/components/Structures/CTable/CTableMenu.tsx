/**
 * @file 10_Frontend/components/sap/ui/Common/Structures/CTable/CTableMenu.tsx
 * 
 * @summary Core frontend CTableMenu module for the ORBAI Core project
 * @author ORBAICODER
 * @version 1.0.0
 * @date 2025-01-19
 * 
 * @description
 * This file is responsible for:
 *  - Implementing CTableMenu functionality within frontend workflows
 *  - Integrating with shared ORBAI Core application processes under frontend
 * 
 * @logic
 * 1. Import required dependencies and configuration
 * 2. Execute the primary logic for CTableMenu
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
 * SECTION 1: CTableMenu Core Logic
 * Section overview and description.
 * --------------------------
 */

import React from 'react';
import Popover from '@mui/material/Popover';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Checkbox from '@mui/material/Checkbox';
import Badge from '@mui/material/Badge';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import FormControlLabel from '@mui/material/FormControlLabel';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';
import ClearAllIcon from '@mui/icons-material/ClearAll';

import type { HeadCell } from './types';

interface CTableGroupMenuProps {
    groupAnchorEl: HTMLElement | null;
    setGroupAnchorEl: (el: HTMLElement | null) => void;
    grouping: string[];
    setGrouping: (grouping: string[]) => void;
    columns: HeadCell[];
    toggleGroupField: (fieldId: string) => void;
}

export const CTableGroupMenu: React.FC<CTableGroupMenuProps> = ({
    groupAnchorEl,
    setGroupAnchorEl,
    grouping,
    setGrouping,
    columns,
    toggleGroupField
}) => {
    return (
        <Popover
            open={Boolean(groupAnchorEl)}
            anchorEl={groupAnchorEl}
            onClose={() => setGroupAnchorEl(null)}
            anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
            }}
        >
            <List sx={{ width: 250, maxHeight: 400, overflow: 'auto' }}>
                {grouping.length > 0 && (
                    <>
                        <ListItem disablePadding>
                            <ListItemButton onClick={() => setGrouping([])}>
                                <ListItemIcon>
                                    <ClearAllIcon color="error" />
                                </ListItemIcon>
                                <ListItemText primary="Clear All Grouping" primaryTypographyProps={{ color: 'error', fontWeight: 'bold' }} />
                            </ListItemButton>
                        </ListItem>
                        <Divider />
                    </>
                )}
                {columns.map((col) => {
                    const isGrouped = grouping.includes(col.id);
                    const index = grouping.indexOf(col.id);
                    return (
                        <ListItem key={col.id} disablePadding>
                            <ListItemButton onClick={() => toggleGroupField(col.id)}>
                                <ListItemIcon>
                                    <Checkbox
                                        edge="start"
                                        checked={isGrouped}
                                        tabIndex={-1}
                                        disableRipple
                                    />
                                </ListItemIcon>
                                <ListItemText primary={col.label} />
                                {isGrouped && (
                                    <Badge badgeContent={index + 1} color="primary" sx={{ mr: 2 }} />
                                )}
                            </ListItemButton>
                        </ListItem>
                    );
                })}
            </List>
        </Popover>
    );
};

interface CTableColumnMenuProps {
    anchorEl: HTMLElement | null;
    setAnchorEl: (el: HTMLElement | null) => void;
    columns: HeadCell[];
    visibleColumns: string[];
    toggleColumnVisibility: (columnId: string) => void;
}

export const CTableColumnMenu: React.FC<CTableColumnMenuProps> = ({
    anchorEl,
    setAnchorEl,
    columns,
    visibleColumns,
    toggleColumnVisibility
}) => {
    return (
        <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
        >
            {columns.map((col) => (
                <MenuItem key={col.id} onClick={() => toggleColumnVisibility(col.id)}>
                    <FormControlLabel
                        control={<Checkbox checked={visibleColumns.includes(col.id)} size="small" />}
                        label={col.label}
                        onClick={(e) => e.stopPropagation()} 
                        onChange={() => toggleColumnVisibility(col.id)}
                    />
                </MenuItem>
            ))}
        </Menu>
    );
};

interface CTableContextMenuProps {
    contextMenu: { mouseX: number; mouseY: number } | null;
    handleCloseContextMenu: () => void;
    columns: HeadCell[];
    visibleColumns: string[];
    toggleColumnVisibility: (columnId: string) => void;
}

export const CTableContextMenu: React.FC<CTableContextMenuProps> = ({
    contextMenu,
    handleCloseContextMenu,
    columns,
    visibleColumns,
    toggleColumnVisibility
}) => {
    return (
        <Menu
            open={contextMenu !== null}
            onClose={handleCloseContextMenu}
            anchorReference="anchorPosition"
            anchorPosition={
                contextMenu !== null
                    ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
                    : undefined
            }
        >
            <Typography variant="subtitle2" sx={{ px: 2, py: 1 }}>Toggle Columns</Typography>
            {columns.map((col) => (
                <MenuItem key={col.id} onClick={() => toggleColumnVisibility(col.id)} dense>
                    <Checkbox checked={visibleColumns.includes(col.id)} size="small" sx={{ p: 0.5, mr: 1 }} />
                    {col.label}
                </MenuItem>
            ))}
        </Menu>
    );
};

interface CTableSummaryMenuProps {
    anchorEl: HTMLElement | null;
    setAnchorEl: (el: HTMLElement | null) => void;
    showSummary: boolean;
    setShowSummary: (show: boolean) => void;
    columns: HeadCell[];
    summaryColumns: string[];
    setSummaryColumns: (cols: string[]) => void;
}

export const CTableSummaryMenu: React.FC<CTableSummaryMenuProps> = ({
    anchorEl,
    setAnchorEl,
    showSummary,
    setShowSummary,
    columns,
    summaryColumns,
    setSummaryColumns
}) => {
    const handleToggleColumn = (columnId: string) => {
        if (summaryColumns.includes(columnId)) {
            setSummaryColumns(summaryColumns.filter(id => id !== columnId));
        } else {
            setSummaryColumns([...summaryColumns, columnId]);
        }
    };

    // Filter only numeric columns for summary options
    const numericColumns = columns.filter(col => col.numeric);

    return (
        <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
        >
            <MenuItem>
                <FormControlLabel
                    control={<Switch checked={showSummary} onChange={(e) => setShowSummary(e.target.checked)} />}
                    label="Show Summary Row"
                    onClick={(e) => e.stopPropagation()}
                />
            </MenuItem>
            <Divider />
            {numericColumns.length === 0 && (
                <MenuItem disabled>No numeric columns</MenuItem>
            )}
            {numericColumns.map((col) => (
                <MenuItem key={col.id} onClick={() => handleToggleColumn(col.id)} disabled={!showSummary}>
                    <Checkbox 
                        checked={summaryColumns.includes(col.id)} 
                        size="small" 
                        sx={{ p: 0.5, mr: 1 }} 
                    />
                    {col.label}
                </MenuItem>
            ))}
        </Menu>
    );
};
