/**
 * @file 10_Frontend/components/sap/ui/Common/Atoms/CRadioGroup.tsx
 * 
 * @summary Core frontend CRadioGroup module for the ORBAI Core project
 * @author ORBAICODER
 * @version 1.0.0
 * @date 2025-01-19
 * 
 * @description
 * This file is responsible for:
 *  - Implementing CRadioGroup functionality within frontend workflows
 *  - Integrating with shared ORBAI Core application processes under frontend
 * 
 * @logic
 * 1. Import required dependencies and configuration
 * 2. Execute the primary logic for CRadioGroup
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
 * SECTION 1: CRadioGroup Core Logic
 * Section overview and description.
 * --------------------------
 */

import { Radio, RadioGroup, FormControlLabel, FormControl, FormLabel } from '@mui/material';
import type { RadioGroupProps } from '@mui/material';

interface CRadioOption {
  value: string;
  label: string;
}

interface CRadioGroupProps extends RadioGroupProps {
  label?: string;
  options: CRadioOption[];
}

export const CRadioGroup = ({ label, options, ...props }: CRadioGroupProps) => {
  return (
    <FormControl>
      {label && <FormLabel>{label}</FormLabel>}
      <RadioGroup {...props}>
        {options.map((option) => (
          <FormControlLabel
            key={option.value}
            value={option.value}
            control={<Radio />}
            label={option.label}
          />
        ))}
      </RadioGroup>
    </FormControl>
  );
};
