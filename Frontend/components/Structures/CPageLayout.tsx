/**
 * @file 10_Frontend/components/sap/ui/Common/Structures/CPageLayout.tsx
 * 
 * @summary Core frontend CPageLayout module for the ORBAI Core project
 * @author ORBAICODER
 * @version 1.0.0
 * @date 2025-01-19
 * 
 * @description
 * This file is responsible for:
 *  - Implementing CPageLayout functionality within frontend workflows
 *  - Integrating with shared ORBAI Core application processes under frontend
 * 
 * @logic
 * 1. Import required dependencies and configuration
 * 2. Execute the primary logic for CPageLayout
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
 * SECTION 1: CPageLayout Core Logic
 * Section overview and description.
 * --------------------------
 */

'use client';

import type { ReactNode } from 'react';
import { Box, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useRouter } from 'next/navigation';
import { CPageHeader } from './CPageHeader';
import { CAppHeaderActions } from '../Molecules/CAppHeaderActions';

interface CPageLayoutProps {
    /** Page title displayed in the header */
    title: string;
    /** Main content of the page */
    children: ReactNode;
    /** Additional actions to display in the header (left of global actions) */
    actions?: ReactNode;
    /** Whether to show a back button */
    enableBack?: boolean;
    /** Optional icon to display next to the title (replaces back button if present) */
    headerIcon?: ReactNode;
    /** Whether to hide the header completely */
    hideHeader?: boolean;
}

/**
 * CPageLayout Component
 * 
 * Wraps page content with a standard header and layout structure.
 * Ensures consistent spacing and scrolling behavior.
 */
export const CPageLayout = ({ 
    title, 
    children, 
    actions, 
    enableBack = false,
    headerIcon,
    hideHeader = false
}: CPageLayoutProps) => {
    const router = useRouter();

    const backButton = enableBack ? (
        <IconButton onClick={() => router.back()} color="primary" sx={{ mr: 1 }}>
            <ArrowBackIcon fontSize="medium" />
        </IconButton>
    ) : null;

    return (
        <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
            {!hideHeader && (
                <CPageHeader 
                    title={title}
                    icon={headerIcon || backButton}
                    actions={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {actions}
                            <CAppHeaderActions />
                        </Box>
                    }
                />
            )}
            <Box sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {children}
            </Box>
        </Box>
    );
};
