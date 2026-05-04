import { format, formatDistanceToNow, isToday, isYesterday, differenceInMinutes, differenceInHours, differenceInDays, isValid } from "date-fns"

/**
 * Check if a value is a valid date
 */
function isValidDate(date: unknown): date is Date | string | number {
  if (date === null || date === undefined || date === "") return false
  const d = new Date(date as string | number | Date)
  return isValid(d)
}

/**
 * Format a date to relative time (e.g., "2 minutes ago", "Yesterday", "3 days ago")
 * Similar to Telegram/Viber message time display
 */
export function formatRelativeTime(date: Date | string | number | null | undefined): string {
  if (!isValidDate(date)) return ""
  
  const d = new Date(date)
  const now = new Date()

  const minutesDiff = differenceInMinutes(now, d)
  const hoursDiff = differenceInHours(now, d)
  const daysDiff = differenceInDays(now, d)

  // Less than 1 minute
  if (minutesDiff < 1) {
    return "now"
  }

  // Less than 1 hour
  if (minutesDiff < 60) {
    return `${minutesDiff}m ago`
  }

  // Less than 24 hours (show hours)
  if (hoursDiff < 24) {
    return `${hoursDiff}h ago`
  }

  // Today (but more than 1 hour ago) - show time only
  if (isToday(d)) {
    return format(d, "h:mm a")
  }

  // Yesterday
  if (isYesterday(d)) {
    return "Yesterday"
  }

  // Within last 7 days
  if (daysDiff < 7) {
    return format(d, "EEEE") // Day name like "Monday"
  }

  // Within last year - show date without year
  if (daysDiff < 365) {
    return format(d, "MMM d") // Like "Jan 15"
  }

  // Older - show full date
  return format(d, "MMM d, yyyy")
}

/**
 * Format a date for chat message timestamp
 * Shows time for today, "Yesterday" for yesterday, or date for older
 */
export function formatMessageTime(date: Date | string | number | null | undefined): string {
  if (!isValidDate(date)) return ""
  
  const d = new Date(date)

  if (isToday(d)) {
    return format(d, "h:mm a")
  }

  if (isYesterday(d)) {
    return "Yesterday " + format(d, "h:mm a")
  }

  return format(d, "MMM d, h:mm a")
}

/**
 * Format a date for chat list item
 * Shows relative time for recent messages, date for older ones
 */
export function formatChatListTime(date: Date | string | number | null | undefined): string {
  if (!isValidDate(date)) return ""
  
  const d = new Date(date)
  const now = new Date()
  const minutesDiff = differenceInMinutes(now, d)
  const hoursDiff = differenceInHours(now, d)
  const daysDiff = differenceInDays(now, d)

  // Less than 1 minute
  if (minutesDiff < 1) {
    return "now"
  }

  // Less than 1 hour - show minutes
  if (minutesDiff < 60) {
    return `${minutesDiff}m`
  }

  // Less than 24 hours - show hours
  if (hoursDiff < 24) {
    return `${hoursDiff}h`
  }

  // Today - show time
  if (isToday(d)) {
    return format(d, "h:mm a")
  }

  // Yesterday
  if (isYesterday(d)) {
    return "Yesterday"
  }

  // Within last 7 days - show day name
  if (daysDiff < 7) {
    return format(d, "EEE") // Short day name like "Mon"
  }

  // Show date
  return format(d, "MM/dd/yy")
}
