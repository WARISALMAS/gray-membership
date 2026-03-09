import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    // Use a server-side geo IP API
    const ip = req.headers.get("x-forwarded-for") || "8.8.8.8"; // fallback IP
    const response = await fetch(`https://ipwho.is/${ip}`);
    const data = await response.json();

    return new Response(
      JSON.stringify({
        country: data.country_code || "US",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ country: "US" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}