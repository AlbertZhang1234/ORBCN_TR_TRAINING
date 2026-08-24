/**
 * @file 10_Frontend/components/sap/ui/Common/Atoms/CIconButton.tsx
 * 
 * @summary Core frontend CIconButton module for the ORBAI Core project
 * @author ORBAICODER
 * @version 1.0.0
 * @date 2025-01-19
 * 
 * @description
 * This file is responsible for:
 *  - Implementing CIconButton functionality within frontend workflows
 *  - Integrating with shared ORBAI Core application processes under frontend
 * 
 * @logic
 * 1. Import required dependencies and configuration
 * 2. Execute the primary logic for CIconButton
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
 * SECTION 1: CIconButton Core Logic
 * Section overview and description.
 * --------------------------
 */

import { IconButton, Tooltip } from '@mui/material';
import type { IconButtonProps } from '@mui/material';
import { forwardRef } from 'react';

interface CIconButtonProps extends IconButtonProps {
  tooltip?: string;
}

export const CIconButton = forwardRef<HTMLButtonElement, CIconButtonProps>(({ tooltip, ...props }, ref) => {
  const button = (
    <IconButton
      ref={ref}
      {...props}
      size={props.size || 'small'}
    />
  );

  if (tooltip) {
    return (
      <Tooltip title={tooltip}>
        {button}
      </Tooltip>
    );
  }

  return button;
});

CIconButton.displayName = 'CIconButton';
