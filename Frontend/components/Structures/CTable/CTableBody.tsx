/**
 * @file 10_Frontend/components/sap/ui/Common/Structures/CTable/CTableBody.tsx
 * 
 * @summary Core frontend CTableBody module for the ORBAI Core project
 * @author ORBAICODER
 * @version 1.0.0
 * @date 2025-01-19
 * 
 * @description
 * This file is responsible for:
 *  - Implementing CTableBody functionality within frontend workflows
 *  - Integrating with shared ORBAI Core application processes under frontend
 * 
 * @logic
 * 1. Import required dependencies and configuration
 * 2. Execute the primary logic for CTableBody
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
 * SECTION 1: CTableBody Core Logic
 * Section overview and description.
 * --------------------------
 */

import React from 'react';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import Checkbox from '@mui/material/Checkbox';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Fade from '@mui/material/Fade';

import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';

import { getLeafRows, getAllGroupIds, formatNumber } from './utils';
import type { HeadCell } from './types';

interface CTableBodyProps {
    visibleRows: any[];
    columns: HeadCell[];
    visibleColumns: string[];
    selectionMode?: 'single' | 'multiple' | 'none';
    selected: string[];
    orderBy: string;
    loading: boolean;
    expandedGroups: Set<string>;
    toggleGroupExpand: (groupId: string) => void;
    handleExpandGroupRecursively: (node: any) => void;
    handleCollapseGroupRecursively: (node: any) => void;
    handleClick: (event: React.MouseEvent<unknown>, id: string) => void;
    onSelectionChange?: (selected: string[]) => void;
    grouping: string[];
    rowKeyProp?: string | ((row: any) => string);
    page?: number;
    rowsPerPage?: number;
}

const getRowId = (row: any, index: number, rowKeyProp?: string | ((row: any) => string)) => {
    if (typeof rowKeyProp === 'function') {
        return rowKeyProp(row);
    }
    if (rowKeyProp && row[rowKeyProp]) {
        return row[rowKeyProp];
    }
    return row.id || row.ID || `row-${index}`;
};

