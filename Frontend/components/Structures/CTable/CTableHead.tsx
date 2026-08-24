/**
 * @file 10_Frontend/components/sap/ui/Common/Structures/CTable/CTableHead.tsx
 * 
 * @summary Core frontend CTableHead module for the ORBAI Core project
 * @author ORBAICODER
 * @version 1.0.0
 * @date 2025-01-19
 * 
 * @description
 * This file is responsible for:
 *  - Implementing CTableHead functionality within frontend workflows
 *  - Integrating with shared ORBAI Core application processes under frontend
 * 
 * @logic
 * 1. Import required dependencies and configuration
 * 2. Execute the primary logic for CTableHead
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
 * SECTION 1: CTableHead Core Logic
 * Section overview and description.
 * --------------------------
 */

import React, { useRef, useState, useEffect } from 'react';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import Checkbox from '@mui/material/Checkbox';
import TableSortLabel from '@mui/material/TableSortLabel';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import { visuallyHidden } from '@mui/utils';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';

import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import type { HeadCell } from './types';

// Sortable Header Cell Component
// Wraps TableCell with dnd-kit sortable logic
const SortableHeaderCell = ({ 
  column, 
  order, 
  orderBy, 
  onRequestSort,
  onContextMenu,
  width,
  onResize
}: { 
  column: HeadCell;
  order: 'asc' | 'desc';
  orderBy: string;
  onRequestSort: (event: React.MouseEvent<unknown>, property: string) => void;
  onContextMenu: (event: React.MouseEvent<unknown>) => void;
  width?: number;
  onResize?: (width: number) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: column.id });

  const style = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
    width: width || column.width || column.minWidth,
    minWidth: width || column.width || column.minWidth,
    // CRITICAL: zIndex control for sticky header vs dragging
    // When dragging: Set high zIndex (100) to float above everything
    // When NOT dragging: Set undefined to let MUI's sticky header (zIndex: 2) work naturally
    // If we set zIndex: 0 here, it would override MUI's sticky behavior and hide the header behind content
    zIndex: isDragging ? 100 : undefined, 
    opacity: isDragging ? 0.8 : 1,
    cursor: 'move',
    // position: 'relative' as 'relative', // REMOVED: Breaks sticky header
  };

  const isSelected = orderBy === column.id;

  // Resize Handler
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!onResize) return;
    e.preventDefault();
    e.stopPropagation(); // Prevent dnd-kit from starting drag

    const startX = e.pageX;
    const startWidth = width || column.width || column.minWidth || 100;

    const handleMouseMove = (moveEvent: MouseEvent) => {
        const currentX = moveEvent.pageX;
        const diff = currentX - startX;
        const newWidth = Math.max(50, startWidth + diff); // Minimum width 50px
        onResize(newWidth);
    };

    const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <TableCell
      align={column.align || 'left'}
      sortDirection={isSelected ? order : false}
      ref={setNodeRef}
      style={style}
      sx={{
         backgroundColor: isDragging ? 'action.hover' : (isSelected ? 'action.selected' : 'background.paper'),
         fontWeight: 'bold',
         borderBottom: isSelected ? '2px solid' : undefined,
         borderColor: isSelected ? 'primary.main' : 'divider',
         userSelect: 'none', // Prevent text selection
         // position: 'relative', // REMOVED: Breaks sticky header
         '&:hover [data-resize-handle="true"]': {
             opacity: 1
         },
         '&:hover [data-resize-line="true"]': { // Target the line inside handle
             opacity: 1,
             height: '100%'
         }
      }}
      {...attributes}
      {...listeners}
      onContextMenu={onContextMenu}
      onClick={(event) => onRequestSort(event, column.id)}
    >
      <TableSortLabel
        active={isSelected}
        direction={isSelected ? order : 'asc'}
        onClick={(event) => onRequestSort(event, column.id)}
      >
        {column.label}
        {isSelected ? (
          <Box component="span" sx={visuallyHidden}>
            {order === 'desc' ? 'sorted descending' : 'sorted ascending'}
          </Box>
        ) : null}
      </TableSortLabel>

      {/* Resize Handle */}
      {onResize && (
        <div
            data-resize-handle="true"
            onMouseDown={handleMouseDown}
            onPointerDown={(e) => {
                e.stopPropagation(); // Block dnd-kit drag
                // e.preventDefault(); // Optional, might block other things
            }}
            onClick={(e) => e.stopPropagation()} // Prevent sort click
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: '12px', // Wider hit area (was 5px)
              cursor: 'col-resize',
              zIndex: 20, // High priority to capture clicks
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              touchAction: 'none',
            }}
        >
            {/* Visible Line */}
            <div 
                data-resize-line="true"
                aria-hidden="true"
                style={{
                  width: '2px',
                  height: '40%', // Start smaller
                  backgroundColor: 'var(--mui-palette-primary-main)',
                  opacity: 0,
                  transition: 'all 0.2s',
                  borderRadius: '1px'
                }}
            />
        </div>
      )}
    </TableCell>
  );
};

