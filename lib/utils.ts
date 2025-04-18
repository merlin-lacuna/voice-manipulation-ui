import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { stickyLanesConfig } from "./config"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Check if a lane in a specific zone is a "sticky lane"
 * @param zoneName The name of the zone (e.g., "Zone 1")
 * @param laneNumber The lane number (1, 2, or 3)
 * @returns Boolean indicating if the lane is sticky
 */
export function isLaneSticky(zoneName: string, laneNumber: number): boolean {
  // If the zone isn't configured for sticky lanes, return false
  if (!stickyLanesConfig[zoneName]) {
    return false
  }
  
  // Check if the lane number is in the list of sticky lanes for this zone
  return stickyLanesConfig[zoneName].includes(laneNumber)
}

/**
 * Get the lane number from a lane name
 * @param laneName The lane name (e.g., "Lane 2")
 * @returns The lane number as a number (e.g., 2)
 */
export function getLaneNumber(laneName: string): number {
  // Extract the number from "Lane X"
  const match = laneName.match(/Lane (\d+)/)
  if (match && match[1]) {
    return parseInt(match[1], 10)
  }
  return 0 // Default if pattern doesn't match
}
