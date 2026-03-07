import { NextResponse } from 'next/server'

const ZOHO_TOKEN_URL = 'https://accounts.zoho.com/oauth/v2/token'
const ZOHO_LOCATIONS_URL = 'https://www.zohoapis.com/crm/v8/Locations'

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

export async function GET() {
  try {
    const accessToken = await getZohoAccessToken()

    const locationsUrl = `${ZOHO_LOCATIONS_URL}?fields=Name,City,Country,Brand,Active`

    const res = await fetch(locationsUrl, {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return NextResponse.json(
        { error: 'Failed to fetch locations from Zoho', details: text },
        { status: 502 },
      )
    }

    const json = await res.json()
    // Ensure consistent shape for the frontend: { data: [...] }
    const data = Array.isArray(json?.data) ? json.data : []

    return NextResponse.json({ data })
  } catch (err) {
    console.error('Zoho locations error', err)
    return NextResponse.json(
      { error: 'Zoho integration error', message: (err as Error).message },
      { status: 500 },
    )
  }
}

