/**
 * @file 10_Frontend/components/sap/ui/Common/Atoms/CSelect.tsx
 * 
 * @summary Core frontend CSelect module for the ORBAI Core project
 * @author ORBAICODER
 * @version 1.0.0
 * @date 2025-01-19
 * 
 * @description
 * This file is responsible for:
 *  - Implementing CSelect functionality within frontend workflows
 *  - Integrating with shared ORBAI Core application processes under frontend
 * 
 * @logic
 * 1. Import required dependencies and configuration
 * 2. Execute the primary logic for CSelect
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
 * SECTION 1: CSelect Core Logic
 * Section overview and description.
 * --------------------------
 */

import { Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import type { SelectProps } from '@mui/material';

interface COption {
  value: string | number;
  label: string;
}

type CSelectProps = SelectProps<any> & {
  label?: string;
  options: COption[];
  minWidth?: number | string;
};

export const CSelect = ({ label, options, minWidth = 120, ...props }: CSelectProps) => {
  return (
    <FormControl fullWidth size="small" sx={{ minWidth }}>
      {label && <InputLabel>{label}</InputLabel>}
      <Select label={label} {...props}>
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};
