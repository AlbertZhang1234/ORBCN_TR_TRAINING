/**
 * @file 10_Frontend/components/sap/ui/Common/Atoms/CTextArea.tsx
 * 
 * @summary Core frontend CTextArea module for the ORBAI Core project
 * @author ORBAICODER
 * @version 1.0.0
 * @date 2025-01-19
 * 
 * @description
 * This file is responsible for:
 *  - Implementing CTextArea functionality within frontend workflows
 *  - Integrating with shared ORBAI Core application processes under frontend
 * 
 * @logic
 * 1. Import required dependencies and configuration
 * 2. Execute the primary logic for CTextArea
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
 * SECTION 1: CTextArea Core Logic
 * Section overview and description.
 * --------------------------
 */

import { TextField } from '@mui/material';
import type { TextFieldProps } from '@mui/material';

export const CTextArea = (props: TextFieldProps) => {
  return (
    <TextField
      {...props}
      multiline
      minRows={3}
      fullWidth
      variant="outlined"
    />
  );
};
