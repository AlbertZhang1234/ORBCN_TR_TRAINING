/**
 * @file 10_Frontend/components/sap/ui/Common/Styles/theme.tsx
 * 
 * @summary Core frontend theme module for the ORBAI Core project
 * @author ORBAICODER
 * @version 1.0.0
 * @date 2025-01-19
 * 
 * @description
 * This file is responsible for:
 *  - Implementing theme functionality within frontend workflows
 *  - Integrating with shared ORBAI Core application processes under frontend
 * 
 * @logic
 * 1. Import required dependencies and configuration
 * 2. Execute the primary logic for theme
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
 * SECTION 1: theme Core Logic
 * Section overview and description.
 * --------------------------
 */

import { extendTheme } from '@mui/material/styles';

const theme = extendTheme({
  colorSchemeSelector: 'class',
  colorSchemes: {
    light: {
      palette: {
        primary: {
          main: '#0a6ed1', // SAP Blue-ish
        },
        secondary: {
          main: '#f0ab00', // SAP Gold-ish
        },
        background: {
          //default: '#f5f7fa',
          default: '#ffffff',
          paper: '#ffffff',
        },
        text: {
          primary: '#32363a',
          secondary: '#555555',
        },
      },
    },
    dark: {
      palette: {
        primary: {
          main: '#ffffff', // White for primary actions in dark mode (contrast against deep blue)
        },
        secondary: {
          main: '#ffd25c', // Lighter Gold for Dark Mode
        },
        background: {
          default: '#101928', // Matches --orbai-surface-1
          paper: '#111a2c', // Matches --orbai-surface-2
        },
        text: {
          primary: '#ffffff',
          secondary: '#b0b0b0',
        },
      },
    },
  },
  typography: {
    fontFamily: [
      '"72"', // SAP font if available
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});

export default theme;
