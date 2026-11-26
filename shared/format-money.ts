// One way to write a ringgit amount everywhere: two decimals and thousands
// separators ("RM 1,521.21"). Before this, pages mixed `toFixed(2)`
// ("RM 1521.21") with `toLocaleString`, so the same order read differently
// on the order page, POS and printed labels.
//
// Uses a fixed en-MY formatter so server (emails, Billplz text) and client
// render identically regardless of the device's locale.

const MONEY = new Intl.NumberFormat("en-MY", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "1,521.21". Missing or non-numeric values read as 0.00. */
export const formatMoney = (n: number | string | null | undefined): string => {
  const v = Number(n ?? 0);
  return MONEY.format(Number.isFinite(v) ? v : 0);
};

/** "RM 1,521.21". */
export const formatRM = (n: number | string | null | undefined): string =>
  `RM ${formatMoney(n)}`;
