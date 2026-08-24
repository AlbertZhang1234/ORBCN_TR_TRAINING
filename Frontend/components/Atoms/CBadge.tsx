/**
 * @file 10_Frontend/components/sap/ui/Common/Atoms/CBadge.tsx
 * 
 * @summary Core frontend CBadge module for the ORBAI Core project
 * @author ORBAICODER
 * @version 1.0.0
 * @date 2025-01-19
 * 
 * @description
 * This file is responsible for:
 *  - Implementing CBadge functionality within frontend workflows
 *  - Integrating with shared ORBAI Core application processes under frontend
 * 
 * @logic
 * 1. Import required dependencies and configuration
 * 2. Execute the primary logic for CBadge
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
 * SECTION 1: CBadge Core Logic
 * Section overview and description.
 * --------------------------
 */

import React from 'react';
import Badge from '@mui/material/Badge';
import type { BadgeProps } from '@mui/material/Badge';

export type CBadgeProps = BadgeProps;

export const CBadge: React.FC<CBadgeProps> = (props) => {
  return <Badge {...props} />;
};
