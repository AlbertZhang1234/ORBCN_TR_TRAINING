/**
 * @file 10_Frontend/components/sap/ui/Common/PageComponents/CVariantManager.tsx
 * 
 * @summary Smart Component that encapsulates Variant Management logic (API calls + UI).
 * @author ORBAICODER
 * @version 1.0.0
 * @date 2026-01-05
 * 
 * @description
 * This component wraps the presentational `CVariantManagement` molecule and adds:
 * 1. Automatic fetching of variants from backend.
 * 2. Handling of Save/Delete/SetDefault API calls.
 * 3. Management of "Current Variant" state.
 * 
 * It eliminates the need to manually implement `VariantService` and handlers in every page.
 * 
 * @usage
 * ```tsx
 * <CVariantManager 
 *    appId="my_app_id" 
 *    currentFilters={filters}
 *    currentLayout={layout}
 *    onLoad={(variant) => {
 *       setFilters(variant.filters);
 *       setLayout(variant.layout);
 *    }}
 * />
 * ```
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { CVariantManagement, VariantMetadata } from '../Molecules/CVariantManagement';
import { useTextelement } from '@/hooks/useTextelement';
import { variantService as sharedVariantService } from '@/services/common/variant-service';

// Default API URL (can be overridden via props or env)
const DEFAULT_API_URL = 'http://localhost:8888';

export interface IVariantService {
    getVariants: (appId: string, tableKey?: string) => Promise<VariantMetadata[]>;
    saveVariant: (variant: VariantMetadata, appId: string, tableKey?: string) => Promise<void>;
    deleteVariant: (id: string) => Promise<void>;
    setDefaultVariant: (id: string, appId: string, tableKey?: string) => Promise<void>;
}

interface CVariantManagerProps {
    /**
     * Unique Application ID for separating variants (e.g., 'm_sapbp_BusinessPartner')
     */
    appId: string;

    /**
     * Current filter state to be saved
     */
    currentFilters?: Record<string, any> | any[];

    /**
     * Current layout state to be saved
     */
    currentLayout?: any;

    /**
     * ID of the currently selected independent layout
     */
    currentLayoutId?: string;

    /**
     * Optional: Table Key for multi-table support (default: 'default')
     * Used to scope filters and layouts within the variant.
     */
    tableKey?: string;

    /**
     * Optional: Array of layout references for multi-table support
     * If provided, this takes precedence over currentLayoutId for saving.
     */
    layoutRefs?: Array<{ tableKey: string; layoutId: string | null }>;

    /**
     * Callback when a variant is selected/loaded
     */
    onLoad: (variant: VariantMetadata) => void;

    /**
     * Optional: Custom Variant Service implementation
     * If provided, it overrides the default Axios implementation.
     */
    variantService?: IVariantService;

    /**
     * Optional: Base URL for the Variant Service (only used if variantService is NOT provided)
     * Default: http://localhost:8888
     */
    serviceUrl?: string;
    
    /**
     * Optional: Callback for error handling
     */
    onError?: (message: string) => void;

    /**
     * Optional: Callback for success handling
     */
    onSuccess?: (message: string) => void;

    /**
     * Optional: Controlled current variant ID.
     * If provided, the component acts as a controlled component.
     */
    currentVariantId?: string;

    /**
     * Optional: Callback when variant ID changes (for controlled mode)
     * Note: onLoad is already used for loading the full variant data.
     */
    onVariantChange?: (variantId: string) => void;
}

