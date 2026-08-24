/**
 * @file 10_Frontend/components/sap/ui/Common/Atoms/CButton.tsx
 * 
 * @summary Core frontend CButton module for the ORBAI Core project
 * @author ORBAICODER
 * @version 1.0.0
 * @date 2025-01-19
 * 
 * @description
 * This file is responsible for:
 *  - Implementing CButton functionality within frontend workflows
 *  - Integrating with shared ORBAI Core application processes under frontend
 * 
 * @logic
 * 1. Import required dependencies and configuration
 * 2. Execute the primary logic for CButton
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
 * SECTION 1: CButton Core Logic
 * Section overview and description.
 * --------------------------
 */

import { Button } from '@mui/material';
import type { ButtonProps } from '@mui/material';

interface CButtonProps extends ButtonProps {
  // Add any custom props here if needed in future
}

export const CButton = (props: CButtonProps) => {
  return (
    <Button
      {...props}
      // Default props override
      variant={props.variant || 'contained'}
      size={props.size || 'medium'}
      sx={{ textTransform: 'none', ...props.sx }}
    />
  );
};
