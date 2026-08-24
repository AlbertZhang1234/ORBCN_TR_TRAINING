/**
 * @file 10_Frontend/components/sap/ui/Common/Structures/CTable/CTableMobile.tsx
 * 
 * @summary Core frontend CTableMobile module for the ORBAI Core project
 * @author ORBAICODER
 * @version 1.0.0
 * @date 2025-01-19
 * 
 * @description
 * This file is responsible for:
 *  - Implementing CTableMobile functionality within frontend workflows
 *  - Integrating with shared ORBAI Core application processes under frontend
 * 
 * @logic
 * 1. Import required dependencies and configuration
 * 2. Execute the primary logic for CTableMobile
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
 * SECTION 1: CTableMobile Core Logic
 * Section overview and description.
 * --------------------------
 */

import React from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import LinearProgress from '@mui/material/LinearProgress';
import Fade from '@mui/material/Fade';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Checkbox from '@mui/material/Checkbox';

import FunctionsIcon from '@mui/icons-material/Functions';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import FilterListIcon from '@mui/icons-material/FilterList';

import type { HeadCell } from './types';

interface CTableMobileProps {
    title: string;
    loading: boolean;
    showSummary: boolean;
    setShowSummary: (show: boolean) => void;
    setSummaryMenuAnchorEl?: (el: HTMLElement | null) => void;
    setAnchorEl: (el: HTMLElement | null) => void;
    filterText: string;
    setFilterText: (text: string) => void;
    actions?: React.ReactNode;
    sortedAndFilteredRows: any[];
    selected: string[];
    columns: HeadCell[];
    visibleColumns: string[];
    summaryRow: Record<string, any>;
    handleClick: (event: React.MouseEvent<unknown>, id: string) => void;
    selectionMode?: 'single' | 'multiple' | 'none';
}

export const CTableMobile: React.FC<CTableMobileProps> = ({
    title,
    loading,
    showSummary,
    setShowSummary,
    setSummaryMenuAnchorEl,
    setAnchorEl,
    filterText,
    setFilterText,
    actions,
    sortedAndFilteredRows,
    selected,
    columns,
    visibleColumns,
    summaryRow,
    handleClick,
    selectionMode
}) => {
    return (
      <Box sx={{ width: '100%', mb: 2 }}>
        {/* Mobile Toolbar */}
        <Paper sx={{ p: 2, mb: 2 }}>
            <Stack spacing={2}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6">{title}</Typography>
                    <Stack direction="row" spacing={1}>
                        <IconButton onClick={(e) => setSummaryMenuAnchorEl && setSummaryMenuAnchorEl(e.currentTarget)} color={showSummary ? 'primary' : 'default'}>
                            <FunctionsIcon />
                        </IconButton>
                        <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
                            <ViewColumnIcon />
                        </IconButton>
                    </Stack>
                </Box>
                <TextField
                    size="small"
                    placeholder="Search..."
                    fullWidth
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    InputProps={{
                        startAdornment: <FilterListIcon color="action" fontSize="small" sx={{ mr: 1 }} />
                    }}
                />
                <Box>
                  {actions}
                </Box>
            </Stack>
            {loading && <LinearProgress sx={{ mt: 2 }} />}
        </Paper>

        {/* Mobile Cards */}
        {loading ? (
             <Box sx={{ py: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">Loading data...</Typography>
             </Box>
        ) : (
        <Fade in={!loading}>
        <Stack spacing={2}>
            {sortedAndFilteredRows.map((row, index) => {
                const isItemSelected = selected.indexOf(row.id || row.ID) !== -1;
                return (
                    <Card 
                        key={row.id || index} 
                        variant="outlined"
                        sx={{ 
                            borderColor: isItemSelected ? 'primary.main' : undefined,
                            bgcolor: isItemSelected ? 'action.selected' : undefined
                        }}
                    >
                        <CardHeader
                            title={
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Typography variant="subtitle1" fontWeight="bold">
                                        {/* Use first visible column as title if possible */}
                                        {columns.find(c => visibleColumns.includes(c.id))?.label}: {row[columns.find(c => visibleColumns.includes(c.id))?.id || '']}
                                    </Typography>
                                    {selectionMode && (
                                        <Checkbox
                                            checked={isItemSelected}
                                            onChange={(e) => handleClick(e as any, row.id || row.ID)}
                                        />
                                    )}
                                </Box>
                            }
                        />
                        <Divider />
                        <CardContent>
                            <Grid container spacing={1}>
                                {columns.map(col => {
                                    if (!visibleColumns.includes(col.id)) return null;
                                    // Skip the first one if used in title? No, show all for clarity
                                    return (
                                         <Grid size={{ xs: 6 }} key={col.id}>
                                             <Typography variant="caption" color="text.secondary" display="block">
                                                 {col.label}
                                             </Typography>
                                            <Typography component="div" variant="body2">
                                                {col.renderCell
                                                  ? col.renderCell(row)
                                                  : col.render
                                                    ? col.render(row[col.id], row)
                                                    : row[col.id]}
                                            </Typography>
                                        </Grid>
                                    );
                                })}
                            </Grid>
                        </CardContent>
                    </Card>
                );
            })}
        </Stack>
        </Fade>
        )}
        
        {/* Mobile Summary */}
        {showSummary && (
             <Paper sx={{ p: 2, mt: 2, bgcolor: 'action.hover' }}>
                <Typography variant="subtitle2" gutterBottom>Summary</Typography>
                <Grid container spacing={1}>
                    {columns.map(col => {
                         if (!visibleColumns.includes(col.id) || !col.numeric) return null;
                         return (
                             <Grid size={{ xs: 6 }} key={col.id}>
                                 <Typography variant="caption" color="text.secondary">
                                     {col.label}
                                 </Typography>
                                <Typography variant="body2" fontWeight="bold">
                                    {summaryRow[col.id]}
                                </Typography>
                            </Grid>
                        )
                    })}
                </Grid>
             </Paper>
        )}
      </Box>
    );
};
