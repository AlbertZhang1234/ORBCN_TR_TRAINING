'use client'

import React, { useState } from 'react'

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export interface TreeMenuItem {
  id: string
  title?: string
  label?: string
  description?: string
  icon?: React.ReactNode
  href?: string
  appurl?: string
  children?: TreeMenuItem[]
  isExpanded?: boolean
  data?: unknown
}

export interface TreeMenuProps {
  items: TreeMenuItem[]
  onItemClick?: (item: TreeMenuItem) => void
  className?: string
  level?: number
  expandedIds?: Set<string>
  onToggleExpand?: (id: string) => void
  activePath?: string
}

const ChevronRightIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="m9 18 6-6-6-6" />
  </svg>
)

export function TreeMenu({
  items,
  onItemClick,
  className = '',
  level = 0,
  expandedIds,
  onToggleExpand,
  activePath,
}: TreeMenuProps) {
  const [internalExpandedItems, setInternalExpandedItems] = useState<Set<string>>(new Set())

  const isControlled = expandedIds !== undefined && onToggleExpand !== undefined
  const currentExpandedItems = isControlled ? expandedIds : internalExpandedItems

  const toggleExpanded = (itemId: string) => {
    if (isControlled) {
      onToggleExpand?.(itemId)
      return
    }

    const next = new Set(internalExpandedItems)
    if (next.has(itemId)) {
      next.delete(itemId)
    } else {
      next.add(itemId)
    }
    setInternalExpandedItems(next)
  }

  const handleItemClick = (item: TreeMenuItem, e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()

    if (item.children?.length) {
      toggleExpanded(item.id)
    }

    onItemClick?.(item)
  }

  if (!items || !Array.isArray(items)) {
    return <div className={cn('tree-menu text-sm text-gray-500 p-2', className)}>暂无菜单数据</div>
  }

  return (
    <div className={cn('tree-menu', className)}>
      {items.map((item) => {
        const isExpanded = currentExpandedItems.has(item.id) || item.isExpanded
        const hasChildren = Boolean(item.children?.length)
        const targetUrl = item.appurl || item.href
        const isActive = targetUrl ? activePath === targetUrl : false

        return (
          <div key={item.id} className="tree-menu-item relative">
            {isActive && (
              <div className="absolute left-0 top-2 bottom-2 w-1 bg-[#21BCFF] rounded-r-full z-10" />
            )}

            <button
              type="button"
              className={cn(
                'w-full flex items-center justify-start gap-2 h-auto py-2 relative overflow-hidden group rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#21BCFF] hover:bg-white/5 dark:hover:bg-white/5',
                isActive ? 'text-[#21BCFF] font-semibold' : 'text-gray-400 hover:text-gray-200',
              )}
              style={{ paddingLeft: `calc(0.75rem + ${level * 1.25}rem)` }}
              onClick={(e) => handleItemClick(item, e)}
            >
              {hasChildren && (
                <div
                  className={cn(
                    'flex-shrink-0 transition-transform duration-200',
                    isExpanded ? 'rotate-90' : '',
                    isActive ? 'text-[#21BCFF]' : 'text-gray-500 group-hover:text-gray-300',
                  )}
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </div>
              )}

              {!hasChildren && <div className="w-4 h-4 flex-shrink-0" />}

              {item.icon && (
                <div
                  className={cn(
                    'flex-shrink-0 transition-colors duration-200',
                    isActive ? 'text-[#21BCFF]' : 'text-gray-500 group-hover:text-gray-300',
                  )}
                >
                  {item.icon}
                </div>
              )}

              <div className="flex-1 text-left overflow-hidden z-10">
                <div className="text-sm truncate">{item.title || item.label}</div>
                {item.description && (
                  <div className="text-xs truncate text-gray-500 mt-0.5">{item.description}</div>
                )}
              </div>
            </button>

            {hasChildren && (
              <div
                className={cn(
                  'grid transition-[grid-template-rows] duration-300 ease-in-out',
                  isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                )}
              >
                <div className="overflow-hidden">
                  <TreeMenu
                    items={item.children!}
                    onItemClick={onItemClick}
                    level={level + 1}
                    expandedIds={expandedIds}
                    onToggleExpand={onToggleExpand}
                    activePath={activePath}
                  />
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default TreeMenu
