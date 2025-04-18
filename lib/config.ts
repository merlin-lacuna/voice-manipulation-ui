/**
 * Configuration for sticky lanes
 * Once a card is placed in a sticky lane, it cannot be moved out.
 * 
 * Format: { "Zone Name": [lane numbers that are sticky] }
 * Lane numbers are 1-based (Lane 1, Lane 2, Lane 3)
 */
export const stickyLanesConfig: Record<string, number[]> = {
  "Zone 3": [3]     // Lane 3 in Zone 1 is sticky
  // "Zone 2": [2, 3],   Lanes 2 and 3 in Zone 2 are sticky
  // "Zone 3": [1]       Lane 1 in Zone 3 is sticky
}

/**
 * Configuration for blocking lanes
 * A card in a blocking lane cannot be moved to the next zone, but can be moved within the same zone.
 * 
 * Format: { "Zone Name": [lane numbers that are blocking] }
 * Lane numbers are 1-based (Lane 1, Lane 2, Lane 3)
 */
export const blockingLanesConfig: Record<string, number[]> = {
  "Zone 2": [1],  // Lanes 1 and 2 in Zone 1 block progression to Zone 2
  // "Zone 2": [1],     Lane 1 in Zone 2 blocks progression to Zone 3
  // "Zone 3": [3]      Lane 3 in Zone 3 would block progression to Zone 4 (if it existed)
}