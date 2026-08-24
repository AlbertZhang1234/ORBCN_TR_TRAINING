/**
 * @file 10_Frontend/components/sap/ui/Common/Atoms/CFileUpload.tsx
 * 
 * @summary Core frontend CFileUpload module for the ORBAI Core project
 * @author ORBAICODER
 * @version 1.0.0
 * @date 2025-01-19
 * 
 * @description
 * This file is responsible for:
 *  - Implementing CFileUpload functionality within frontend workflows
 *  - Integrating with shared ORBAI Core application processes under frontend
 * 
 * @logic
 * 1. Import required dependencies and configuration
 * 2. Execute the primary logic for CFileUpload
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
 * SECTION 1: CFileUpload Core Logic
 * Section overview and description.
 * --------------------------
 */

import React, { useState, useRef } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { Box, Typography, Stack, IconButton, useTheme, alpha } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';

interface CFileUploadProps {
  /**
   * Callback fired when files are selected or removed
   */
  onFilesSelected?: (files: File[]) => void;
  /**
   * Whether to allow multiple files selection
   * @default false
   */
  multiple?: boolean;
  /**
   * Accepted file types (e.g. "image/*, .pdf")
   * @default "*"
   */
  accept?: string;
  /**
   * Maximum file size in bytes
   */
  maxSize?: number;
  /**
   * Title text to display in the drop zone
   */
  title?: string;
  /**
   * Subtitle text to display in the drop zone
   */
  subtitle?: string;
}

export const CFileUpload: React.FC<CFileUploadProps> = ({
  onFilesSelected,
  multiple = false,
  accept = '*',
  maxSize,
  title = 'Drag and drop files here or click to upload',
  subtitle = 'Support for bulk upload'
}) => {
  const theme = useTheme();
  const [isDragOver, setIsDragOver] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      handleFiles(selectedFiles);
    }
  };

  const handleFiles = (newFiles: File[]) => {
    // Filter by max size if needed
    const validFiles = maxSize 
      ? newFiles.filter(f => f.size <= maxSize) 
      : newFiles;

    if (validFiles.length < newFiles.length) {
      console.warn(`Some files were rejected because they exceed the maximum size of ${maxSize} bytes.`);
    }

    let updatedFiles = multiple ? [...files, ...validFiles] : validFiles;
    
    // De-duplicate by name + size + lastModified
    if (multiple) {
      updatedFiles = updatedFiles.filter((file, index, self) =>
        index === self.findIndex((f) => (
          f.name === file.name && f.size === file.size && f.lastModified === file.lastModified
        ))
      );
    } else {
        // If not multiple, just take the last selected/dropped file(s) (should be one usually if input is single)
        // But if multiple=false, we already replaced 'files' with 'validFiles' in the let definition above (if logic was slightly different).
        // Actually: let updatedFiles = multiple ? ... : validFiles; handles it.
    }

    setFiles(updatedFiles);
    if (onFilesSelected) {
      onFilesSelected(updatedFiles);
    }
    
    // Reset input value to allow selecting the same file again if needed (after delete)
    if (inputRef.current) {
        inputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    if (onFilesSelected) {
      onFilesSelected(newFiles);
    }
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        sx={{
          border: `2px dashed ${isDragOver ? theme.palette.primary.main : theme.palette.grey[400]}`,
          borderRadius: 2,
          p: 4,
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: isDragOver ? alpha(theme.palette.primary.main, 0.08) : theme.palette.background.paper,
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            borderColor: theme.palette.primary.main,
            backgroundColor: alpha(theme.palette.primary.main, 0.04),
          }
        }}
      >
        <input
          type="file"
          ref={inputRef}
          style={{ display: 'none' }}
          multiple={multiple}
          accept={accept}
          onChange={handleInputChange}
        />
        <Stack spacing={1} alignItems="center">
          <CloudUploadIcon sx={{ fontSize: 48, color: isDragOver ? 'primary.main' : 'text.secondary' }} />
          <Typography variant="h6" color="text.primary">
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        </Stack>
      </Box>

      {files.length > 0 && (
        <Stack spacing={1} sx={{ mt: 2 }}>
          {files.map((file, index) => (
            <Box
              key={`${file.name}-${index}`}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 1,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 1,
                backgroundColor: theme.palette.background.default
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden' }}>
                <InsertDriveFileIcon color="action" />
                <Typography variant="body2" noWrap>
                  {file.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  ({(file.size / 1024).toFixed(1)} KB)
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => removeFile(index)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
};
