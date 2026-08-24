/**
 * @file 10_Frontend/components/sap/ui/Common/Molecules/CDateRangePicker.tsx
 * 
 * @summary Core frontend CDateRangePicker module for the ORBAI Core project
 * @author ORBAICODER
 * @version 1.0.0
 * @date 2025-01-19
 * 
 * @description
 * This file is responsible for:
 *  - Implementing CDateRangePicker functionality within frontend workflows
 *  - Integrating with shared ORBAI Core application processes under frontend
 * 
 * @logic
 * 1. Import required dependencies and configuration
 * 2. Execute the primary logic for CDateRangePicker
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
 * SECTION 1: CDateRangePicker Core Logic
 * Section overview and description.
 * --------------------------
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Popover, 
  TextField, 
  InputAdornment, 
  IconButton, 
  Stack, 
  Chip, 
  Button,
  Divider,
  styled,
  Typography
} from '@mui/material';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { PickersDay } from '@mui/x-date-pickers/PickersDay';
import type { PickersDayProps } from '@mui/x-date-pickers/PickersDay';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ClearIcon from '@mui/icons-material/Clear';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import dayjs, { Dayjs } from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';

dayjs.extend(isBetween);

interface CDateRangePickerProps {
  label?: string;
  value?: [Dayjs | null, Dayjs | null];
  onChange?: (newValue: [Dayjs | null, Dayjs | null]) => void;
}

const DEFAULT_VALUE: [Dayjs | null, Dayjs | null] = [null, null];

// Custom styled Day component for range highlighting
interface CustomPickerDayProps extends PickersDayProps {
  isInRange?: boolean;
  isStart?: boolean;
  isEnd?: boolean;
  isHovered?: boolean;
}

const CustomPickersDay = styled(PickersDay, {
  shouldForwardProp: (prop) => 
    prop !== 'isInRange' && 
    prop !== 'isStart' && 
    prop !== 'isEnd' && 
    prop !== 'isHovered',
})<CustomPickerDayProps>(({ theme, isInRange, isStart, isEnd, isHovered }) => ({
  ...(isInRange && {
    borderRadius: 0,
    backgroundColor: theme.palette.primary.light,
    color: theme.palette.primary.contrastText,
    '&:hover': {
      backgroundColor: theme.palette.primary.main,
    },
  }),
  ...(isHovered && !isInRange && !isStart && !isEnd && {
    borderRadius: 0,
    backgroundColor: theme.palette.action.hover,
    border: `1px dashed ${theme.palette.primary.main}`,
  }),
  ...(isStart && {
    borderRadius: '50% 0 0 50%',
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
    },
  }),
  ...(isEnd && {
    borderRadius: '0 50% 50% 0',
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
    },
  }),
  // Handle case where start == end (single day range)
  ...(isStart && isEnd && {
    borderRadius: '50%',
  }),
})) as React.ComponentType<CustomPickerDayProps>;

export const CDateRangePicker = ({ 
  label = 'Date Range',
  value = DEFAULT_VALUE,
  onChange,
}: CDateRangePickerProps) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [internalValue, setInternalValue] = useState<[Dayjs | null, Dayjs | null]>(value);
  const [selectionStep, setSelectionStep] = useState<'start' | 'end'>('start');
  const [hoveredDay, setHoveredDay] = useState<Dayjs | null>(null);
  const [viewDate, setViewDate] = useState<Dayjs>(value[0] || dayjs());
  
  // Ref to track previous prop value for comparison
  const prevValueRef = React.useRef(value);

  useEffect(() => {
    // Check if the prop value has changed meaningfully from the previous prop value
    const [start, end] = value;
    const [prevStart, prevEnd] = prevValueRef.current;
    
    // Defensive check: Ensure start/end are valid Dayjs objects before calling isSame
    const isDayjs = (d: any) => d && typeof d.isSame === 'function';

    const startChanged = !((start === null && prevStart === null) || 
        (isDayjs(start) && isDayjs(prevStart) && start.isSame(prevStart, 'day')));
        
    const endChanged = !((end === null && prevEnd === null) || 
        (isDayjs(end) && isDayjs(prevEnd) && end.isSame(prevEnd, 'day')));
    
    if (startChanged || endChanged) {
        setInternalValue(value);
        if (value[0] && isDayjs(value[0])) {
            setViewDate(value[0]);
        }
    }
    
    // Update ref
    prevValueRef.current = value;
  }, [value]);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setSelectionStep('start');
    setHoveredDay(null);
  };

  const open = Boolean(anchorEl);

  // Handle Date Selection
  const handleDateChange = (newDate: Dayjs | null) => {
    if (!newDate) return;

    let nextValue: [Dayjs | null, Dayjs | null] = [...internalValue];

    if (selectionStep === 'start') {
      // Set start date, clear end date
      nextValue = [newDate, null];
      setSelectionStep('end');
    } else {
      // We are picking the end date
      const startDate = nextValue[0];
      
      if (startDate && newDate.isBefore(startDate)) {
        // If clicked date is before start date, make it the new start date
        nextValue = [newDate, null];
        setSelectionStep('end');
      } else {
        // Valid end date
        nextValue = [startDate, newDate];
        setSelectionStep('start'); // Reset cycle
      }
    }

    setInternalValue(nextValue);
  };

  // Shortcuts
  const handleShortcut = (type: 'today' | 'week' | 'month') => {
    const today = dayjs();
    let nextValue: [Dayjs | null, Dayjs | null] = [null, null];

    switch (type) {
      case 'today':
        nextValue = [today, today];
        break;
      case 'week':
        nextValue = [today.startOf('week'), today.endOf('week')];
        break;
      case 'month':
        nextValue = [today.startOf('month'), today.endOf('month')];
        break;
    }

    setInternalValue(nextValue);
    setSelectionStep('start');
    setViewDate(today);
  };

  const handleReset = () => {
    setInternalValue([null, null]);
    setSelectionStep('start');
    setViewDate(dayjs());
  };

  const handleDone = () => {
    if (onChange) onChange(internalValue);
    handleClose();
  };

  const handleCancel = () => {
    setInternalValue(value);
    setSelectionStep('start');
    handleClose();
  };

  // Render Custom Day
  const renderWeekPickerDay = useCallback((
    props: PickersDayProps
  ) => {
    const { day, ...other } = props;
    const [start, end] = internalValue;

    const isStart = start ? day.isSame(start, 'day') : false;
    const isEnd = end ? day.isSame(end, 'day') : false;
    const isInRange = start && end ? day.isBetween(start, end, 'day', '()') : false;

    // Preview range on hover
    // If we have a start date, no end date, and we are hovering a date after start
    let isHoverRange = false;
    if (selectionStep === 'end' && start && !end && hoveredDay) {
        if (day.isAfter(start, 'day') && day.isBefore(hoveredDay.add(1, 'day'), 'day')) {
            isHoverRange = true;
        }
    }

    return (
      <CustomPickersDay
        {...other}
        day={day}
        disableMargin
        isStart={isStart}
        isEnd={isEnd}
        isInRange={isInRange || isHoverRange}
        onMouseEnter={() => setHoveredDay(day)}
      />
    );
  }, [internalValue, selectionStep, hoveredDay]);

  const formatDate = (date: Dayjs | null) => date ? date.format('YYYY-MM-DD') : '';

  return (
    <Box>
      <TextField
        label={label}
        value={internalValue[0] ? `${formatDate(internalValue[0])} - ${formatDate(internalValue[1])}` : ''}
        onClick={handleClick}
        fullWidth
        size="small"
        InputProps={{
            readOnly: true,
            endAdornment: (
                <InputAdornment position="end">
                    {(internalValue[0] || internalValue[1]) && (
                        <IconButton 
                            size="small" 
                            onClick={(e) => {
                                e.stopPropagation();
                                handleReset();
                            }}
                            edge="end"
                            sx={{ mr: 0.5 }}
                        >
                            <ClearIcon fontSize="small" />
                        </IconButton>
                    )}
                    <IconButton size="small" edge="end" onClick={handleClick}>
                        <CalendarMonthIcon fontSize="small" color="action" />
                    </IconButton>
                </InputAdornment>
            )
        }}
      />

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        slotProps={{
            paper: {
                sx: { display: 'flex', flexDirection: 'column', p: 0, minWidth: 320 }
            }
        }}
      >
        <Box sx={{ p: 2, bgcolor: 'background.default', borderBottom: 1, borderColor: 'divider' }}>
            <Stack direction="row" alignItems="center" spacing={2} justifyContent="space-between">
                <Box 
                    sx={{ 
                        p: 1, 
                        border: 1, 
                        borderColor: selectionStep === 'start' ? 'primary.main' : 'divider',
                        borderRadius: 1,
                        bgcolor: selectionStep === 'start' ? 'action.hover' : 'transparent',
                        flex: 1,
                        cursor: 'pointer'
                    }}
                    onClick={() => setSelectionStep('start')}
                >
                    <Typography variant="caption" color="text.secondary" display="block">Start Date</Typography>
                    <Typography variant="body2" fontWeight={500}>
                        {internalValue[0] ? internalValue[0].format('MMM DD, YYYY') : 'Select...'}
                    </Typography>
                </Box>
                <ArrowForwardIcon color="action" fontSize="small" />
                <Box 
                     sx={{ 
                        p: 1, 
                        border: 1, 
                        borderColor: selectionStep === 'end' ? 'primary.main' : 'divider',
                        borderRadius: 1,
                        bgcolor: selectionStep === 'end' ? 'action.hover' : 'transparent',
                        flex: 1,
                        cursor: 'pointer'
                    }}
                    onClick={() => {
                        if (internalValue[0]) setSelectionStep('end');
                    }}
                >
                    <Typography variant="caption" color="text.secondary" display="block">End Date</Typography>
                    <Typography variant="body2" fontWeight={500}>
                        {internalValue[1] ? internalValue[1].format('MMM DD, YYYY') : 'Select...'}
                    </Typography>
                </Box>
            </Stack>
        </Box>

        <Box sx={{ p: 2, pb: 0 }}>
            <Stack direction="row" spacing={1} justifyContent="center">
            <Chip 
                label="Today" 
                onClick={() => handleShortcut('today')} 
                clickable 
                size="small"
                variant="outlined"
            />
            <Chip 
                label="This Week" 
                onClick={() => handleShortcut('week')} 
                clickable 
                size="small"
                variant="outlined"
            />
            <Chip 
                label="This Month" 
                onClick={() => handleShortcut('month')} 
                clickable 
                size="small"
                variant="outlined"
            />
            </Stack>
        </Box>

        <DateCalendar
            value={null}
            referenceDate={viewDate}
            onMonthChange={setViewDate}
            onYearChange={setViewDate}
            onChange={handleDateChange}
            slots={{
                day: renderWeekPickerDay
            }}
            views={['day']}
            showDaysOutsideCurrentMonth
            sx={{ m: 0 }}
        />

        <Divider />
        <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ p: 2 }}>
            <Button size="small" onClick={handleCancel} color="inherit">Cancel</Button>
            <Button size="small" variant="contained" onClick={handleDone}>Done</Button>
        </Stack>
      </Popover>
    </Box>
  );
};
