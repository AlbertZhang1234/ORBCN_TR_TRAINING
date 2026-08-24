/**
 * @file 10_Frontend/components/sap/ui/Common/Atoms/CCheckbox.tsx
 * 
 * @summary Core frontend CCheckbox module for the ORBAI Core project
 * @author ORBAICODER
 * @version 1.0.0
 * @date 2025-01-19
 * 
 * @description
 * This file is responsible for:
 *  - Implementing CCheckbox functionality within frontend workflows
 *  - Integrating with shared ORBAI Core application processes under frontend
 * 
 * @logic
 * 1. Import required dependencies and configuration
 * 2. Execute the primary logic for CCheckbox
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
 * SECTION 1: CCheckbox Core Logic
 * Section overview and description.
 * --------------------------
 */

import { Checkbox, FormControlLabel } from '@mui/material';
import type { CheckboxProps } from '@mui/material';

interface CCheckboxProps extends CheckboxProps {
  label: string;
}

export const CCheckbox = ({ label, ...props }: CCheckboxProps) => {
  return (
    <FormControlLabel
      control={<Checkbox {...props} />}
      label={label}
    />
  );
};
