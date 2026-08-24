/**
 * @file 10_Frontend/components/sap/ui/Common/PageComponents/CStandardPage.tsx
 * @summary Standardized Page Layout for SAP-like Applications (OSM3, etc.)
 * @author ORBAICODER
 * @date 2026-01-05
 * 
 * @description
 * Encapsulates the standard layout pattern:
 * 1. Page Header (optional via CPageLayout)
 * 2. Smart Filter Bar (Top)
 * 3. Data Table (Bottom, filling remaining space)
 * 4. Tightly controlled spacing between components.
 */

'use client';

import React from 'react';
import { Box, Stack } from '@mui/material';
import { CPageLayout } from '../Structures/CPageLayout';
import { CTable } from '../Structures/CTable';
import { CSmartFilter } from '../Structures/CSmartFilter';
import type { CTableProps } from '../Structures/CTable/types';
import type { CSmartFilterProps } from '../Structures/CSmartFilter';

export interface CStandardPageProps<T = any> {
    /** Page Title */
    title: string;
    
    /** Whether to hide the top breadcrumb/title header */
    hideHeader?: boolean;
    
    /** Configuration for the Smart Filter Bar */
    filterConfig?: CSmartFilterProps;
    
    /** Props for the CTable (excluding filterConfig) */
    tableProps: Omit<CTableProps, 'filterConfig'>;
    
    /** Additional content (Dialogs, Snackbars, etc.) */
    children?: React.ReactNode;

    /**
     * Spacing between Filter and Table
     * Default: 1 (8px) - Much tighter than default CTable behavior
     */
    spacing?: number;

    /**
     * Integration mode between SmartFilter and CTable.
     * - integrated: let CTable manage variant/layout/filter linkage internally.
     * - separated: render SmartFilter and CTable separately (legacy mode).
     */
    mode?: 'separated' | 'integrated';
}

export const CStandardPage = ({
    title,
    hideHeader = true,
    filterConfig,
    tableProps,
    children,
    spacing = 1,
    mode = 'integrated',
}: CStandardPageProps) => {
    const tableKey = tableProps.tableKey ?? filterConfig?.tableKey;

    return (
        <CPageLayout title={title} hideHeader={hideHeader}>
            <Stack spacing={spacing} sx={{ height: '100%', overflow: 'hidden' }}>
                {mode === 'separated' && filterConfig && (
                    <Box sx={{ flexShrink: 0 }}>
                        <CSmartFilter {...filterConfig} />
                    </Box>
                )}

                <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                    <CTable
                        {...tableProps}
                        tableKey={tableKey}
                        fitContainer={true}
                        filterConfig={mode === 'integrated' ? filterConfig : undefined}
                    />
                </Box>
            </Stack>
            {children}
        </CPageLayout>
    );
};
