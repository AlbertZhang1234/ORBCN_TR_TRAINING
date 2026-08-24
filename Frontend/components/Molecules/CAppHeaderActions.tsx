/**
 * @file 10_Frontend/components/sap/ui/Common/Molecules/CAppHeaderActions.tsx
 * 
 * @summary Core frontend CAppHeaderActions module for the ORBAI Core project
 * @author ORBAICODER
 * @version 1.0.0
 * @date 2025-01-19
 * 
 * @description
 * This file is responsible for:
 *  - Implementing CAppHeaderActions functionality within frontend workflows
 *  - Integrating with shared ORBAI Core application processes under frontend
 * 
 * @logic
 * 1. Import required dependencies and configuration
 * 2. Execute the primary logic for CAppHeaderActions
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
 * SECTION 1: CAppHeaderActions Core Logic
 * Section overview and description.
 * --------------------------
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { 
    Stack, 
    IconButton, 
    Tooltip, 
    Menu, 
    MenuItem, 
    ListItemIcon, 
    Avatar, 
    Divider, 
    useColorScheme 
} from '@mui/material';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import TranslateIcon from '@mui/icons-material/Translate';
import SettingsIcon from '@mui/icons-material/Settings';
import LockResetIcon from '@mui/icons-material/LockReset';
import LogoutIcon from '@mui/icons-material/Logout';
import { performClientLogout } from '../../services/Auth/logoutClient';

export const CAppHeaderActions = () => {
    const router = useRouter();
    const { i18n } = useTranslation();
    const { mode, setMode, systemMode } = useColorScheme();
    const effectiveMode = mode === 'system' ? systemMode : mode;

    const [langAnchorEl, setLangAnchorEl] = useState<null | HTMLElement>(null);
    const [userAnchorEl, setUserAnchorEl] = useState<null | HTMLElement>(null);

    // Theme Toggle
    const toggleTheme = () => {
        setMode(effectiveMode === 'light' ? 'dark' : 'light');
    };

    // Language Handlers
    const handleLangClick = (event: React.MouseEvent<HTMLElement>) => {
        setLangAnchorEl(event.currentTarget);
    };

    const handleLangClose = (lang?: string) => {
        if (lang) {
            i18n.changeLanguage(lang);
        }
        setLangAnchorEl(null);
    };

    // User Menu Handlers
    const handleUserClick = (event: React.MouseEvent<HTMLElement>) => {
        setUserAnchorEl(event.currentTarget);
    };

    const handleUserClose = () => {
        setUserAnchorEl(null);
    };

    const handleLogout = async () => {
        handleUserClose();
        await performClientLogout({ router, replace: true });
    };

    const iconButtonStyle = {
        color: effectiveMode === 'light' ? '#616161' : 'white',
        backgroundColor: effectiveMode === 'light' ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.1)',
        backdropFilter: 'blur(10px)',
        '&:hover': { backgroundColor: effectiveMode === 'light' ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.2)' }
    };

    return (
        <Stack direction="row" spacing={2} alignItems="center">
            {/* Theme Toggle */}
            <Tooltip title="Switch Theme">
                <IconButton onClick={toggleTheme} size="small" sx={iconButtonStyle}>
                    {effectiveMode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
                </IconButton>
            </Tooltip>

            {/* Language Toggle */}
            <Tooltip title="Switch Language">
                <IconButton onClick={handleLangClick} size="small" sx={iconButtonStyle}>
                    <TranslateIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            {/* User Menu */}
            <Tooltip title="User Settings">
                <IconButton 
                    onClick={handleUserClick} 
                    size="small"
                    sx={{ ...iconButtonStyle, p: 0, ml: 1 }}
                >
                    <Avatar sx={{ bgcolor: 'secondary.main', width: 24, height: 24, fontSize: '0.875rem' }}>U</Avatar>
                </IconButton>
            </Tooltip>

            {/* Language Menu */}
            <Menu
                anchorEl={langAnchorEl}
                open={Boolean(langAnchorEl)}
                onClose={() => handleLangClose()}
            >
                <MenuItem onClick={() => handleLangClose('EN')}>English</MenuItem>
                <MenuItem onClick={() => handleLangClose('ZH')}>中文 (Chinese)</MenuItem>
                <MenuItem onClick={() => handleLangClose('JA')}>日本語 (Japanese)</MenuItem>
                <MenuItem onClick={() => handleLangClose('DE')}>Deutsch (German)</MenuItem>
                <MenuItem onClick={() => handleLangClose('FR')}>Français (French)</MenuItem>
            </Menu>

            {/* User Menu */}
            <Menu
                anchorEl={userAnchorEl}
                open={Boolean(userAnchorEl)}
                onClose={handleUserClose}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                slotProps={{
                    paper: {
                        elevation: 0,
                        sx: {
                            overflow: 'visible',
                            filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                            mt: 1.5,
                            '&:before': {
                                content: '""',
                                display: 'block',
                                position: 'absolute',
                                top: 0,
                                right: 14,
                                width: 10,
                                height: 10,
                                bgcolor: 'background.paper',
                                transform: 'translateY(-50%) rotate(45deg)',
                                zIndex: 0,
                            },
                        },
                    }
                }}
            >
                <MenuItem onClick={handleUserClose}>
                    <ListItemIcon>
                        <SettingsIcon fontSize="small" />
                    </ListItemIcon>
                    Personalization
                </MenuItem>
                <MenuItem onClick={handleUserClose}>
                    <ListItemIcon>
                        <LockResetIcon fontSize="small" />
                    </ListItemIcon>
                    Change Password
                </MenuItem>
                <Divider />
                <MenuItem onClick={handleLogout}>
                    <ListItemIcon>
                        <LogoutIcon fontSize="small" />
                    </ListItemIcon>
                    Logout
                </MenuItem>
            </Menu>
        </Stack>
    );
};