export const CTableBody: React.FC<CTableBodyProps> = ({
    visibleRows,
    columns,
    visibleColumns,
    selectionMode,
    selected,
    orderBy,
    loading,
    expandedGroups,
    toggleGroupExpand,
    handleExpandGroupRecursively,
    handleCollapseGroupRecursively,
    handleClick,
    onSelectionChange,
    grouping,
    rowKeyProp,
    page = 0,
    rowsPerPage = 0
}) => {
    return (
        <TableBody>
            {visibleRows.length === 0 && !loading && (
                    <TableRow>
                        <TableCell colSpan={columns.length + (selectionMode ? 1 : 0)} align="center" sx={{ py: 6 }}>
                            <Typography variant="body1" color="text.secondary">
                                No data available
                            </Typography>
                        </TableCell>
                    </TableRow>
                )}
                {visibleRows.map((item, index) => {
                    if (item.type === 'group') {
                        const node = item.node;
                        
                        // Determine where to split title vs aggregates
                        const visibleCols = columns.filter(c => visibleColumns.includes(c.id));
                        const firstNumericIndex = visibleCols.findIndex(c => c.numeric);
                        
                        let titleColSpan = 1;
                        if (firstNumericIndex > 0) {
                            titleColSpan = firstNumericIndex;
                        } else if (firstNumericIndex === -1) {
                            titleColSpan = visibleCols.length;
                        }

                        // Group Selection Logic
                        let isGroupSelected = false;
                        let isGroupIndeterminate = false;
                        
                        if (selectionMode === 'multiple') {
                            const leafRows = getLeafRows(node);
                            // Use getRowId to ensure consistency with row selection
                            // Note: For group selection, we rely on rowKeyProp or standard ID. 
                            // Fallback to index is not reliable here as we don't have global index for leaves easily.
                            const leafIds = leafRows.map(r => getRowId(r, -1, rowKeyProp));
                            const validLeafIds = leafIds.filter(id => id !== undefined && id !== null);
                            
                            const selectedCount = validLeafIds.filter(id => selected.includes(id)).length;
                            isGroupSelected = validLeafIds.length > 0 && selectedCount === validLeafIds.length;
                            isGroupIndeterminate = selectedCount > 0 && selectedCount < validLeafIds.length;
                        }

                        return (
                            <TableRow 
                                key={node.id}
                                sx={{ bgcolor: 'action.hover' }}
                                onClick={() => toggleGroupExpand(node.id)}
                            >
                                {selectionMode && (
                                    <TableCell padding="checkbox">
                                        {selectionMode === 'multiple' && (
                                            <Checkbox 
                                                indeterminate={isGroupIndeterminate}
                                                checked={isGroupSelected}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (onSelectionChange) {
                                                        const leafRows = getLeafRows(node);
                                                        const leafIds = leafRows.map(r => getRowId(r, -1, rowKeyProp));
                                                        const validLeafIds = leafIds.filter(id => id !== undefined && id !== null);
                                                        
                                                        let newSelected: string[];
                                                        if (isGroupSelected) {
                                                            // Deselect all
                                                            newSelected = selected.filter(id => !validLeafIds.includes(id));
                                                        } else {
                                                            // Select all
                                                            const toAdd = validLeafIds.filter(id => !selected.includes(id));
                                                            newSelected = [...selected, ...toAdd];
                                                        }
                                                        onSelectionChange(newSelected);
                                                    }
                                                }}
                                            />
                                        )}
                                    </TableCell>
                                )}
                                
                                {/* Title Cell */}
                                <TableCell 
                                    colSpan={titleColSpan} 
                                    sx={{ pl: (node.level * 6) + 2, cursor: 'pointer' }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        {grouping.length > 1 && node.level < grouping.length - 1 && (() => {
                                            const descendantIds = getAllGroupIds(node.children);
                                            const isGroupFullyExpanded = descendantIds.length > 0 && descendantIds.every(id => expandedGroups.has(id));
                                            return (
                                                <Tooltip title={isGroupFullyExpanded ? "Collapse Group" : "Expand Group"}>
                                                    <IconButton 
                                                        size="small" 
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            if (isGroupFullyExpanded) {
                                                                handleCollapseGroupRecursively(node);
                                                            } else {
                                                                handleExpandGroupRecursively(node);
                                                            }
                                                        }} 
                                                        sx={{ p: 0.5, mr: 0.5 }}
                                                    >
                                                        {isGroupFullyExpanded ? <UnfoldLessIcon fontSize="small" /> : <UnfoldMoreIcon fontSize="small" />}
                                                    </IconButton>
                                                </Tooltip>
                                            );
                                        })()}
                                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); toggleGroupExpand(node.id); }}>
                                            {expandedGroups.has(node.id) ? <KeyboardArrowDownIcon /> : <KeyboardArrowRightIcon />}
                                        </IconButton>
                                        <Typography variant="subtitle2" fontWeight="bold" sx={{ ml: 1 }}>
                                            {columns.find(c => c.id === node.field)?.label}: {node.value}
                                        </Typography>
                                        <Chip label={node.count} size="small" sx={{ ml: 2, height: 20 }} />
                                    </Box>
                                </TableCell>

                                {/* Remaining Cells (Aggregates or Empty) */}
                                {visibleCols.slice(titleColSpan).map((col) => (
                                    <TableCell key={col.id} align={col.align || 'left'} sx={{ fontWeight: 'bold' }}>
                                        {col.numeric && node.aggregates 
                                          ? formatNumber(node.aggregates[col.id]) 
                                          : ''}
                                    </TableCell>
                                ))}
                            </TableRow>
                        );
                    }

                    const row = item.row;
                    const globalIndex = page * rowsPerPage + index;
                    const rowId = getRowId(row, globalIndex, rowKeyProp);
                    const isItemSelected = selected.indexOf(rowId) !== -1;
                    const labelId = `enhanced-table-checkbox-${index}`;
                    const level = item.level || 0;
                    
                    const rowKey = rowId;

                    return (
                    <TableRow
                      hover
                      onClick={(event) => handleClick(event, rowId)}
                      role="checkbox"
                      aria-checked={isItemSelected}
                      tabIndex={-1}
                      key={rowKey}
                      selected={isItemSelected}
                    >
                      {(selectionMode === 'single' || selectionMode === 'multiple') && (
                        <TableCell padding="checkbox" sx={{ pl: level > 0 ? (level * 4) + 2 : undefined }}>
                          <Checkbox
                            color="primary"
                            checked={isItemSelected}
                            inputProps={{
                              'aria-labelledby': labelId,
                            }}
                          />
                        </TableCell>
                      )}
                      {columns.map((column) => {
                          if (!visibleColumns.includes(column.id)) return null;
                          
                          const isFirstRendered = column.id === visibleColumns[0];
                          const indentStyle = (!selectionMode && isFirstRendered && level > 0) ? { pl: (level * 4) + 2 } : {};

                          return (
                            <TableCell 
                                key={column.id} 
                                align={column.align || 'left'}
                                sx={{
                                    ...indentStyle,
                                    bgcolor: orderBy === column.id ? 'action.hover' : undefined
                                }}
                            >
                              {column.renderCell
                                ? column.renderCell(row)
                                : column.render
                                  ? column.render(row[column.id], row)
                                  : (column.numeric && (typeof row[column.id] === 'number')
                                      ? formatNumber(row[column.id])
                                      : row[column.id])
                              }
                            </TableCell>
                          );
                      })}
                    </TableRow>
                    );
                })}
            </TableBody>
    );
};
