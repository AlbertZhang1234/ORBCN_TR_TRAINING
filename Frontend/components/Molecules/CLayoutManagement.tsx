/**
 * @file 10_Frontend/components/sap/ui/Common/Molecules/CLayoutManagement.tsx
 * 
 * @summary Core frontend CLayoutManagement module for the ORBAI Core project
 * @author ORBAICODER
 * @version 1.0.0
 * @date 2026-01-06
 * 
 * @description
 * This file is responsible for:
 *  - Implementing CLayoutManagement functionality within frontend workflows
 *  - Integrating with shared ORBAI Core application processes under frontend
 * 
 * @logic
 * 1. Import required dependencies and configuration
 * 2. Execute the primary logic for CLayoutManagement
 * 3. Export the resulting APIs, hooks, or components for reuse
 * 
 * @changelog
 * V1.0.0 - 2026-01-06 - Initial creation
 */

'use client';

import React, { useState } from 'react';
import { useTextelement } from '@/hooks/useTextelement';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
  Checkbox,
  FormControlLabel,
  Divider,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import DeleteIcon from '@mui/icons-material/Delete';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import ViewQuiltIcon from '@mui/icons-material/ViewQuilt'; // Icon for Layout

// --- Interfaces ---

export interface LayoutMetadata {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  isPublic: boolean;
  createdAt: string;
  layoutData: any;
}

export interface CLayoutManagementProps {
  layouts: LayoutMetadata[];
  currentLayoutId?: string;
  onLoad: (layout: LayoutMetadata) => void;
  onSave: (metadata: Omit<LayoutMetadata, 'id' | 'createdAt' | 'layoutData'>) => void;
  onDelete: (layoutId: string) => void;
  onSetDefault: (layoutId: string) => void;
}

/**
 * CLayoutManagement
 * 
 * A molecule that manages Table Layouts (Columns, Sort, Grouping).
 * It allows users to:
 * 1. Save current table configuration as a Layout.
 * 2. Load existing layouts.
 * 3. Manage layouts (Delete, Set Default).
 */
export const CLayoutManagement: React.FC<CLayoutManagementProps> = ({
  layouts,
  currentLayoutId,
  onLoad,
  onSave,
  onDelete,
  onSetDefault
}) => {
  const { getText } = useTextelement('sapcomp');
  // --- State ---
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  
  // Save Dialog State
  const [newLayoutName, setNewLayoutName] = useState('');
  const [newLayoutDesc, setNewLayoutDesc] = useState('');
  const [saveOptions, setSaveOptions] = useState({
    isDefault: false,
    isPublic: false
  });

  const currentLayout = layouts.find(l => l.id === currentLayoutId);

  // --- Handlers ---

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLayoutSelect = (layout: LayoutMetadata) => {
    onLoad(layout);
    handleMenuClose();
  };

  const handleOpenSaveDialog = () => {
    setNewLayoutName('');
    setNewLayoutDesc('');
    setSaveOptions({
      isDefault: false,
      isPublic: false
    });
    setIsSaveDialogOpen(true);
    handleMenuClose();
  };

  const handleSaveConfirm = () => {
    if (!newLayoutName.trim()) return;
    
    onSave({
      name: newLayoutName,
      description: newLayoutDesc,
      ...saveOptions
    });
    setIsSaveDialogOpen(false);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {/* Save Layout Button - Explicit Action */}
      <Tooltip title={getText('table.layout.saveTitle', 'Save Layout')}>
        <IconButton onClick={handleOpenSaveDialog} color="primary" size="small">
            <SaveIcon />
        </IconButton>
      </Tooltip>

      {/* Layout Options (Load, Manage) */}
      <Tooltip title={getText('table.layout.options', 'Layout Options')}>
        <IconButton onClick={handleMenuOpen} color={currentLayout ? 'primary' : 'default'}>
            <ViewQuiltIcon />
        </IconButton>
      </Tooltip>

      {/* --- Dropdown Menu --- */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{ sx: { width: 320, maxHeight: 400 } }}
      >
        <MenuItem disabled>
          <Typography variant="caption">{getText('table.layout.select', 'Select Layout')}</Typography>
        </MenuItem>
        
        {/* Save Current Action */}
        <MenuItem onClick={handleOpenSaveDialog}>
            <ListItemIcon>
                <SaveIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{getText('table.layout.saveAs', 'Save Current Layout...')}</ListItemText>
        </MenuItem>

        <Divider />
        
        {layouts.length === 0 && (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">{getText('table.layout.noSaved', 'No saved layouts')}</Typography>
          </MenuItem>
        )}
        
        {layouts.map((layout) => (
          <MenuItem 
            key={layout.id} 
            onClick={() => handleLayoutSelect(layout)}
            selected={layout.id === currentLayoutId}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', mr: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" fontWeight={layout.id === currentLayoutId ? 'bold' : 'normal'} noWrap>
                            {layout.name}
                        </Typography>
                    </Box>
                    {layout.description && (
                        <Typography variant="caption" color="text.secondary" noWrap>
                        {layout.description}
                        </Typography>
                    )}
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                    <Tooltip title={layout.isDefault ? getText('table.layout.removeDefault', 'Remove Default') : getText('table.layout.setDefault', 'Set as Default')}>
                        <IconButton 
                            size="small" 
                            onClick={(e) => {
                                e.stopPropagation();
                                onSetDefault(layout.id);
                            }}
                        >
                            {layout.isDefault ? <StarIcon fontSize="small" color="warning" /> : <StarBorderIcon fontSize="small" />}
                        </IconButton>
                    </Tooltip>

                    <Tooltip title={getText('action.delete', 'Delete')}>
                        <IconButton 
                            size="small" 
                            color="error"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(layout.id);
                            }}
                        >
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>
          </MenuItem>
        ))}
      </Menu>

      {/* --- Save Dialog --- */}
      <Dialog open={isSaveDialogOpen} onClose={() => setIsSaveDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{getText('table.layout.saveTitle', 'Save Layout')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label={getText('table.layout.name', 'Layout Name')}
              value={newLayoutName}
              onChange={(e) => setNewLayoutName(e.target.value)}
              fullWidth
              autoFocus
              size="small"
              helperText={getText('table.layout.nameHelper', "e.g., 'Compact View'")}
            />
             {layouts.some(l => l.name === newLayoutName) && (
               <Typography variant="caption" color="warning.main" sx={{ ml: 1 }}>
                 {getText('table.layout.overwriteWarning', 'Warning: Existing layout will be overwritten')}
               </Typography>
             )}
            <TextField
              label={getText('table.layout.description', 'Description')}
              value={newLayoutDesc}
              onChange={(e) => setNewLayoutDesc(e.target.value)}
              fullWidth
              size="small"
            />
            
            <FormControlLabel
              control={
                <Checkbox 
                  checked={saveOptions.isDefault}
                  onChange={(e) => setSaveOptions({...saveOptions, isDefault: e.target.checked})}
                />
              }
              label={getText('table.layout.useAsDefault', 'Use as Default Layout')}
            />

            <FormControlLabel
              control={
                <Checkbox 
                  checked={saveOptions.isPublic}
                  onChange={(e) => setSaveOptions({...saveOptions, isPublic: e.target.checked})}
                />
              }
              label={getText('table.layout.public', 'Public (Visible to all users)')}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsSaveDialogOpen(false)}>{getText('action.cancel', 'Cancel')}</Button>
          <Button onClick={handleSaveConfirm} variant="contained" disabled={!newLayoutName}>
            {getText('action.save', 'Save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};


