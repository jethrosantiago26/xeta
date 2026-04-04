export function formatMoney(value, currency = 'PHP') {
  const number = Number(value ?? 0)

  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).format(number)
}