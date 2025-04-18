/**
 * Configuration for sticky lanes
 * Once a card is placed in a sticky lane, it cannot be moved out.
 * 
 * Format: { "Zone Name": [lane numbers that are sticky] }
 * Lane numbers are 1-based (Lane 1, Lane 2, Lane 3)
 */
export const stickyLanesConfig: Record<string, number[]> = {
  "Zone 1": [3],     // Lane 3 in Zone 1 is sticky
  "Zone 2": [2, 3],  // Lanes 2 and 3 in Zone 2 are sticky
  "Zone 3": [1],     // Lane 1 in Zone 3 is sticky
}