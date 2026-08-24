/**
 * @file 10_Frontend/components/sap/ui/Common/Structures/CTable/utils.ts
 * 
 * @summary Core frontend utils module for the ORBAI Core project
 * @author ORBAICODER
 * @version 1.0.0
 * @date 2025-01-19
 * 
 * @description
 * This file is responsible for:
 *  - Implementing utils functionality within frontend workflows
 *  - Integrating with shared ORBAI Core application processes under frontend
 * 
 * @logic
 * 1. Import required dependencies and configuration
 * 2. Execute the primary logic for utils
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
 * SECTION 1: utils Core Logic
 * Section overview and description.
 * --------------------------
 */

import type { HeadCell, GroupNode } from './types';

export const formatNumber = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
};

export const getLeafRows = (node: GroupNode): any[] => {
    let leaves: any[] = [];
    if (!node.children || !Array.isArray(node.children)) return [];
    
    node.children.forEach((child: any) => {
        if (child.isGroup) {
            leaves = leaves.concat(getLeafRows(child));
        } else {
            leaves.push(child);
        }
    });
    return leaves;
};

export const getAllGroupIds = (nodes: any[]): string[] => {
    let ids: string[] = [];
    if (!nodes || !Array.isArray(nodes)) return [];
    
    nodes.forEach(node => {
        if (node.isGroup) {
            ids.push(node.id);
            if (node.children) {
                ids = ids.concat(getAllGroupIds(node.children));
            }
        }
    });
    return ids;
};

export const groupRows = (rows: any[], grouping: string[], columns: HeadCell[], level: number = 0, parentId: string = 'root'): GroupNode[] | any[] => {
    if (level >= grouping.length) {
        return rows;
    }

    const field = grouping[level];
    const column = columns.find(c => c.id === field);
    const groups: Record<string, any[]> = {};

    rows.forEach(row => {
        let key: string | number = row[field];
        if (column?.getGroupValue) {
            key = column.getGroupValue(row);
        }
        const groupKey = String(key);
        if (!groups[groupKey]) {
            groups[groupKey] = [];
        }
        groups[groupKey].push(row);
    });

    return Object.entries(groups).map(([key, groupRowsData]) => {
        const uniqueId = `${parentId}__${level}__${key}`;
        
        // Calculate aggregates for this group
        const aggregates: Record<string, number> = {};
        columns.forEach(col => {
            if (col.numeric) {
                aggregates[col.id] = groupRowsData.reduce((sum, row) => sum + (Number(row[col.id]) || 0), 0);
            }
        });

        return {
            key,
            field,
            value: key,
            children: groupRows(groupRowsData, grouping, columns, level + 1, uniqueId),
            count: groupRowsData.length,
            id: uniqueId,
            level,
            isGroup: true,
            aggregates
        };
    });
};