interface CTableHeadProps {
    columns: HeadCell[];
    visibleColumns: string[];
    order: 'asc' | 'desc';
    orderBy: string;
    onRequestSort: (event: React.MouseEvent<unknown>, property: string) => void;
    onContextMenu: (event: React.MouseEvent<unknown>) => void;
    selectionMode?: 'single' | 'multiple' | 'none';
    grouping: string[];
    isAllExpanded: boolean;
    handleToggleAll: () => void;
    rowCount: number;
    numSelected: number;
    onSelectAllClick: (event: React.ChangeEvent<HTMLInputElement>) => void;
    
    // Resizing
    columnWidths?: Record<string, number>;
    onColumnResize?: (columnId: string, width: number) => void;
}

export const CTableHead: React.FC<CTableHeadProps> = ({
    columns,
    visibleColumns,
    order,
    orderBy,
    onRequestSort,
    onContextMenu,
    selectionMode,
    grouping,
    isAllExpanded,
    handleToggleAll,
    rowCount,
    numSelected,
    onSelectAllClick,
    columnWidths,
    onColumnResize
}) => {
    return (
        <TableHead>
            <TableRow>
                {selectionMode === 'multiple' && (
                    <TableCell padding="checkbox" sx={{ backgroundColor: 'background.paper', width: 48 }}>
                        {grouping.length > 0 ? (
                            <Tooltip title={isAllExpanded ? "Collapse All" : "Expand All"}>
                                <IconButton size="small" onClick={handleToggleAll} sx={{ p: 0.5 }}>
                                    {isAllExpanded ? <UnfoldLessIcon fontSize="small" /> : <UnfoldMoreIcon fontSize="small" />}
                                </IconButton>
                            </Tooltip>
                        ) : (
                            <Checkbox
                                color="primary"
                                indeterminate={numSelected > 0 && numSelected < rowCount}
                                checked={rowCount > 0 && numSelected === rowCount}
                                onChange={onSelectAllClick}
                                inputProps={{
                                    'aria-label': 'select all rows',
                                }}
                            />
                        )}
                    </TableCell>
                )}
                {selectionMode === 'single' && (
                    <TableCell padding="checkbox" sx={{ width: 48 }} />
                )}
                <SortableContext 
                    items={columns.map(c => c.id)} 
                    strategy={horizontalListSortingStrategy}
                >
                    {columns.map((column) => (
                        visibleColumns.includes(column.id) ? (
                            <SortableHeaderCell
                                key={column.id}
                                column={column}
                                order={order}
                                orderBy={orderBy}
                                onRequestSort={onRequestSort}
                                onContextMenu={onContextMenu}
                                width={columnWidths?.[column.id]}
                                onResize={onColumnResize ? (w) => onColumnResize(column.id, w) : undefined}
                            />
                        ) : null
                    ))}
                </SortableContext>
            </TableRow>
        </TableHead>
    );
};
