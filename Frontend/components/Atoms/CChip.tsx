/**
 * @file 10_Frontend/components/sap/ui/Common/Atoms/CChip.tsx
 * 
 * @summary Core frontend CChip module for the ORBAI Core project
 * @author ORBAICODER
 * @version 1.0.0
 * @date 2025-01-19
 * 
 * @description
 * This file is responsible for:
 *  - Implementing CChip functionality within frontend workflows
 *  - Integrating with shared ORBAI Core application processes under frontend
 * 
 * @logic
 * 1. Import required dependencies and configuration
 * 2. Execute the primary logic for CChip
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
 * SECTION 1: CChip Core Logic
 * Section overview and description.
 * --------------------------
 */

import { Chip } from '@mui/material';
import type { ChipProps } from '@mui/material';

export const CChip = (props: ChipProps) => {
  return (
    <Chip
      {...props}
      size={props.size || 'small'}
      variant={props.variant || 'outlined'}
    />
  );
};
