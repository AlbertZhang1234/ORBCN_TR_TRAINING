/**
 * @file 10_Frontend/components/sap/ui/Common/Atoms/CTypography.tsx
 * 
 * @summary Core frontend CTypography module for the ORBAI Core project
 * @author ORBAICODER
 * @version 1.0.0
 * @date 2025-01-19
 * 
 * @description
 * This file is responsible for:
 *  - Implementing CTypography functionality within frontend workflows
 *  - Integrating with shared ORBAI Core application processes under frontend
 * 
 * @logic
 * 1. Import required dependencies and configuration
 * 2. Execute the primary logic for CTypography
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
 * SECTION 1: CTypography Core Logic
 * Section overview and description.
 * --------------------------
 */

import React from 'react';
import Typography from '@mui/material/Typography';
import type { TypographyProps } from '@mui/material/Typography';

export type CTypographyProps = TypographyProps;

export const CTypography: React.FC<CTypographyProps> = (props) => {
  return <Typography {...props} />;
};