export const CVariantManager: React.FC<CVariantManagerProps> = ({
    appId,
    tableKey = 'default',
    currentFilters,
    currentLayout,
    currentLayoutId: propLayoutId,
    layoutRefs,
    onLoad,
    variantService,
    serviceUrl = DEFAULT_API_URL,
    onError,
    onSuccess,
    currentVariantId: propCurrentVariantId,
    onVariantChange
}) => {
    const [variants, setVariants] = useState<VariantMetadata[]>([]);
    const [internalCurrentVariantId, setInternalCurrentVariantId] = useState<string>('');
    const { getText } = useTextelement('sapcomp');

    const currentVariantId = propCurrentVariantId !== undefined ? propCurrentVariantId : internalCurrentVariantId;

    const handleVariantChange = (id: string) => {
        if (propCurrentVariantId === undefined) {
            setInternalCurrentVariantId(id);
        }
        if (onVariantChange) {
            onVariantChange(id);
        }
    };

    const service = variantService || sharedVariantService;

    // --- Service Methods ---

    const fetchVariants = useCallback(async () => {
        if (!appId) return [];
        try {
            const data = await service.getVariants(appId, tableKey);
            setVariants(data);
            
            // Check for default variant
            const defaultVariant = data.find((v: VariantMetadata) => v.isDefault);
            if (defaultVariant && !currentVariantId) {
                handleVariantChange(defaultVariant.id);
                onLoad(defaultVariant);
            }
            return data;
        } catch (e) {
            console.error("Error fetching variants", e);
            if (onError) onError(getText('msg.variantLoadError', 'Failed to load variants'));
            return [];
        }
    }, [appId, service, getText, onError, currentVariantId, onLoad, handleVariantChange]);

    // Initial Load
    useEffect(() => {
        fetchVariants();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appId]);

    const handleSave = async (metadata: Omit<VariantMetadata, 'id' | 'createdAt'>) => {
        try {
            // Check for existing variant to merge with (for multi-table support)
            const existingVariant = variants.find(v => v.name === metadata.name);
            const id = existingVariant ? existingVariant.id : Date.now().toString();

            // --- Merge Logic for Filters ---
            let filtersToSave: any[] = [];
            // 1. Load existing
            if (existingVariant) {
                if (Array.isArray(existingVariant.filters)) {
                    filtersToSave = [...existingVariant.filters];
                } else if (existingVariant.filters) {
                    // Migrate legacy single filters
                    filtersToSave = [{ scope: 'default', filters: existingVariant.filters }];
                }
            }
            // 2. Update/Append current
            if (metadata.scope === 'Search' || metadata.scope === 'Both') {
                const currentFiltersData = Array.isArray(currentFilters) ? currentFilters : currentFilters;
                // Note: If currentFilters is already an array (e.g. passed from useSmartTable), 
                // it might already contain the structure. But if it's raw object, we wrap it.
                // If currentFilters IS an array, we assume it's the FULL array or we need to check?
                // Usually CVariantManager receives raw filters for the current context.
                
                if (currentFiltersData) {
                    // If currentFilters is array of scopes, replace entirely? Or merge?
                    // Safer assumption: CVariantManager receives filters for ONE table (current context)
                    // unless passed as a full array.
                    // Given the props `currentFilters` is usually the state of the filter bar.
                    
                    if (Array.isArray(currentFiltersData) && currentFiltersData.length > 0 && currentFiltersData[0].scope) {
                         // It's already in the format, merge these entries
                         currentFiltersData.forEach((newItem: any) => {
                             const idx = filtersToSave.findIndex((f: any) => f.scope === newItem.scope);
                             if (idx >= 0) filtersToSave[idx] = newItem;
                             else filtersToSave.push(newItem);
                         });
                    } else {
                        // It's a raw filter object for the current tableKey
                        const newItem = { scope: tableKey, filters: currentFiltersData };
                        const idx = filtersToSave.findIndex((f: any) => f.scope === tableKey);
                        if (idx >= 0) filtersToSave[idx] = newItem;
                        else filtersToSave.push(newItem);
                    }
                }
            }

            // --- Merge Logic for Layout Data (Snapshot) ---
            let layoutToSave: any[] = [];
            if (existingVariant) {
                if (Array.isArray(existingVariant.layout)) {
                    layoutToSave = [...existingVariant.layout];
                } else if (existingVariant.layout) {
                    layoutToSave = [{ tableKey: 'default', layoutData: existingVariant.layout }];
                }
            }
            if (metadata.scope === 'Layout' || metadata.scope === 'Both') {
                if (currentLayout) {
                    // Check if currentLayout is already array
                    if (Array.isArray(currentLayout) && currentLayout.length > 0 && currentLayout[0].tableKey) {
                        currentLayout.forEach((newItem: any) => {
                            const idx = layoutToSave.findIndex((l: any) => l.tableKey === newItem.tableKey);
                            if (idx >= 0) layoutToSave[idx] = newItem;
                            else layoutToSave.push(newItem);
                        });
                    } else {
                        const newItem = { tableKey: tableKey, layoutData: currentLayout };
                        const idx = layoutToSave.findIndex((l: any) => l.tableKey === tableKey);
                        if (idx >= 0) layoutToSave[idx] = newItem;
                        else layoutToSave.push(newItem);
                    }
                }
            }

            // --- Merge Logic for Layout IDs (References) ---
            let layoutRefsToSave: Array<{ tableKey: string; layoutId: string | null }> = [];
            if (existingVariant) {
                if (Array.isArray(existingVariant.layoutRefs)) {
                    layoutRefsToSave = existingVariant.layoutRefs
                        .filter((item: any) => item && typeof item.tableKey === 'string')
                        .map((item: any) => ({
                            tableKey: String(item.tableKey),
                            layoutId: item.layoutId == null ? null : String(item.layoutId),
                        }));
                } else if (existingVariant.layoutId && typeof existingVariant.layoutId === 'string') {
                    layoutRefsToSave = [{ tableKey: 'default', layoutId: existingVariant.layoutId }];
                }
            }
            if (metadata.scope === 'Layout' || metadata.scope === 'Both') {
                const layoutRefsToUse = layoutRefs || (propLayoutId ? [{ tableKey, layoutId: propLayoutId }] : []);

                layoutRefsToUse.forEach((newItem: any) => {
                    if (!newItem || typeof newItem.tableKey !== 'string') {
                        return;
                    }
                    const normalized = {
                        tableKey: String(newItem.tableKey),
                        layoutId: newItem.layoutId == null ? null : String(newItem.layoutId),
                    };
                    const idx = layoutRefsToSave.findIndex((l) => l.tableKey === normalized.tableKey);
                    if (idx >= 0) {
                        layoutRefsToSave[idx] = normalized;
                    } else {
                        layoutRefsToSave.push(normalized);
                    }
                });
            }

            const currentLayoutRef =
                layoutRefsToSave.find((item) => item.tableKey === tableKey && item.layoutId)?.layoutId ??
                layoutRefsToSave.find((item) => item.layoutId)?.layoutId ??
                (typeof existingVariant?.layoutId === 'string' ? existingVariant.layoutId : undefined);

            const variantToSave: VariantMetadata = {
                ...metadata,
                id: id,
                createdAt: new Date().toISOString(),
                filters: filtersToSave.length > 0 ? filtersToSave : undefined,
                layout: layoutToSave.length > 0 ? layoutToSave : undefined,
                layoutRefs: layoutRefsToSave.length > 0 ? layoutRefsToSave : undefined,
                layoutId: currentLayoutRef || undefined,
            };
            
            await service.saveVariant(variantToSave, appId, tableKey);
            
            if (onSuccess) onSuccess(getText('msg.variantSaved', 'Variant saved successfully'));
            
            // Refresh list and select the new variant
            const updatedVariants = await fetchVariants();
            const newVariant = updatedVariants.find((v: VariantMetadata) => v.name === metadata.name); // Assume name is unique or pick latest
            
            if (newVariant) {
                handleVariantChange(newVariant.id);
                onLoad(newVariant); // Propagate to parent (Important for CTable to know current variant)
            }
        } catch (e) {
            console.error("Error saving variant", e);
            if (onError) onError(getText('msg.variantSaveError', 'Failed to save variant'));
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await service.deleteVariant(id);
            if (currentVariantId === id) {
                handleVariantChange('');
            }
            if (onSuccess) onSuccess(getText('msg.variantDeleted', 'Variant deleted'));
            await fetchVariants();
        } catch (e) {
            console.error("Error deleting variant", e);
            if (onError) onError(getText('msg.variantDeleteError', 'Failed to delete variant'));
        }
    };

    const handleSetDefault = async (id: string) => {
        try {
             await service.setDefaultVariant(id, appId, tableKey);
             if (onSuccess) onSuccess(getText('msg.variantDefaultSet', 'Default variant set'));
             await fetchVariants();
        } catch (e) {
            console.error("Error setting default", e);
            if (onError) onError(getText('msg.variantDefaultError', 'Failed to set default variant'));
        }
    }

    const handleLoad = (variant: VariantMetadata) => {
        handleVariantChange(variant.id);
        onLoad(variant);
    }

    return (
        <CVariantManagement
            variants={variants}
            currentVariantId={currentVariantId}
            onLoad={handleLoad}
            onSave={handleSave}
            onDelete={handleDelete}
            onSetDefault={handleSetDefault}
        />
    );
};
