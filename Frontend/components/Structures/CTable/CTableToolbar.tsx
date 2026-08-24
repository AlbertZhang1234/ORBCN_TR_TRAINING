/**
 * @file 10_Frontend/components/sap/ui/Common/Structures/CTable/CTableToolbar.tsx
 * 
 * @summary Core frontend CTableToolbar module for the ORBAI Core project
 * @author ORBAICODER
 * @version 1.0.0
 * @date 2025-01-19
 * 
 * @description
 * This file is responsible for:
 *  - Implementing CTableToolbar functionality within frontend workflows
 *  - Integrating with shared ORBAI Core application processes under frontend
 * 
 * @logic
 * 1. Import required dependencies and configuration
 * 2. Execute the primary logic for CTableToolbar
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
 * SECTION 1: CTableToolbar Core Logic
 * Section overview and description.
 * --------------------------
 */

import React from 'react';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Badge from '@mui/material/Badge';
import LinearProgress from '@mui/material/LinearProgress';

// Icons
import FilterListIcon from '@mui/icons-material/FilterList';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import FunctionsIcon from '@mui/icons-material/Functions';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import DownloadIcon from '@mui/icons-material/Download';
import SaveIcon from '@mui/icons-material/Save';

interface CTableToolbarProps {
    filterText: string;
    setFilterText: (text: string) => void;
    onRowsPerPageChange?: (newRows: number) => void;
    rowsPerPage: number;
    rowsPerPageOptions: number[];
    page: number;
    count?: number;
    onPageChange?: (newPage: number) => void;
    actions?: React.ReactNode;
    grouping: string[];
    setGroupAnchorEl: (el: HTMLElement | null) => void;
    showSummary: boolean;
    setShowSummary: (show: boolean) => void;
    setSummaryMenuAnchorEl?: (el: HTMLElement | null) => void;
    setAnchorEl: (el: HTMLElement | null) => void;
    handleExport: () => void;
    onLayoutSave?: () => void;
    layoutManager?: React.ReactNode;
    loading?: boolean;
}

/**
 * CTableToolbar
 * 
 * Top toolbar for the CTable component.
 * Contains:
 * - Search bar (filterText)
 * - Pagination controls
 * - Action buttons (passed via children)
 * - Layout management buttons (Save Layout, Group By, Show Summary, Columns, Export)
 */
export const CTableToolbar: React.FC<CTableToolbarProps> = ({
    filterText,
    setFilterText,
    onRowsPerPageChange,
    rowsPerPage,
    rowsPerPageOptions,
    page,
    count = 0,
    onPageChange,
    actions,
    grouping,
    setGroupAnchorEl,
    showSummary,
    setShowSummary,
    setSummaryMenuAnchorEl,
    setAnchorEl,
    handleExport,
    onLayoutSave,
    layoutManager,
    loading
}) => {
    const actionNodes = React.Children.toArray(actions);

    const handleNextPage = () => {
        if (onPageChange && rowsPerPage > 0 && (page + 1) * rowsPerPage < count) {
            onPageChange(page + 1);
        }
    };

    const handlePrevPage = () => {
        if (onPageChange && page > 0) {
            onPageChange(page - 1);
        }
    };

    const totalPages = rowsPerPage > 0 ? Math.ceil(count / rowsPerPage) : 1;
    const isNextDisabled = rowsPerPage === -1 || (page + 1) >= totalPages;

    return (
        <>
            <Toolbar
                sx={{
                    pl: 2,
                    pr: 1,
                    borderBottom: 1,
                    borderColor: 'divider',
                    gap: 2
                }}
            >
                <TextField
                    size="small"
                    placeholder="Search..."
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    InputProps={{
                        startAdornment: <FilterListIcon color="action" fontSize="small" sx={{ mr: 1 }} />
                    }}
                    sx={{ minWidth: 250 }}
                />

                {/* Pagination Controls */}
                {onRowsPerPageChange && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, ml: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" color="text.secondary">Items per page:</Typography>
                            <Select
                                value={rowsPerPage}
                                onChange={(e) => onRowsPerPageChange(Number(e.target.value))}
                                variant="standard"
                                disableUnderline
                                size="small"
                                sx={{ 
                                    fontSize: '0.875rem', 
                                    fontWeight: 'bold',
                                    '& .MuiSelect-select': { py: 0, pr: '16px !important' } 
                                }}
                            >
                                {rowsPerPageOptions.map(opt => (
                                    <MenuItem key={opt} value={opt}>
                                        {opt === -1 ? 'All' : opt}
                                    </MenuItem>
                                ))}
                            </Select>
                        </Box>
                        
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <IconButton 
                                size="small" 
                                onClick={handlePrevPage} 
                                disabled={page === 0}
                                sx={{ p: 0.5 }}
                            >
                                <KeyboardArrowLeftIcon fontSize="small" />
                            </IconButton>
                            <Typography variant="body2" sx={{ mx: 1 }}>
                                Page {page + 1} of {rowsPerPage === -1 || !count ? 1 : Math.ceil(count / rowsPerPage)}
                            </Typography>
                            <IconButton 
                                size="small" 
                                onClick={handleNextPage} 
                                disabled={isNextDisabled}
                                sx={{ p: 0.5 }}
                            >
                                <KeyboardArrowRightIcon fontSize="small" />
                            </IconButton>
                        </Box>
                    </Box>
                )}

                <Box sx={{ flexGrow: 1 }} />

                <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
                    {actionNodes}
                </Box>

                <Stack direction="row" spacing={1} alignItems="center">
                    {layoutManager}
                    
                    {onLayoutSave && !layoutManager && (
                        <Tooltip title="Save Layout">
                            <IconButton onClick={onLayoutSave}>
                                <SaveIcon />
                            </IconButton>
                        </Tooltip>
                    )}

                    <Tooltip title="Group By">
                        <IconButton onClick={(e) => setGroupAnchorEl(e.currentTarget)} color={grouping.length > 0 ? 'primary' : 'default'}>
                            <Badge badgeContent={grouping.length} color="secondary">
                                <AccountTreeIcon />
                            </Badge>
                        </IconButton>
                    </Tooltip>

                    <Tooltip title="Summary Options">
                        <IconButton 
                            onClick={(e) => setSummaryMenuAnchorEl && setSummaryMenuAnchorEl(e.currentTarget)}
                            color={showSummary ? 'primary' : 'default'}
                        >
                            <FunctionsIcon />
                        </IconButton>
                    </Tooltip>

                    <Tooltip title="Columns">
                        <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
                            <ViewColumnIcon />
                        </IconButton>
                    </Tooltip>

                    <Tooltip title="Export CSV">
                        <IconButton onClick={handleExport}>
                            <DownloadIcon />
                        </IconButton>
                    </Tooltip>
                </Stack>
            </Toolbar>
            {loading && <LinearProgress />}
        </>
    );
};
