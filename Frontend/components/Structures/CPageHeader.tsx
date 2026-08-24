/**
 * @file 10_Frontend/components/sap/ui/Common/Structures/CPageHeader.tsx
 * 
 * @summary Core frontend CPageHeader module for the ORBAI Core project
 * @author ORBAICODER
 * @version 1.0.0
 * @date 2025-01-19
 * 
 * @description
 * This file is responsible for:
 *  - Implementing CPageHeader functionality within frontend workflows
 *  - Integrating with shared ORBAI Core application processes under frontend
 * 
 * @logic
 * 1. Import required dependencies and configuration
 * 2. Execute the primary logic for CPageHeader
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
 * SECTION 1: CPageHeader Core Logic
 * Section overview and description.
 * --------------------------
 */

'use client';

import { Box, Typography, Stack, Divider } from '@mui/material';
import type { ReactNode } from 'react';

interface CPageHeaderProps {
  title: string;
  icon?: ReactNode;
  actions?: ReactNode;
}

export const CPageHeader = ({ title, icon, actions }: CPageHeaderProps) => {
  return (
    <>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box display="flex" alignItems="center">
          {icon && <Box sx={{ mr: 1, display: 'flex' }}>{icon}</Box>}
          <Typography variant="h6" color="primary" fontWeight="bold">
            {title}
          </Typography>
        </Box>
        {actions && <Box>{actions}</Box>}
      </Box>
      <Divider sx={{ mb: 2 }} />
    </>
  );
};
