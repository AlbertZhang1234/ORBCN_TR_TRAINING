/**
 * @file 10_Frontend/components/sap/ui/Common/PageComponents/CLayoutManager.tsx
 * 
 * @summary Smart Component that encapsulates Layout Management logic (API calls + UI).
 * @author ORBAICODER
 * @version 1.0.0
 * @date 2026-01-06
 * 
 * @description
 * This component wraps the presentational `CLayoutManagement` molecule and adds:
 * 1. Automatic fetching of layouts from backend.
 * 2. Handling of Save/Delete/SetDefault API calls.
 * 3. Management of "Current Layout" state.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { CLayoutManagement, LayoutMetadata } from '../Molecules/CLayoutManagement';
import { useTextelement } from '@/hooks/useTextelement';

const DEFAULT_API_URL = 'http://localhost:8888';

export interface CLayoutManagerProps {
    appId: string;
    tableKey?: string; // Optional table identifier for multi-table apps
    currentLayoutData: any; // The actual table state (columns, sort, etc.) to be saved
    onLayoutLoad: (layout: LayoutMetadata) => void;
    targetLayoutId?: string | null;
    activeLayoutId?: string; // Current active layout ID from parent
    serviceUrl?: string;
    onError?: (message: string) => void;
    onSuccess?: (message: string) => void;
}

export const CLayoutManager: React.FC<CLayoutManagerProps> = ({
    appId,
    tableKey = "default",
    currentLayoutData,
    onLayoutLoad,
    targetLayoutId,
    activeLayoutId,
    serviceUrl = DEFAULT_API_URL,
    onError,
    onSuccess
}) => {
    const [layouts, setLayouts] = useState<LayoutMetadata[]>([]);
    const [currentLayoutId, setCurrentLayoutId] = useState<string>('');
    const { getText } = useTextelement('sapcomp');

    // Sync active layout ID from parent
    useEffect(() => {
        if (activeLayoutId !== undefined) {
            setCurrentLayoutId(activeLayoutId);
        }
    }, [activeLayoutId]);

    // Handle targetLayoutId (load request from parent, e.g. from Variant)
    useEffect(() => {
        if (targetLayoutId && layouts.length > 0) {
            const layoutToLoad = layouts.find(l => l.id === targetLayoutId);
            if (layoutToLoad) {
                setCurrentLayoutId(layoutToLoad.id);
                onLayoutLoad(layoutToLoad);
            }
        }
    }, [targetLayoutId, layouts, onLayoutLoad]);

    const fetchLayouts = useCallback(async () => {
        if (!appId) return;
        try {
            const res = await axios.get(`${serviceUrl}/layouts`, { params: { app_id: appId, table_key: tableKey } });
            const data = res.data;
            setLayouts(data);
            
            // Check for default layout if no layout selected
            const defaultLayout = data.find((l: LayoutMetadata) => l.isDefault);
            if (defaultLayout && !currentLayoutId) {
                setCurrentLayoutId(defaultLayout.id);
                onLayoutLoad(defaultLayout);
            }
        } catch (e) {
            console.error("Error fetching layouts", e);
            if (onError) onError(getText('msg.layoutLoadError', 'Failed to load layouts'));
        }
    }, [appId, tableKey, serviceUrl, getText, onError, currentLayoutId, onLayoutLoad]);

    useEffect(() => {
        fetchLayouts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appId, tableKey]);

    const handleSave = async (metadata: Omit<LayoutMetadata, 'id' | 'createdAt' | 'layoutData'>) => {
        try {
            // Check overwrite
            const existingLayout = layouts.find(l => l.name === metadata.name);
            const id = existingLayout ? existingLayout.id : Date.now().toString(); // Use proper ID gen or let backend handle

            const layoutToSave: LayoutMetadata = {
                ...metadata,
                id: id,
                createdAt: new Date().toISOString(),
                layoutData: currentLayoutData
            };
            
            // Backend expects LayoutModel structure
            const payload = { ...layoutToSave, app_id: appId, table_key: tableKey };
            await axios.post(`${serviceUrl}/layouts`, payload);

            
            if (onSuccess) onSuccess(getText('msg.layoutSaved', 'Layout saved successfully'));
            
            await fetchLayouts();
            setCurrentLayoutId(id);
            // Notify parent that this layout is now active
            if (onLayoutLoad) {
                onLayoutLoad(layoutToSave);
            }
        } catch (e) {
            console.error("Error saving layout", e);
            if (onError) onError(getText('msg.layoutSaveError', 'Failed to save layout'));
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await axios.delete(`${serviceUrl}/layouts/${id}`);
            if (currentLayoutId === id) setCurrentLayoutId('');
            if (onSuccess) onSuccess(getText('msg.layoutDeleted', 'Layout deleted'));
            await fetchLayouts();
        } catch (e) {
            console.error("Error deleting layout", e);
            if (onError) onError(getText('msg.layoutDeleteError', 'Failed to delete layout'));
        }
    };

    const handleSetDefault = async (id: string) => {
        try {
             await axios.put(`${serviceUrl}/layouts/${id}/default`, { app_id: appId });
             if (onSuccess) onSuccess(getText('msg.layoutDefaultSet', 'Default layout set'));
             await fetchLayouts();
        } catch (e) {
            console.error("Error setting default", e);
            if (onError) onError(getText('msg.layoutDefaultError', 'Failed to set default layout'));
        }
    };

    const handleLoad = (layout: LayoutMetadata) => {
        setCurrentLayoutId(layout.id);
        onLayoutLoad(layout);
    };

    return (
        <CLayoutManagement
            layouts={layouts}
            currentLayoutId={currentLayoutId}
            onLoad={handleLoad}
            onSave={handleSave}
            onDelete={handleDelete}
            onSetDefault={handleSetDefault}
        />
    );
};
