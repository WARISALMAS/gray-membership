import { NextResponse } from 'next/server'

const ZOHO_TOKEN_URL = 'https://accounts.zoho.com/oauth/v2/token'
const ZOHO_COQL_URL = 'https://www.zohoapis.com/crm/v8/coql'

let cachedAccessToken: string | null = null
let cachedExpiry: number = 0

async function getZohoAccessToken(): Promise<string> {
  const now = Date.now()
  if (cachedAccessToken && cachedExpiry > now + 5_000) {
    return cachedAccessToken
  }

  const clientId = process.env.ZOHO_CLIENT_ID
  const clientSecret = process.env.ZOHO_CLIENT_SECRET
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Zoho OAuth env vars are not configured')
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })

  const res = await fetch(`${ZOHO_TOKEN_URL}?${params.toString()}`, {
    method: 'POST',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Zoho token request failed (${res.status}): ${text}`)
  }

  const json: any = await res.json()
  const accessToken: string | undefined = json.access_token
  const expiresIn: number = typeof json.expires_in === 'number' ? json.expires_in : 3600

  if (!accessToken) {
    throw new Error('Zoho token response did not include access_token')
  }

  cachedAccessToken = accessToken
  cachedExpiry = now + expiresIn * 1000

  return accessToken
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const {
      code,
      planId,
      planPrice,
    }: { code?: string; planId?: string; planPrice?: number } = body || {}

    if (!code || !code.trim()) {
      return NextResponse.json(
        { valid: false, message: 'Coupon code is required' },
        { status: 400 },
      )
    }

    if (!planId || !String(planId).trim()) {
      return NextResponse.json(
        { valid: false, message: 'Plan id is required to validate coupon' },
        { status: 400 },
      )
    }

    const numericPlanPrice = typeof planPrice === 'number' ? planPrice : Number(planPrice)
    if (!Number.isFinite(numericPlanPrice) || numericPlanPrice <= 0) {
      return NextResponse.json(
        { valid: false, message: 'A positive planPrice is required to validate coupon' },
        { status: 400 },
      )
    }

    const accessToken = await getZohoAccessToken()

    const trimmedCode = code.trim().toUpperCase()
    const trimmedPlanId = String(planId).trim()

    const selectQuery = `select Associate_Plans, Coupons.Coupon_Code, Coupons.Discount, Coupons.id, Coupons.Status, Coupons.Name from CouponsXSubscriptions where Associate_Plans.id = '${trimmedPlanId}' and Coupons.Status = 'Active'`

    const res = await fetch(ZOHO_COQL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ select_query: selectQuery }),
    })

    const json: any = await res.json().catch(() => ({}))

    if (!res.ok) {
      return NextResponse.json(
        {
          valid: false,
          error: 'Failed to validate coupon',
          message: 'Unable to validate coupon at the moment. Please try again later.',
          details: json,
        },
        { status: 502 },
      )
    }

    const list: any[] = Array.isArray(json?.data) ? json.data : []

    if (!list.length) {
      return NextResponse.json({
        valid: false,
        message: 'Coupon code is expired or invalid for this plan.',
      })
    }

    const match = list.find((row) => {
      const codeValue = row['Coupons.Coupon_Code']
      if (!codeValue) return false
      return String(codeValue).trim().toUpperCase() === trimmedCode
    })

    if (!match) {
      return NextResponse.json({
        valid: false,
        message: 'Coupon code is expired or invalid for this plan.',
      })
    }

    const discountRaw = match['Coupons.Discount']
    const discount =
      typeof discountRaw === 'number'
        ? discountRaw
        : typeof discountRaw === 'string'
        ? parseFloat(discountRaw)
        : 0

    if (!discount || discount <= 0) {
      return NextResponse.json({
        valid: false,
        message: 'Coupon code is expired or invalid for this plan.',
      })
    }

    const couponId = match['Coupons.id'] ? String(match['Coupons.id']) : ''
    const name = match['Coupons.Name'] ? String(match['Coupons.Name']) : trimmedCode

    const discountAmount = (numericPlanPrice * discount) / 100
    const finalPrice = Math.max(0, numericPlanPrice - discountAmount)

    return NextResponse.json({
      success: true,
      valid: true,
      name,
      couponId,
      discountType: 'percentage' as const,
      value: discount,
      // New fields for convenience
      discount,
      discountAmount,
      finalPrice,
      planPrice: numericPlanPrice,
    })
  } catch (err) {
    console.error('Zoho coupons validate error', err)
    return NextResponse.json(
      { valid: false, error: 'Zoho coupons integration error', message: (err as Error).message },
      { status: 500 },
    )
  }
}

