export function unixToDate(unixTimestamp: number) {
  return new Date(unixTimestamp * 1000);
}

export function dateToUnix(date: Date) {
  return Math.floor(date.getTime() / 1000);
}
