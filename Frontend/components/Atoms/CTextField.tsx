/**
 * @file 10_Frontend/components/sap/ui/Common/Atoms/CTextField.tsx
 * 
 * @summary Core frontend CTextField module for the ORBAI Core project
 * @author ORBAICODER
 * @version 1.0.0
 * @date 2025-01-19
 * 
 * @description
 * This file is responsible for:
 *  - Implementing CTextField functionality within frontend workflows
 *  - Integrating with shared ORBAI Core application processes under frontend
 * 
 * @logic
 * 1. Import required dependencies and configuration
 * 2. Execute the primary logic for CTextField
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
 * SECTION 1: CTextField Core Logic
 * Section overview and description.
 * --------------------------
 */

import { TextField } from '@mui/material';
import type { TextFieldProps } from '@mui/material';

export const CTextField = (props: TextFieldProps) => {
  return (
    <TextField
      {...props}
      variant={props.variant || 'outlined'}
      size={props.size || 'small'}
      fullWidth={props.fullWidth !== undefined ? props.fullWidth : true}
    />
  );
};
