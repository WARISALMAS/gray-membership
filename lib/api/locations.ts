import { useQuery } from '@tanstack/react-query'

import type { Location } from './types'

export type LocationsFilter = {
  brand?: string
  active?: boolean
}

// Internal proxy route – keeps Zoho secrets on the server
const INTERNAL_LOCATIONS_URL = '/api/zoho/locations'

// function mapZohoLocationToLocation(record: any): Location {
//   const rawName = record.Name ?? record.name ?? ''
//   const rawCity = record.City ?? record.city ?? rawName
//   const rawCountry = record.Country ?? record.country ?? ''
//   const rawBrand = record.Brand ?? record.brand ?? 'Gray'

//   return {
//     id: String(record.id ?? record.ID ?? rawName),
//     name: rawName,
//     brand: String(Array.isArray(rawBrand) ? rawBrand[0] : rawBrand || 'Gray'),
//     city: String(rawCity ?? ''),
//     country: String(rawCountry ?? ''),
//     // Simple heuristic: Ibiza -> EUR, else AED (can be refined later)
//     currency: String(rawCity ?? '').toLowerCase().includes('ibiza') ? 'EUR' : 'AED',
//   }
// }

function mapZohoLocationToLocation(record: any): Location {
  const rawName = record.Name ?? record.name ?? ''
  const rawCity = record.City ?? record.city ?? rawName
  const rawCountry = record.Country ?? record.country ?? ''

  const nameLower = String(rawName).toLowerCase()
  const cityLower = String(rawCity).toLowerCase()

  let brand = 'Seven'
  let currency = 'AED'

  // Brand logic
  if (nameLower.includes('gray dubai')) {
    brand = 'Gray'
  } else if (cityLower.includes('dubai') || cityLower.includes('ibiza')) {
    brand = 'Seven'
  }

  // Currency logic
  if (cityLower.includes('ibiza')) {
    currency = 'EUR'
  } else {
    currency = 'AED'
  }

  return {
    id: String(record.id ?? record.ID ?? rawName),
    name: rawName,
    brand,
    city: String(rawCity ?? ''),
    country: String(rawCountry ?? ''),
    currency,
  }
}

async function fetchLocations(filter?: LocationsFilter): Promise<Location[]> {
  const res = await fetch(INTERNAL_LOCATIONS_URL, { cache: 'no-store' })
  if (!res.ok) {
    // For now just throw; React Query will surface a generic error
    throw new Error(`Failed to load locations (${res.status})`)
  }

  const json: any = await res.json()
   console.log("Zoho API response:", json) // 👈 check raw response
  const records: any[] = Array.isArray(json?.data) ? json.data : []
  console.log("Zoho records:", records) // 👈 check records
  let locations = records.map(mapZohoLocationToLocation)
  console.log("Mapped locations:", locations) // 👈 check mapped result
  if (filter?.brand) {
    const brandLower = filter.brand.toLowerCase()
    locations = locations.filter((loc) => loc.brand.toLowerCase() === brandLower)
  }

  // Zoho may have an Active/Status field – filter on it when present
  if (typeof filter?.active === 'boolean') {
    locations = locations.filter((loc, idx) => {
      const source = records[idx] ?? {}
      const active =
        source.Active ??
        source.active ??
        source.Is_Active ??
        source.is_active ??
        true
      return filter.active ? !!active : !active
    })
  }

  return locations
}

export const locationsKeys = {
  all: ['locations'] as const,
  list: (filter?: LocationsFilter) =>
    ['locations', filter?.brand ?? 'all', filter?.active ?? 'any'] as const,
}

export function useLocations(filter?: LocationsFilter) {
  return useQuery({
    queryKey: locationsKeys.list(filter),
    queryFn: () => fetchLocations(filter),
    staleTime: 5 * 60 * 1000,
  })
}

export { fetchLocations }
