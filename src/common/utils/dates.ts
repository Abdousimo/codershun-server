/**
 * Date and calendar utilities.
 */

/**
 * Returns the whole number of elapsed calendar/full months between two dates.
 */
export function differenceInFullMonths(laterDate: Date, earlierDate: Date): number {
  let months = (laterDate.getFullYear() - earlierDate.getFullYear()) * 12 + (laterDate.getMonth() - earlierDate.getMonth());
  if (laterDate.getDate() < earlierDate.getDate()) {
    months--;
  }
  return Math.max(0, months);
}

