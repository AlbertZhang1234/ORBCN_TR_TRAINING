/**
 * @file 10_Frontend/components/sap/ui/Common/Structures/CFilterSection.tsx
 * 
 * @summary Core frontend CFilterSection module for the ORBAI Core project
 * @author ORBAICODER
 * @version 1.0.0
 * @date 2025-01-19
 * 
 * @description
 * This file is responsible for:
 *  - Implementing CFilterSection functionality within frontend workflows
 *  - Integrating with shared ORBAI Core application processes under frontend
 * 
 * @logic
 * 1. Import required dependencies and configuration
 * 2. Execute the primary logic for CFilterSection
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
 * SECTION 1: CFilterSection Core Logic
 * Section overview and description.
 * --------------------------
 */

import type { ReactNode } from 'react';
import { CPaper } from '../Atoms/CPaper';
import { Grid } from '@mui/material';
import { CPageHeader } from './CPageHeader';

interface CFilterSectionProps {
  title?: string;
  icon?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}

export const CFilterSection = ({ title, icon, children, actions }: CFilterSectionProps) => {
  return (
    <CPaper>
      {title && <CPageHeader title={title} icon={icon} />}
      <Grid container spacing={2}>
        {children}
        {actions && (
          <Grid size={12} display="flex" justifyContent="flex-end" sx={{ mt: 1 }}>
            {actions}
          </Grid>
        )}
      </Grid>
    </CPaper>
  );
};
