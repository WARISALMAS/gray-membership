import { NextResponse } from 'next/server'

const ZOHO_TOKEN_URL = 'https://accounts.zoho.com/oauth/v2/token'
const ZOHO_SUBSCRIPTION_INVOICES_URL = 'https://www.zohoapis.com/crm/v8/Subscription_Invoices'

let cachedAccessToken: string | null = null
let cachedExpiry = 0

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

const SUBSCRIPTION_FIELD = process.env.ZOHO_SUBSCRIPTION_INVOICES_SUBSCRIPTION_FIELD || 'Subscription_Name'
const CONTACT_FIELD = process.env.ZOHO_SUBSCRIPTION_INVOICES_CONTACT_FIELD || 'Contact_Name'
const PAYMENT_REF_FIELD =
  process.env.ZOHO_SUBSCRIPTION_INVOICES_PAYMENT_REFERENCE_FIELD || 'Payment_Reference'
const AMOUNT_FIELD = process.env.ZOHO_SUBSCRIPTION_INVOICES_AMOUNT_FIELD || 'Amount'
const CURRENCY_FIELD = process.env.ZOHO_SUBSCRIPTION_INVOICES_CURRENCY_FIELD || 'Currency'
const STATUS_FIELD = process.env.ZOHO_SUBSCRIPTION_INVOICES_STATUS_FIELD || 'Status'

interface CreateZohoSubscriptionInvoiceBody {
  subscriptionId?: string
  contactId?: string
  paymentReference?: string
  amount?: number
  currency?: string
  status?: string
  extraFields?: Record<string, any>
}

export async function POST(request: Request) {
  try {
    const body: CreateZohoSubscriptionInvoiceBody = await request
      .json()
      .catch(() => ({} as CreateZohoSubscriptionInvoiceBody))
    const { subscriptionId, contactId, paymentReference, amount, currency, status, extraFields } = body

    if (!subscriptionId || !paymentReference) {
      return NextResponse.json(
        { error: 'subscriptionId and paymentReference are required' },
        { status: 400 },
      )
    }

    const record: Record<string, any> = {
      ...(extraFields ?? {}),
      [SUBSCRIPTION_FIELD]: { id: String(subscriptionId) },
      [PAYMENT_REF_FIELD]: String(paymentReference),
    }

    if (contactId) {
      record[CONTACT_FIELD] = { id: String(contactId) }
    }
    if (typeof amount === 'number') {
      record[AMOUNT_FIELD] = amount
    }
    if (currency) {
      record[CURRENCY_FIELD] = String(currency)
    }
    if (status) {
      record[STATUS_FIELD] = status
    }

    const accessToken = await getZohoAccessToken()

    const res = await fetch(ZOHO_SUBSCRIPTION_INVOICES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ data: [record] }),
    })

    const json: any = await res.json().catch(() => ({}))

    if (!res.ok) {
      return NextResponse.json(
        {
          error: 'Failed to create subscription invoice in Zoho',
          status: res.status,
          details: json,
        },
        { status: 502 },
      )
    }

    const first = Array.isArray(json?.data) ? json.data[0] : undefined
    if (first && first.status === 'error') {
      return NextResponse.json(
        { error: 'Zoho returned an error for subscription invoice create', details: first },
        { status: 502 },
      )
    }

    return NextResponse.json({ data: first ?? null })
  } catch (err) {
    console.error('Zoho subscription invoices error', err)
    return NextResponse.json(
      { error: 'Zoho subscription invoices integration error', message: (err as Error).message },
      { status: 500 },
    )
  }
}

