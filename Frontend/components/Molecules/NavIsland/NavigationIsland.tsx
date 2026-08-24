'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { TreeMenu, TreeMenuItem } from './tree-menu'

const SearchIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
)

const LoaderIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
)

export interface NavigationIslandProps {
  collapsed: boolean
  onToggle: () => void
  className?: string
  maxHeight?: number
  widthExpanded?: number
  widthCollapsed?: number
  data: TreeMenuItem[]
  isLoading?: boolean
  error?: string | null
  activePath?: string
  onNavigate: (item: TreeMenuItem) => void
  onReload?: () => void
  searchPlaceholder?: string
  loadingText?: string
  emptySearchText?: string
  emptyDataText?: string
  reloadText?: string
  mode?: 'light' | 'dark'
}

export const NavigationIsland: React.FC<NavigationIslandProps> = ({
  collapsed,
  onToggle,
  className = '',
  maxHeight,
  widthExpanded = 234,
  widthCollapsed = 56,
  data,
  isLoading = false,
  error = null,
  activePath,
  onNavigate,
  onReload,
  searchPlaceholder = '搜索菜单...',
  loadingText = '加载菜单中...',
  emptySearchText = '未找到匹配的菜单项',
  emptyDataText = '暂无可访问的应用',
  reloadText = '重新加载',
  mode = 'dark',
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const isDark = mode === 'dark'

  useEffect(() => {
    if (collapsed) {
      setExpandedNodes(new Set())
    }
  }, [collapsed])

  const getAllNodeIds = useCallback((nodes: TreeMenuItem[]): string[] => {
    const ids: string[] = []
    const traverse = (nodeList: TreeMenuItem[]) => {
      nodeList.forEach((node) => {
        ids.push(node.id)
        if (node.children) {
          traverse(node.children)
        }
      })
    }
    traverse(nodes)
    return ids
  }, [])

  const filteredMenuData = useMemo(() => {
    if (!searchTerm.trim()) {
      return data
    }

    const filterNodes = (nodes: TreeMenuItem[]): TreeMenuItem[] => {
      return nodes.reduce((acc: TreeMenuItem[], node) => {
        const matchesSearch =
          node.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          node.description?.toLowerCase().includes(searchTerm.toLowerCase())

        const filteredChildren = node.children ? filterNodes(node.children) : []

        if (matchesSearch || filteredChildren.length > 0) {
          acc.push({
            ...node,
            children: filteredChildren.length > 0 ? filteredChildren : node.children,
          })
        }

        return acc
      }, [])
    }

    return filterNodes(data)
  }, [searchTerm, data])

  const searchExpandedNodes = useMemo(() => {
    if (searchTerm.trim()) {
      return new Set(getAllNodeIds(data))
    }
    return expandedNodes
  }, [searchTerm, data, expandedNodes, getAllNodeIds])

  return (
    <div
      className={`flex flex-col bg-white/10 dark:bg-[#101928] backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-[0_4px_8px_0_rgba(31,38,135,0.1)] ${
        collapsed ? 'rounded-full' : 'rounded-2xl'
      } relative ${className}`}
      style={{
        backdropFilter: 'blur(16px) saturate(180%)',
        WebkitBackdropFilter: 'blur(16px) saturate(180%)',
        transition:
          'width 400ms cubic-bezier(0.4, 0.0, 0.2, 1), border-radius 0ms cubic-bezier(0.4, 0.0, 0.2, 1), box-shadow 400ms ease-out',
        maxHeight: maxHeight ? `${maxHeight}px` : undefined,
        width: `${collapsed ? widthCollapsed : widthExpanded}px`,
        borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(13,47,115,0.18)',
        background: isDark ? 'rgba(16,25,40,0.65)' : 'rgba(255,255,255,0.7)',
      }}
    >
      <div className={`pt-4 pb-2 transition-all duration-500 ease-in-out ${collapsed ? 'px-1' : 'px-2'}`}>
        {collapsed ? (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onToggle}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200"
              title="展开导航"
            >
              <SearchIcon className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <div className={`relative transition-opacity duration-300 ${collapsed ? 'opacity-0' : 'opacity-100 delay-200'}`}>
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
              <SearchIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
            </div>
          </div>
        )}
      </div>

      <nav className={`flex-1 pb-4 transition-all duration-500 ease-in-out overflow-y-auto min-h-0 ${collapsed ? 'px-1' : 'px-2'}`}>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <LoaderIcon className="h-6 w-6 animate-spin text-gray-400" />
            {!collapsed && <span className="ml-2 text-sm text-gray-500">{loadingText}</span>}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="text-red-500 text-sm mb-2">{collapsed ? '⚠️' : error}</div>
            {!collapsed && onReload && (
              <button type="button" onClick={onReload} className="text-xs text-blue-500 hover:text-blue-700">
                {reloadText}
              </button>
            )}
          </div>
        ) : filteredMenuData.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-gray-500 text-sm">
            {collapsed ? '📂' : searchTerm ? emptySearchText : emptyDataText}
          </div>
        ) : (
          <>
            {!collapsed && (
              <div className={`transition-opacity duration-300 ${collapsed ? 'opacity-0' : 'opacity-100 delay-200'}`}>
                <TreeMenu
                  items={filteredMenuData}
                  onItemClick={onNavigate}
                  activePath={activePath}
                  className="space-y-1"
                  expandedIds={searchExpandedNodes}
                  onToggleExpand={(id) => {
                    const newExpanded = new Set(expandedNodes)
                    const isTopLevel = filteredMenuData.some((item) => item.id === id)

                    if (isTopLevel) {
                      if (newExpanded.has(id)) {
                        newExpanded.delete(id)
                      } else {
                        filteredMenuData.forEach((item) => {
                          if (item.id !== id && newExpanded.has(item.id)) {
                            newExpanded.delete(item.id)
                          }
                        })
                        newExpanded.add(id)
                      }
                    } else if (newExpanded.has(id)) {
                      newExpanded.delete(id)
                    } else {
                      newExpanded.add(id)
                    }

                    setExpandedNodes(newExpanded)
                  }}
                />
              </div>
            )}

            {collapsed && (
              <div className="space-y-2">
                {data.map((category) => (
                  <div key={category.id} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (!category.children?.length && (category.appurl || category.href)) {
                          onNavigate(category)
                          return
                        }

                        onToggle()
                        setExpandedNodes(new Set<string>([category.id]))
                      }}
                      className="w-full flex items-center justify-center p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors duration-200"
                      title={`展开查看 ${category.title}`}
                    >
                      {category.icon || (
                        <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/20 rounded text-xs flex items-center justify-center font-medium text-blue-600 dark:text-blue-400">
                          {category.title?.charAt(0) || '?'}
                        </div>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </nav>

      {!collapsed && (
        <button
          type="button"
          onClick={onToggle}
          className="absolute -bottom-1 -right-1 w-6 h-6 bg-transparent hover:bg-white/20 dark:hover:bg-gray-800/50 rounded-full flex items-center justify-center transition-all duration-300 ease-in-out z-20"
          title="折叠导航"
        >
          <div
            className="absolute"
            style={{
              bottom: '0px',
              right: '0px',
              width: '16px',
              height: '16px',
              overflow: 'hidden',
            }}
          >
            <div
              className="dark:border-yellow-400"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '16px',
                border: '3px solid #21BCFF',
                backgroundColor: 'transparent',
                position: 'absolute',
                top: '-16px',
                left: '-16px',
              }}
            />
          </div>
        </button>
      )}
    </div>
  )
}

export default NavigationIsland
