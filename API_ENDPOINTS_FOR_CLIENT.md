# API Endpoints Implemented in This Project

Endpoints below are the ones **actually used** in the Seven Club app for **Buy Now**, **Signup**, and **Login** flows.

**Backend base URL:** `NEXT_PUBLIC_API_BASE_URL` (e.g. `https://7backend2026.sevenwellness.club`)  
**Auth:** `Authorization: Bearer <accessToken>` for protected endpoints.

---

## 1. Login flow (implemented)

Login in this project is **OTP-only** (email or phone). Email/password login is not used in the UI.

| Method | Endpoint | Used in |
|--------|----------|--------|
| POST | `/api/v1/members/auth/otp/generate` | `/verify-otp` (email), `/verify-otp-phone` (phone – send/resend OTP) |
| POST | `/api/v1/members/auth/otp/verify` | `/verify-otp`, `/verify-otp-phone` (verify code → returns tokens) |
| GET | `/api/v1/members/auth/profile` | After login (e.g. redirect to `/profile`), and wherever `useProfile()` is used |
| POST | `/api/v1/auth/verify-email` | `/verify-email` page (verify email with code/token) |

---

## 2. Signup flow (implemented)

| Method | Endpoint | Used in |
|--------|----------|--------|
| GET | `/api/v1/locations` | Step 1 – Choose club (`Step1ChooseClub`, `useLocations`) |
| POST | `/api/v1/members/auth/signup` | Step 2 – Personal details (`Step2PersonalDetails`, `useSignupMutation`) |
| POST | `/api/v1/members/auth/otp/generate` | Phone OTP send/resend on `/verify-otp-phone` (after signup redirect) |
| POST | `/api/v1/members/auth/otp/verify` | `/verify-otp-phone` after signup (verify → tokens) |
| GET | `/api/v1/members/auth/profile` | Signup page (steps 3+), payment step, trial step |
| GET | `/api/v1/subscription-plans` | Step 3 – Select membership (`Step3SelectMembership`, `useSubscriptionPlans`) |
| POST | `/api/v1/payments/create-intent` | Step 4 – Payment (`Step3Payment`, `createPaymentIntent`) |
| POST | `/api/v1/subscriptions` | Step 4 – After successful payment (`Step3Payment`, `createSubscription`) |
| POST | `/api/v1/coupons/validate` | Step 4 – Apply coupon (`Step3Payment`, `validateCoupon`) |
| GET | `/api/v1/trial-bookings/{memberId}` | Step 4 – Trial date/time (`Step4TrialDateTime`, `useTrialBookings`) |
| POST | `/api/v1/trial-bookings/{memberId}` | Step 4 – Book trial (`Step4TrialDateTime`, `createTrialBooking`) |

---

## 3. Buy now flow (implemented)

Buy now uses the **same backend endpoints** as signup, in this order:

| Step | Method | Endpoint |
|------|--------|----------|
| 1 – Choose club | GET | `/api/v1/locations` |
| 2 – Personal details | POST | `/api/v1/members/auth/signup` |
| 2 – Verify OTP | POST | `/api/v1/members/auth/otp/generate` (if resend) |
| 2 – Verify OTP | POST | `/api/v1/members/auth/otp/verify` |
| 3 – Select membership | GET | `/api/v1/subscription-plans` |
| 4 – Payment (optional coupon) | POST | `/api/v1/coupons/validate` |
| 4 – Payment | POST | `/api/v1/payments/create-intent` |
| 5 – Confirm subscription | POST | `/api/v1/subscriptions` |

Profile is also used where needed: **GET** `/api/v1/members/auth/profile`.

---

## 4. App route (same origin) – implemented

Used only for **Stripe Apple Pay / Google Pay** (wallet) on the payment step:

| Method | Path | Used in |
|--------|------|--------|
| POST | `/api/create-payment-intent` | `WalletPaymentButton` (Stripe Payment Intent; server uses `STRIPE_SECRET_KEY`) |

Card payments use the **backend** `POST /api/v1/payments/create-intent`; only the wallet button calls this Next.js route.

---

## Summary – all endpoints implemented in this project

**Backend (same base URL):**

- GET `/api/v1/locations`
- POST `/api/v1/members/auth/signup`
- POST `/api/v1/members/auth/otp/generate`
- POST `/api/v1/members/auth/otp/verify`
- GET `/api/v1/members/auth/profile`
- POST `/api/v1/auth/verify-email`
- GET `/api/v1/subscription-plans`
- POST `/api/v1/payments/create-intent`
- POST `/api/v1/subscriptions`
- POST `/api/v1/coupons/validate`
- GET `/api/v1/trial-bookings/{memberId}`
- POST `/api/v1/trial-bookings/{memberId}`

**App route (your Next.js app):**

- POST `/api/create-payment-intent` (Stripe wallet only)

**Not used in the UI:**  
`POST /api/v1/auth/login` (email/password) and `POST /api/v1/auth/refresh` are defined in `lib/api/auth.ts` but not used by any page.  
`GET /api/v1/schedules` is defined but not used (trial uses manual date/time).
