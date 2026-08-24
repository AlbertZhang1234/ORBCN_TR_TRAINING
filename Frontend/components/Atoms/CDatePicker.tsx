/**
 * @file 10_Frontend/components/sap/ui/Common/Atoms/CDatePicker.tsx
 * 
 * @summary Core frontend CDatePicker module for the ORBAI Core project
 * @author ORBAICODER
 * @version 1.0.0
 * @date 2025-01-19
 * 
 * @description
 * This file is responsible for:
 *  - Implementing CDatePicker functionality within frontend workflows
 *  - Integrating with shared ORBAI Core application processes under frontend
 * 
 * @logic
 * 1. Import required dependencies and configuration
 * 2. Execute the primary logic for CDatePicker
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
 * SECTION 1: CDatePicker Core Logic
 * Section overview and description.
 * --------------------------
 */

import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import type { ComponentProps } from 'react';

type CDatePickerProps = ComponentProps<typeof DatePicker>;

export const CDatePicker = (props: CDatePickerProps) => {
  return (
    <DatePicker
      {...props}
      slotProps={{
        textField: { size: 'small', fullWidth: true, ...props.slotProps?.textField },
        ...props.slotProps
      }}
    />
  );
};
