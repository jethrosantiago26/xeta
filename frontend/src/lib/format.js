export function formatMoney(value, currency = 'USD') {
  const number = Number(value ?? 0)

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(number)
}