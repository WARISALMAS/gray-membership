import { NextResponse } from 'next/server'

const ZOHO_TOKEN_URL = 'https://accounts.zoho.com/oauth/v2/token'
const ZOHO_CONTACTS_URL = 'https://www.zohoapis.com/crm/v8/Contacts'

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
      firstName,
      lastName,
      email,
      phone,
      zip,
      locationId,
      leadSource,
    }: {
      firstName?: string
      lastName?: string
      email?: string
      phone?: string
      zip?: string
      locationId?: string
      leadSource?: string
    } = body || {}

    const effectiveLastName =
      (lastName && String(lastName).trim()) ||
      (firstName && String(firstName).trim()) ||
      'Member'

    const contact: Record<string, any> = {
      Last_Name: effectiveLastName,
      Lead_Source: (leadSource && String(leadSource).trim()) || 'Website',
    }
    if (firstName) contact.First_Name = String(firstName)
    if (email) contact.Email = String(email)
    if (phone) contact.Mobile = String(phone)

    if (zip) contact.Mailing_Zip = String(zip)

    if (locationId) {
      contact.Location = String(locationId)
    }

    const accessToken = await getZohoAccessToken()

    const res = await fetch(ZOHO_CONTACTS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ data: [contact] }),
    })

    const json: any = await res.json().catch(() => ({}))

    const first = Array.isArray(json?.data) ? json.data[0] : undefined

    // Zoho returns 400 + data[0].code = DUPLICATE_DATA when a contact with the same
    // unique field already exists. In that case, duplicate_record.id contains the
    // existing contact id – treat this as a successful "lookup" so callers can
    // continue using the existing contact.
    if (first && first.code === 'DUPLICATE_DATA') {
      const existingId: string | undefined = first.details?.duplicate_record?.id
      if (existingId) {
        const normalized = {
          status: 'success',
          details: {
            id: existingId,
          },
        }
        return NextResponse.json({ data: normalized })
      }
    }

    if (!res.ok) {
      return NextResponse.json(
        {
          error: 'Failed to create contact in Zoho',
          status: res.status,
          details: json,
        },
        { status: 502 },
      )
    }

    if (first && first.status === 'error') {
      return NextResponse.json(
        { error: 'Zoho returned an error for contact create', details: first },
        { status: 502 },
      )
    }

    return NextResponse.json({ data: first ?? null })
  } catch (err) {
    console.error('Zoho contacts error', err)
    return NextResponse.json(
      { error: 'Zoho contacts integration error', message: (err as Error).message },
      { status: 500 },
    )
  }
}

