/**
 * @file 10_Frontend/components/sap/ui/Common/Atoms/CPaper.tsx
 * 
 * @summary Core frontend CPaper module for the ORBAI Core project
 * @author ORBAICODER
 * @version 1.0.0
 * @date 2025-01-19
 * 
 * @description
 * This file is responsible for:
 *  - Implementing CPaper functionality within frontend workflows
 *  - Integrating with shared ORBAI Core application processes under frontend
 * 
 * @logic
 * 1. Import required dependencies and configuration
 * 2. Execute the primary logic for CPaper
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
 * SECTION 1: CPaper Core Logic
 * Section overview and description.
 * --------------------------
 */

import { Paper } from '@mui/material';
import type { PaperProps } from '@mui/material';
import { forwardRef } from 'react';

export const CPaper = forwardRef<HTMLDivElement, PaperProps>((props, ref) => {
  return (
    <Paper
      ref={ref}
      {...props}
      elevation={props.elevation || 1}
      sx={{ p: 2, mb: 2, ...props.sx }}
    />
  );
});

CPaper.displayName = 'CPaper';
