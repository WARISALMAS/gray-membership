import { NextResponse } from 'next/server'
import Stripe from 'stripe'

// Map the exact location names you receive from Zoho to Stripe keys.
// Example Zoho response:
// { Name: "Gray Dubai" } -> Gray account
// { Name: "Ibiza" }      -> Ibiza account
// { Name: "Dubai" }      -> Dubai account
type LocationKey = 'Gray Dubai' | 'Ibiza' | 'Dubai'

const STRIPE_CONFIG: Record<LocationKey, { secretKey: string | undefined; publishableKey: string | undefined }> = {
  Dubai: {
    secretKey: process.env.STRIPE_SECRET_KEY_DUBAI,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY_DUBAI,
  },
  Ibiza: {
    secretKey: process.env.STRIPE_SECRET_KEY_IBIZA,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY_IBIZA,
  },
  'Gray Dubai': {
    secretKey: process.env.STRIPE_SECRET_KEY_GRAY,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY_GRAY,
  },
}

interface CreateCheckoutSessionBody {
  location: LocationKey
  amount: number
  currency: string
  description?: string
  customerEmail?: string
  firstName?: string
  lastName?: string
  phone?: string
  zip?: string
  planId?: string
  planDuration?: string
  couponId?: string
  couponDiscount?: string | number
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<CreateCheckoutSessionBody>

    const location = body.location
    const amount = body.amount
    const currency = body.currency
    const description = body.description ?? 'Subscription payment'

    if (!location || !amount || !currency) {
      return NextResponse.json(
        { error: 'location, amount and currency are required' },
        { status: 400 },
      )
    }

    const stripeKeys = STRIPE_CONFIG[location]
    if (!stripeKeys || !stripeKeys.secretKey) {
      return NextResponse.json(
        { error: `Stripe keys are not configured for location: ${location}` },
        { status: 500 },
      )
    }

    const stripe = new Stripe(stripeKeys.secretKey, {
      apiVersion: '2024-06-20',
    })

    const origin = request.headers.get('origin') ?? 'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: description,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      customer_email: body.customerEmail,
      metadata: {
        flow: 'membership_public',
        location: location,
        planId: body.planId ?? '',
        planDuration: body.planDuration ?? '',
        firstName: body.firstName ?? '',
        lastName: body.lastName ?? '',
        email: body.customerEmail ?? '',
        phone: body.phone ?? '',
        zip: body.zip ?? '',
        couponId: body.couponId ?? '',
        couponDiscount:
          body.couponDiscount !== undefined && body.couponDiscount !== null
            ? String(body.couponDiscount)
            : '',
        amount: String(amount),
        currency,
      },
      success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/payment/cancelled`,
    })

    return NextResponse.json({
      id: session.id,
      url: session.url,
      publishableKey: stripeKeys.publishableKey ?? null,
    })
  } catch (err) {
    console.error('Stripe checkout session error', err)
    return NextResponse.json(
      { error: 'Failed to create Stripe Checkout Session', message: (err as Error).message },
      { status: 500 },
    )
  }
}

