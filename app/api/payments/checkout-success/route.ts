import { NextResponse } from 'next/server'
import Stripe from 'stripe'

type LocationKey = 'Gray Dubai' | 'Ibiza' | 'Dubai'

const STRIPE_CONFIG: Record<LocationKey, { secretKey?: string }> = {
  Dubai: {
    secretKey: process.env.STRIPE_SECRET_KEY_DUBAI,
  },
  Ibiza: {
    secretKey: process.env.STRIPE_SECRET_KEY_IBIZA,
  },
  'Gray Dubai': {
    secretKey: process.env.STRIPE_SECRET_KEY_GRAY,
  },
}

async function retrieveSessionFromAnyStripe(sessionId: string) {
  const entries = Object.entries(STRIPE_CONFIG) as [LocationKey, { secretKey?: string }][]

  for (const [location, cfg] of entries) {
    if (!cfg.secretKey) continue
    try {
      const stripe = new Stripe(cfg.secretKey, { apiVersion: '2024-06-20' })
      const session = await stripe.checkout.sessions.retrieve(sessionId)
      return { session, location }
    } catch {
      // Try next key
    }
  }
  throw new Error('Unable to find session in any Stripe account')
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const sessionId: string | undefined = body.sessionId

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    const { session } = await retrieveSessionFromAnyStripe(sessionId)

    if (session.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Payment is not completed', payment_status: session.payment_status },
        { status: 400 },
      )
    }

    const metadata = session.metadata || {}

    const firstName = metadata.firstName || ''
    const lastName = metadata.lastName || ''
    const email = metadata.email || session.customer_email || ''
    const phone = metadata.phone || ''
    const zip = metadata.zip || ''
    const locationId = metadata.location || ''
    const planId = metadata.planId || ''
    const planDuration = (metadata.planDuration || 'Annual') as 'Annual' | 'Pass'
    const couponId = metadata.couponId || ''
    const couponDiscount = metadata.couponDiscount || ''
    const amount = Number(metadata.amount || session.amount_total || 0) / 100
    const currency = (metadata.currency || session.currency || 'AED').toUpperCase()
    const paymentReference =
      (typeof session.payment_intent === 'string' ? session.payment_intent : undefined) ||
      session.id

    if (!planId || !locationId) {
      return NextResponse.json(
        { error: 'Missing planId or location in session metadata' },
        { status: 400 },
      )
    }

    // 1) Ensure contact exists in Zoho CRM
    const contactRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/zoho/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName,
        lastName,
        email,
        phone,
        zip,
        locationId,
        leadSource: 'Website Membership',
      }),
    })

    const contactJson: any = await contactRes.json().catch(() => ({}))
    const contactData: any = contactJson?.data
    const memberId: string | undefined = contactData?.details?.id

    if (!memberId) {
      return NextResponse.json(
        { error: 'Zoho contact creation failed', details: contactJson },
        { status: 502 },
      )
    }

    // Compute subscription dates
    const startDate = new Date().toISOString().slice(0, 10)
    const end = new Date(startDate)
    if (planDuration.toLowerCase() === 'pass') {
      end.setMonth(end.getMonth() + 1)
    } else {
      end.setFullYear(end.getFullYear() + 1)
    }
    const endDate = end.toISOString().slice(0, 10)

    // 2) Create subscription in Zoho
    const subscriptionRes = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/zoho/subscriptions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          planId,
          startDate,
          endDate,
          subscriptionStatus: 'live',
          paymentMode: 'Stripe',
          paymentReference,
          couponId: couponId || undefined,
          couponDiscount: couponDiscount || undefined,
        }),
      },
    )

    const subscriptionJson: any = await subscriptionRes.json().catch(() => ({}))
    const subscriptionData: any = subscriptionJson?.data
    const subscriptionId: string | undefined = subscriptionData?.details?.id

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'Zoho subscription creation failed', details: subscriptionJson },
        { status: 502 },
      )
    }

    // 3) Create subscription invoice in Zoho
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/zoho/subscription-invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscriptionId,
        contactId: memberId,
        paymentReference,
        amount,
        currency,
        status: 'Paid',
      }),
    }).catch(() => {
      // Non-blocking; failures are logged server-side
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Checkout success handler error', err)
    return NextResponse.json(
      { error: 'Failed to process checkout success', message: (err as Error).message },
      { status: 500 },
    )
  }
}

