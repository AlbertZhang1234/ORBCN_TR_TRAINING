/**
 * @file 10_Frontend/components/sap/ui/Common/Structures/CTable/CTableFooter.tsx
 * 
 * @summary Core frontend CTableFooter module for the ORBAI Core project
 * @author ORBAICODER
 * @version 1.0.0
 * @date 2025-01-19
 * 
 * @description
 * This file is responsible for:
 *  - Implementing CTableFooter functionality within frontend workflows
 *  - Integrating with shared ORBAI Core application processes under frontend
 * 
 * @logic
 * 1. Import required dependencies and configuration
 * 2. Execute the primary logic for CTableFooter
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
 * SECTION 1: CTableFooter Core Logic
 * Section overview and description.
 * --------------------------
 */

import React from 'react';
import TableFooter from '@mui/material/TableFooter';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import { formatNumber } from './utils';
import type { HeadCell } from './types';

/**
 * CTableFooter
 * 
 * Renders a sticky footer row for column summaries (e.g., totals).
 * 
 * @param props.zIndex - Controls the stacking order of the sticky footer.
 *                       Must be higher than the sticky header (default 2 in MUI) 
 *                       to ensure the footer stays on top of the header when scrolling.
 *                       Default provided by parent is usually 3 or higher.
 */
interface CTableFooterProps {
    showSummary: boolean;
    selectionMode?: string;
    columns: HeadCell[];
    visibleColumns: string[];
    orderBy: string;
    summaryRow: Record<string, any>;
    zIndex?: number;
}

export const CTableFooter: React.FC<CTableFooterProps> = ({
    showSummary,
    selectionMode,
    columns,
    visibleColumns,
    orderBy,
    summaryRow,
    zIndex = 100
}) => {
    if (!showSummary) return null;

    return (
        <TableFooter>
            <TableRow>
                {(selectionMode === 'single' || selectionMode === 'multiple') && <TableCell sx={{ 
                    position: 'sticky', 
                    bottom: 0, 
                    zIndex: zIndex,
                    bgcolor: 'background.paper',
                    borderTop: 2, 
                    borderColor: 'divider'
                }} />}
                {columns.map((column) => (
                    visibleColumns.includes(column.id) ? (
                        <TableCell 
                        key={column.id} 
                        align={column.align || 'left'} 
                        sx={{ 
                            fontWeight: 'bold',
                            fontSize: '1rem',
                            color: orderBy === column.id ? 'primary.main' : 'inherit',
                            bgcolor: orderBy === column.id ? 'action.selected' : 'background.paper',
                            position: 'sticky',
                            bottom: 0,
                            zIndex: zIndex,
                            borderTop: 2, 
                            borderColor: 'divider'
                        }}
                        >
                            {column.numeric && typeof summaryRow[column.id] === 'number'
                                ? formatNumber(summaryRow[column.id] as number)
                                : summaryRow[column.id]}
                        </TableCell>
                    ) : null
                ))}
            </TableRow>
        </TableFooter>
    );
};
