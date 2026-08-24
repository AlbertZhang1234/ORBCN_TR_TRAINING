/**
 * @file 10_Frontend/services/m_customer/qxb-service.ts
 * 
 * @summary QXB integration service for company and shareholder lookups.
 * @author ORBAICODER
 * @version 1.0.0
 * @date 2025-01-19
 * 
 * @description
 * This file is responsible for:
 *  - Queries QXB endpoints for company basics, shareholders, and investments
 *  - Provides helper to search companies by name with pagination
 * 
 * @logic
 * 1. Build URLs for QXB search and detail endpoints with query params
 * 2. Invoke fetch and parse JSON responses from QXB proxy APIs
 * 3. Return typed objects for downstream customer workflows
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
 * SECTION 1: QXB data bridge
 * Company lookup and shareholder detail helpers.
 * --------------------------
 */
'use server'

export interface QXBCompany {
  id: string
  name: string
  credit_no: string
  oper_name: string
  start_date: string
  status: string
  [key: string]: any
}

export interface QXBResponse {
  status: string
  message: string
  data?: {
    total: number
    num: number
    items: QXBCompany[]
  }
}

/**
 * Fuzzy search companies using Qixinbao API (via n8n proxy)
 * @param keyword Company name keyword
 */
export async function searchCompanies(keyword: string): Promise<QXBCompany[]> {
  const QXB_URL = process.env.qxb_url?.trim() || process.env.QXB_URL?.trim() || ''
  const QXB_USER = process.env.qxb_user?.trim() || process.env.QXB_USER?.trim() || ''
  const QXB_PASSWORD = process.env.qxb_password?.trim() || process.env.QXB_PASSWORD?.trim() || ''

  if (!QXB_URL || !QXB_USER || !QXB_PASSWORD) {
    const missing = []
    if (!QXB_URL) missing.push('qxb_url')
    if (!QXB_USER) missing.push('qxb_user')
    if (!QXB_PASSWORD) missing.push('qxb_password')
    
    console.error(`Qixinbao API credentials missing: ${missing.join(', ')}`)
    throw new Error(`API configuration error: Missing ${missing.join(', ')}`)
  }

  // Ensure keyword is at least 2 chars
  if (!keyword || keyword.length < 2) {
    return []
  }

  // Handle URL: remove example query params if present in env var
  const baseUrl = QXB_URL.split('?')[0]
  const url = `${baseUrl}?keyword=${encodeURIComponent(keyword)}`

  // Create Basic Auth header
  const authHeader = 'Basic ' + Buffer.from(`${QXB_USER}:${QXB_PASSWORD}`).toString('base64')

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      cache: 'no-store'
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('QXB API Error:', response.status, errorText)
      throw new Error(`API Error: ${response.status}`)
    }

    const result: QXBResponse = await response.json()

    // Status '200' means success in this API
    if (result.status !== '200') {
      console.error('QXB API Business Error:', result.status, result.message)
      // 201 means no result
      if (result.status === '201') return []
      throw new Error(result.message || 'Search failed')
    }

    return result.data?.items || []
  } catch (error) {
    console.error('QXB Search Exception:', error)
    return []
  }
}
