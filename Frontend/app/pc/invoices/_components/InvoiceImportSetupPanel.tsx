'use client';

import React, { type ChangeEvent, type DragEvent } from 'react';
import {
  Box,
  Button,
  Collapse,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import {
  BUSINESS_TYPE_OPTIONS,
  formatBusinessTypeOption,
} from '../../../../services/Invoice/business-types';

interface Option {
  value: string;
  label: string;
}

interface InvoiceImportSetupPanelProps {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  fileCount: number;
  userId: string;
  onUserIdChange: (value: string) => void;
  businessType: string;
  onBusinessTypeChange: (value: string) => void;
  travelId: string;
  onTravelIdChange: (value: string) => void;
  userOptions: Option[];
  travelOptions: Option[];
  dragActive: boolean;
  parsing: boolean;
  saving: boolean;
  onFilesChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  t: (key: string, fallback: string) => string;
}

export default function InvoiceImportSetupPanel({
  expanded,
  onExpandedChange,
  fileCount,
  userId,
  onUserIdChange,
  businessType,
  onBusinessTypeChange,
  travelId,
  onTravelIdChange,
  userOptions,
  travelOptions,
  dragActive,
  parsing,
  saving,
  onFilesChange,
  onDrop,
  onDragOver,
  onDragLeave,
  t,
}: InvoiceImportSetupPanelProps) {
  const disabled = parsing || saving;
  const userLabel = userOptions.find((option) => option.value === userId)?.label || userId;
  const travelLabel = travelOptions.find((option) => option.value === travelId)?.label || travelId;
  const businessLabel = BUSINESS_TYPE_OPTIONS.find((option) => option.code === businessType);
  const summary = [
    `${t('user_id', 'User ID')}: ${userLabel || t('not_set', 'Not set')}`,
    `${t('business_type', 'Business Type')}: ${businessLabel ? formatBusinessTypeOption(businessLabel, t) : businessType}`,
    `${t('travel_id', 'Travel ID')}: ${travelLabel || t('not_set', 'Not set')}`,
  ].join(' · ');

  const fileInput = (
    <input
      hidden
      type="file"
      accept=".pdf,application/pdf,image/*"
      multiple
      onChange={onFilesChange}
    />
  );

  return (
    <Box
      sx={{
        border: dragActive
          ? '2px dashed #1976d2'
          : '1px dashed rgba(25, 118, 210, 0.38)',
        borderRadius: 1.5,
        bgcolor: dragActive ? 'rgba(25, 118, 210, 0.08)' : 'rgba(25, 118, 210, 0.03)',
        transition: 'background-color 0.15s ease, border-color 0.15s ease',
        flexShrink: 0,
      }}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
    >
      <Collapse in={expanded} timeout={180} unmountOnExit>
        <Stack spacing={1.1} sx={{ p: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              component="label"
              variant="outlined"
              size="small"
              startIcon={<UploadFileRoundedIcon />}
              disabled={disabled}
              sx={{ minHeight: 36, flex: 1 }}
            >
              {t('choose_invoice_files', 'Choose Invoice Files (Multiple)')}
              {fileInput}
            </Button>
            {fileCount > 0 && (
              <Button
                size="small"
                startIcon={<ExpandLessRoundedIcon />}
                onClick={() => onExpandedChange(false)}
                disabled={disabled}
                aria-expanded={expanded}
                sx={{ flexShrink: 0 }}
              >
                {t('collapse_import_settings', 'Collapse settings')}
              </Button>
            )}
          </Stack>

          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            {t(
              'import_files_hint',
              'Drag PDF or image files here. The system uses InvoiceProcessing to extract information.',
            )}
          </Typography>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
              gap: 1.25,
            }}
          >
            <TextField
              label={t('user_id', 'User ID')}
              value={userId}
              onChange={(event) => onUserIdChange(event.target.value)}
              fullWidth
              select
              size="small"
              disabled={userOptions.length === 0 || disabled}
              helperText={
                userOptions.length === 0
                  ? t('no_users_available', 'No users available, please create a user first')
                  : undefined
              }
            >
              {userOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label={t('business_type', 'Business Type')}
              value={businessType}
              onChange={(event) => onBusinessTypeChange(event.target.value)}
              fullWidth
              select
              size="small"
              required
              disabled={disabled}
            >
              {BUSINESS_TYPE_OPTIONS.map((option) => (
                <MenuItem key={option.code} value={option.code}>
                  {formatBusinessTypeOption(option, t)}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label={t('travel_id', 'Travel ID')}
              value={travelId}
              onChange={(event) => onTravelIdChange(event.target.value)}
              fullWidth
              select
              size="small"
              disabled={travelOptions.length === 0 || disabled}
              helperText={
                travelOptions.length === 0
                  ? t('no_travel_available_import', 'No travel entries are available. You may import without one.')
                  : undefined
              }
            >
              <MenuItem value="">{t('none', '(None)')}</MenuItem>
              {travelOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
            {t(
              'import_setup_hint',
              'These settings apply to all imported invoices. Red rows will be skipped when saving.',
            )}
          </Typography>
        </Stack>
      </Collapse>

      <Collapse in={!expanded} timeout={180} unmountOnExit>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1}
          alignItems={{ xs: 'stretch', md: 'center' }}
          sx={{ px: 1.5, py: 1 }}
        >
          <UploadFileRoundedIcon color="primary" fontSize="small" />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
              {parsing
                ? t('parsing_files', 'Parsing files...')
                : t('import_selected_files', '{0} files selected').replace('{0}', String(fileCount))}
            </Typography>
            <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary' }} title={summary}>
              {summary}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.75} sx={{ flexShrink: 0 }}>
            <Button
              component="label"
              variant="outlined"
              size="small"
              startIcon={<UploadFileRoundedIcon />}
              disabled={disabled}
            >
              {t('add_invoice_files', 'Add files')}
              {fileInput}
            </Button>
            <Button
              size="small"
              startIcon={<ExpandMoreRoundedIcon />}
              onClick={() => onExpandedChange(true)}
              disabled={disabled}
              aria-expanded={expanded}
            >
              {t('edit_import_settings', 'Edit settings')}
            </Button>
          </Stack>
        </Stack>
      </Collapse>
    </Box>
  );
}
