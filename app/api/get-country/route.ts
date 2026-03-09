// app/api/detect-country/route.ts
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    // 1. Get IP from common proxy headers
    let ip = request.headers.get("x-forwarded-for")?.split(",")[0] || 
             request.headers.get("x-real-ip");

    // 2. Localhost bypass for testing
    const host = request.headers.get("host");
    if (!ip || ip === "::1" || ip === "127.0.0.1" || host?.includes("localhost")) {
      // Manually return your country code for local testing (e.g., 'gb', 'in', 'af')
      return NextResponse.json({ country: "af" }); 
    }

    // 3. Fetch from ipapi.co
    const res = await fetch(`https://ipapi.co{ip}/json/`);
    const data = await res.json();

    return NextResponse.json({ 
      country: data.country_code?.toLowerCase() || "us" 
    });
  } catch (err) {
    return NextResponse.json({ country: "us" });
  }
}
