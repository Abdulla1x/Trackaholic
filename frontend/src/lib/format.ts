// A number as people read it: rounded, with the device's own grouping
// ("1,234", or "1 234" in French). Every calorie and gram on screen goes
// through here, so a meal row and the meal's own screen can't disagree about
// how 1234 g reads.
//
// `decimals` is for the few values shown finer than a whole number, such as
// protein per 100 g. Rounding is Math.round's (half up, so 2.5 reads 3),
// done before formatting.
export function n(value: number, decimals = 0): string {
  const scale = 10 ** decimals
  return (Math.round(value * scale) / scale).toLocaleString()
}
