import { NextResponse, NextRequest } from 'next/server';
import Stripe from 'stripe';

// Use your Secret Key from Stripe Dashboard (sk_test_...)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // @ts-ignore - or just remove apiVersion entirely
  apiVersion: '2023-10-16', 
});
export async function POST(req: NextRequest) {
  try {
    const { amount } = await req.json();

    // Create a PaymentIntent with the order amount and currency
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // In cents (e.g., 1000 = $10.00)
      currency: 'usd',
      // This automatically enables Google Pay, Apple Pay, and Cards
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error: any) {
    console.error('Stripe Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
