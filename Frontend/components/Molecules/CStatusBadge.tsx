/**
 * @file 10_Frontend/components/sap/ui/Common/Molecules/CStatusBadge.tsx
 * 
 * @summary Core frontend CStatusBadge module for the ORBAI Core project
 * @author ORBAICODER
 * @version 1.0.0
 * @date 2025-01-19
 * 
 * @description
 * This file is responsible for:
 *  - Implementing CStatusBadge functionality within frontend workflows
 *  - Integrating with shared ORBAI Core application processes under frontend
 * 
 * @logic
 * 1. Import required dependencies and configuration
 * 2. Execute the primary logic for CStatusBadge
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
 * SECTION 1: CStatusBadge Core Logic
 * Section overview and description.
 * --------------------------
 */

import { CChip } from '../Atoms/CChip';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import { useTextelement } from '@/hooks/useTextelement';

interface CStatusBadgeProps {
  status: 'OK' | 'Error' | 'Warning' | string;
  showIcon?: boolean;
}

export const CStatusBadge = ({ status, showIcon = true }: CStatusBadgeProps) => {
  const { getText } = useTextelement('COMMON', true);
  let color: 'success' | 'error' | 'warning' | 'default' = 'default';
  let icon = undefined;
  let label = status;

  if (status === 'OK') {
    color = 'success';
    icon = <CheckCircleIcon fontSize="small" />;
    label = getText('COMMON_SUCCESS', 'Success');
  } else if (status === 'Error') {
    color = 'error';
    icon = <ErrorIcon fontSize="small" />;
    label = getText('COMMON_ERROR', 'Error');
  } else if (status === 'Warning') {
    color = 'warning';
    icon = <WarningIcon fontSize="small" />;
    label = getText('COMMON_WARNING', 'Warning');
  }

  return (
    <CChip
      label={label}
      color={color}
      icon={showIcon && icon ? icon : undefined}
      size="small"
    />
  );
};
