# Seven Club — Membership Signup UI Flow Prompt

## Overview

You are building the **Seven Club** membership signup flow — a premium luxury wellness club
(https://seven.club) with locations in Dubai and Ibiza.

**Brand identity:** Sophisticated, exclusive, empowering.
**Aesthetic:** Dark luxury — deep blacks, gold accents, elegant serif headings, refined sans-serif body text.
**Reference site:** https://seven.club

---

## Complete Signup Flow (from system diagram)

```
START
  │
  ▼
Step 1 — Select Location
  │
  ├── No location selected → END (block progression)
  │
  └── Yes → Step 2 — Enter Personal Information
                │
                ├── Fields invalid → Show Validation Errors → back to Step 2
                │
                └── All valid → Step 3 — Load Memberships
                                  │
                                  ├── No membership selected → END (block progression)
                                  │
                                  └── Yes → Step 4 — Payment Summary
                                              │
                                              └── Create Payment Intent
                                                    │
                                                    └── Redirect to Payment Gateway
                                                          │
                                                          ├── Payment Failed → Show Error → Allow Retry → back
                                                          │
                                                          └── Payment Success
                                                                │
                                                                └── Verify Webhook
                                                                      │
                                                                      └── Create Membership Record
                                                                            │
                                                                            └── Save User
                                                                                  │
                                                                                  └── Send Confirmation Email
                                                                                        │
                                                                                        └── Redirect to Success Page
                                                                                              │
                                                                                             END
```

---

## Step-by-Step UI Specification

---

### STEP 1 — Select Location

**Purpose:** User picks which Seven Club they are joining. No pricing is shown at this stage.

**UI Requirements:**
- Full-width step screen with headline: *"Choose Your Club"*
- Render location options as selectable cards (not a dropdown)
- Location options:
  - **Dubai** — Seven Club Dubai, UAE
  - **Ibiza** — Seven Club Ibiza, Spain
- Each card displays: club name, city, country — NO price shown here
- Selected card gets a gold highlight border
- "Continue" button is disabled until a location is selected
- No back button on this step (it is the first step)

**Logic:**
- Fetch locations from API on page load: `GET /api/v1/locations?active=true`
- Show loading skeleton while fetching
- Show error state with retry button if fetch fails
- Store selected: `locationId`, `locationName`, `brand`
- Do NOT show membership pricing or plans on this screen

---

### STEP 2 — Enter Personal Information

**Purpose:** Collect and validate the user's personal details before loading membership options.

**UI Requirements:**
- Show selected location at the top as context: e.g. *"Joining: Seven Dubai"*
- Form fields (all required):
  - First Name
  - Last Name
  - Email (with format validation)
  - Phone (with format validation — include country code selector)
  - Gender (Male / Female toggle, not a dropdown)
- Inline validation errors shown under each field — no alert popups
- "Continue" button disabled until all fields are valid
- Back button returns to Step 1

**Validation Rules:**
- First Name / Last Name: required, min 2 characters
- Email: required, valid email format
- Phone: required, valid international format
- Gender: required, must select one

**Error States:**
- Each invalid field shows a red underline and error message below it
- "Continue" button remains disabled while any field has an error
- On submit attempt with invalid fields, all errors surface simultaneously

---

### STEP 3 — Load & Select Membership

**Purpose:** Dynamically load membership plans for the selected location and let the user choose one.

**API Call:**
```
GET /api/v1/memberships?location={selectedLocationName}
No auth required
```

**Response shape (per membership):**
```json
{
  "id": "string",
  "name": "string",
  "benefits": ["string"],
  "duration": "string",
  "price": 500,
  "currency": "AED"
}
```

**UI Requirements:**
- Show loading skeleton while memberships are fetching
- Render each membership as a selectable card showing:
  - Name
  - Benefits list
  - Duration (e.g. Monthly, Annual)
  - Price + Currency
- Selected membership card gets gold highlight border
- "Continue" button disabled until a membership is selected
- Back button returns to Step 2
- Error state with retry button if API call fails

**Logic:**
- Always fetch fresh — never cache memberships between sessions
- Currency is derived from location: Dubai → `AED`, Ibiza → `EUR`
- Store selected: `membershipId`, `membershipName`, `price`, `currency`, `duration`

---

### STEP 4 — Payment Summary + Payment

**Purpose:** Show a full summary to the user, create a payment intent, and process payment.

#### 4A — Summary Screen

**UI Requirements:**
- Show a complete order summary before payment:
  - Selected Location (name + city)
  - Selected Membership (name + duration + benefits)
  - User Details (name + email)
  - Price breakdown (amount + currency)
- "Proceed to Payment" button
- Back button returns to Step 3

#### 4B — Create Payment Intent

When user confirms:
```
POST /api/v1/payments/process
Headers: Authorization: Bearer <accessToken>
Body:
{
  "memberRecordId": "string",
  "amount": 500,
  "currency": "AED",
  "paymentMethodId": "pm_xxxxx",
  "brand": "Seven",
  "location": "Seven Dubai",
  "invoiceNumber": "INV-001",
  "description": "Seven Club Membership"
}
```

Gateway is auto-selected by backend based on location:
- Dubai / Gray Dubai → **N-Genius**
- Ibiza → **Stripe**

#### 4C — Redirect to Payment Gateway

**UI Requirements:**
- Show a full-screen loading state: *"Preparing your payment…"*
- Spinner + Seven Club logo centered
- For N-Genius (Dubai): redirect to N-Genius hosted payment page
- For Stripe (Ibiza): mount Stripe Elements or redirect to Stripe Checkout

#### 4D — Payment Result Handling

**If Payment Fails:**
- Show inline payment failed screen (do not navigate away from flow)
- Display: *"Payment unsuccessful"* + reason if available
- Show "Try Again" button → returns user to payment form with fields intact
- Show "Use a different card" option
- Never clear previously entered personal details on retry

**If Payment Succeeds:**
- Do NOT redirect immediately
- Wait for webhook verification (show a *"Verifying your payment…"* state)
- Backend flow completes: Verify Webhook → Create Membership Record → Save User → Send Confirmation Email
- Only after all backend steps complete → redirect to Step 5 Success

**Processing UI States (in order):**
1. *"Processing your payment…"* — spinner, all buttons disabled
2. *"Verifying your membership…"* — secondary spinner
3. *"Almost there…"* — brief transition state
4. Redirect to Success

---

### STEP 5 — Success Page

**Purpose:** Confirm membership activation and direct user to the Seven Club app.

**UI Requirements:**
- Animated gold checkmark or Seven logo reveal on entry
- Headline: *"Welcome to Seven, [First Name]"*
- Subtext: *"Your membership is now active"*
- Show membership summary card: location, plan name, start date
- Note: *"A confirmation email has been sent to [email]"*

**App Redirect Section:**
- Headline: *"Start your journey on the Seven+ App"*
- Two download buttons side by side:
  - **App Store (iOS):** `https://apps.apple.com/ae/app/seven-befit-sports-club/id6446793656`
  - **Google Play (Android):** `https://play.google.com/store/apps/details?id=com.my_seven_app`
- Auto deep-link attempt after 3 seconds: `sevenclub://membership/success`
- Countdown shown: *"Opening the Seven app in 3… 2… 1…"*
- Fallback if app not installed: show store buttons more prominently
- Secondary link: *"Continue on web →"*

---

## Global UI Requirements

### Layout
- Desktop: Split layout — left panel (Seven Club branding/visual) + right panel (active step form)
- Mobile: Single column, full width, left panel collapses to a top header bar
- Left panel content: Seven Club logo, tagline *"Wellness Redefined"*, current step label, location name (once selected)

### Step Progress Indicator
- Shown at top of right panel on all steps
- 5 steps total: Location → Details → Membership → Payment → Welcome
- Active step: gold highlight
- Completed steps: gold checkmark icon
- Upcoming steps: muted/dimmed

### Transitions
- Smooth slide or fade animation between steps
- Direction: slide left when going forward, slide right when going back
- Duration: 300ms ease

### Error Handling
- All field errors: inline, under the field, red text — never alert/modal popups
- Network errors: toast notification bottom-right with retry action, auto-dismiss after 5s
- API failures: full inline error state with retry button inside the step — never a blank screen
- Payment errors: inline within payment step, never navigate user away

### Validation
- Validate on blur (when user leaves a field)
- Re-validate on change after first submission attempt
- "Continue" / submit buttons always reflect form validity state in real time

### Loading States
- Every API call must have a loading skeleton or spinner
- Buttons show spinner + disabled state during any pending API call
- Never show an empty screen — always show skeleton or placeholder

### Typography & Colors
- Headings: Elegant serif font (e.g. Cormorant Garamond, Playfair Display)
- Body/labels: Clean sans-serif (e.g. Jost, DM Sans)
- Background: `#080807` (near black)
- Surface: `#1a1a17`
- Border: `#272724`
- Gold accent: `#c8a96e`
- Text primary: `#f2f0e8`
- Text muted: `#5a5a55`
- Error: `#c45c5c`
- Success: `#4caf7d`

---

## Mock Data (for UI development)

```json
Locations:
[
  { "id": 1, "name": "Seven Dubai", "brand": "Seven", "city": "Dubai", "country": "UAE",   "currency": "AED" },
  { "id": 2, "name": "Gray Dubai",  "brand": "Gray",  "city": "Dubai", "country": "UAE",   "currency": "AED" },
  { "id": 3, "name": "Seven Ibiza", "brand": "Seven", "city": "Ibiza", "country": "Spain", "currency": "EUR" }
]

Memberships (Dubai):
[
  {
    "id": "mem_001",
    "name": "Seven Elite",
    "benefits": ["Gym Access", "Studio Classes", "Spa Access", "Locker Room"],
    "duration": "Monthly",
    "price": 500,
    "currency": "AED"
  },
  {
    "id": "mem_002",
    "name": "Seven Annual",
    "benefits": ["Gym Access", "Studio Classes", "Spa Access", "Locker Room", "Personal Training Session"],
    "duration": "Annual",
    "price": 4500,
    "currency": "AED"
  }
]

Memberships (Ibiza):
[
  {
    "id": "mem_003",
    "name": "Seven Ibiza Premium",
    "benefits": ["Gym Access", "Studio Classes", "Spa Access", "Pool Access"],
    "duration": "Monthly",
    "price": 120,
    "currency": "EUR"
  }
]

Test User:
{
  "firstName": "Alex",
  "lastName": "Johnson",
  "email": "alex@example.com",
  "phone": "+971 50 123 4567",
  "gender": "male"
}
```

---

## API Endpoints Summary

| Step | Method | Endpoint | Auth |
|------|--------|----------|------|
| 1 | GET | `/api/v1/locations?active=true` | Public |
| 3 | GET | `/api/v1/memberships?location={name}` | Public |
| 4 | POST | `/api/v1/payments/process` | JWT Bearer |
| 4 (3DS) | POST | `/api/v1/payments/confirm` | JWT Bearer |
| 4 (webhook) | POST | `/api/v1/payments/webhook` | Stripe Signature |
| 5 | GET | `/api/v1/auth/profile` | JWT Bearer |

---

## Key Rules — Never Violate

- Location `name` and `brand` must always come from `/locations` API — never hardcode
- No pricing is shown on Step 1 (location selection screen)
- Memberships are always fetched fresh per selected location — never reuse cached data
- Payment gateway is determined by backend via `location` field — never set manually
- `payments/confirm` is Stripe-only — never called for N-Genius
- Currency always matches location: AED for Dubai, EUR for Ibiza
- Never clear user's personal details (Step 2 data) on payment retry
- App redirect on Step 5 only happens after membership is confirmed active
- Webhook verification must complete before showing success screen

---

## Task

**[YOUR TASK HERE]**

> Replace this line with what you want to build — e.g.:
> - *"Build the full 5-step flow as a single HTML file"*
> - *"Build it as a React component with Tailwind CSS"*
> - *"Build only Step 1 and Step 3 as interactive components"*
> - *"Write the TypeScript service layer for all API calls"*
