import { NextResponse } from 'next/server'
import Stripe from 'stripe'

type LocationKey = 'Gray Dubai' | 'Ibiza' | 'Dubai'

const STRIPE_SECRET_KEY_DUBAI = process.env.STRIPE_SECRET_KEY_DUBAI
const STRIPE_SECRET_KEY_IBIZA = process.env.STRIPE_SECRET_KEY_IBIZA
const STRIPE_SECRET_KEY_GRAY = process.env.STRIPE_SECRET_KEY_GRAY

function getStripeSecretKeyForLocation(location: LocationKey): string | null {
  switch (location) {
    case 'Dubai':
      return STRIPE_SECRET_KEY_DUBAI ?? null
    case 'Ibiza':
      return STRIPE_SECRET_KEY_IBIZA ?? null
    case 'Gray Dubai':
      return STRIPE_SECRET_KEY_GRAY ?? null
    default:
      return null
  }
}

interface DirectCardBody {
  location: LocationKey
  amount: number
  currency: string
  description?: string
  paymentMethodId: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  zip?: string
  zohoLocationId?: string
  planId?: string
  planDuration?: string
  couponId?: string
  couponDiscount?: string | number
  existingMemberId?: string
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<DirectCardBody>

    const {
      location,
      amount,
      currency,
      description = 'Subscription payment',
      paymentMethodId,
      firstName = '',
      lastName = '',
      email = '',
      phone = '',
      zip = '',
      zohoLocationId,
      planId,
      planDuration = 'Annual',
      couponId,
      couponDiscount,
      existingMemberId,
    } = body

    if (!location || !amount || !currency || !paymentMethodId) {
      return NextResponse.json(
        { error: 'location, amount, currency and paymentMethodId are required' },
        { status: 400 },
      )
    }

    const secretKey = getStripeSecretKeyForLocation(location)

    if (!secretKey) {
      return NextResponse.json(
        {
          error: `Stripe secret key is not configured for location "${location}".`,
        },
        { status: 500 },
      )
    }

    const stripe = new Stripe(secretKey, {
      apiVersion: '2026-02-25.clover',
    })

    const amountInCents = Math.round(amount * 100)

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: currency.toLowerCase(),
      payment_method: paymentMethodId,
      payment_method_types: ['card'],
      confirm: true,
      description,
      metadata: {
        flow: 'membership_public_direct_test_pm',
        location,
        planId: planId ?? '',
        planDuration: planDuration ?? '',
        firstName,
        lastName,
        email,
        phone,
        zip,
        zohoLocationId: zohoLocationId ?? '',
        couponId: couponId ?? '',
        couponDiscount:
          couponDiscount !== undefined && couponDiscount !== null
            ? String(couponDiscount)
            : '',
      },
    })

    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json(
        {
          error: 'Payment did not succeed',
          status: paymentIntent.status,
        },
        { status: 400 },
      )
    }

    const origin =
      request.headers.get('origin') ?? process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

    const paymentReference = paymentIntent.id

    if (!planId || !zohoLocationId) {
      return NextResponse.json({
        success: true,
        paymentIntentId: paymentReference,
        zohoSync: 'skipped_missing_plan_or_location',
      })
    }

    // 1) Ensure contact exists in Zoho CRM, or reuse the one created on step 1
    let memberId: string | undefined = existingMemberId || undefined

    if (!memberId) {
      const contactRes = await fetch(`${origin}/api/zoho/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone,
          zip,
          locationId: zohoLocationId,
          leadSource: 'Website Membership',
        }),
      })

      const contactJson: any = await contactRes.json().catch(() => ({}))
      const contactData: any = contactJson?.data
      memberId = contactData?.details?.id

      if (!memberId) {
        return NextResponse.json(
          {
            success: true,
            paymentIntentId: paymentReference,
            zohoSync: 'contact_failed',
            contactDetails: contactJson,
          },
          { status: 502 },
        )
      }
    }

    // Compute subscription dates based on duration
    const startDate = new Date().toISOString().slice(0, 10)
    const end = new Date(startDate)
    const d = (planDuration || 'Annual').toLowerCase()
    if (d === 'pass' || d === 'monthly') {
      end.setMonth(end.getMonth() + 1)
    } else if (d === 'weekly') {
      end.setDate(end.getDate() + 7)
    } else {
      end.setFullYear(end.getFullYear() + 1)
    }
    const endDate = end.toISOString().slice(0, 10)

    // 2) Create subscription in Zoho
    const subscriptionRes = await fetch(`${origin}/api/zoho/subscriptions`, {
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
    })

    const subscriptionJson: any = await subscriptionRes.json().catch(() => ({}))
    const subscriptionData: any = subscriptionJson?.data
    const subscriptionId: string | undefined = subscriptionData?.details?.id

    if (!subscriptionId) {
      return NextResponse.json(
        {
          success: true,
          paymentIntentId: paymentReference,
          zohoSync: 'subscription_failed',
          subscriptionDetails: subscriptionJson,
        },
        { status: 502 },
      )
    }

    // 3) Create subscription invoice in Zoho
    await fetch(`${origin}/api/zoho/subscription-invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscriptionId,
        contactId: memberId,
        paymentReference,
        amount,
        currency: currency.toUpperCase(),
        status: 'Paid',
      }),
    }).catch(() => {
      // Non-blocking; failures are logged server-side
    })

    return NextResponse.json({
      success: true,
      paymentIntentId: paymentReference,
      zohoSync: 'ok',
      memberId,
      subscriptionId,
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to process payment', message: (err as Error).message },
      { status: 500 },
    )
  }
}

