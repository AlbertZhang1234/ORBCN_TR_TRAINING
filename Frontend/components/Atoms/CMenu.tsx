/**
 * @file 10_Frontend/components/sap/ui/Common/Atoms/CMenu.tsx
 * 
 * @summary Core frontend CMenu module for the ORBAI Core project
 * @author ORBAICODER
 * @version 1.0.0
 * @date 2025-01-19
 * 
 * @description
 * This file is responsible for:
 *  - Implementing CMenu functionality within frontend workflows
 *  - Integrating with shared ORBAI Core application processes under frontend
 * 
 * @logic
 * 1. Import required dependencies and configuration
 * 2. Execute the primary logic for CMenu
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
 * SECTION 1: CMenu Core Logic
 * Section overview and description.
 * --------------------------
 */

import React, { useState } from 'react';
import { Button, Menu, MenuItem } from '@mui/material';
import type { MenuProps } from '@mui/material';

interface CMenuProps extends Partial<MenuProps> {
  triggerLabel: string;
  items: { label: string; onClick?: () => void }[];
}

export const CMenu = ({ triggerLabel, items, ...props }: CMenuProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <Button
        variant="contained"
        onClick={handleClick}
      >
        {triggerLabel}
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        {...props}
      >
        {items.map((item, index) => (
          <MenuItem 
            key={index} 
            onClick={() => {
              item.onClick?.();
              handleClose();
            }}
          >
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};
