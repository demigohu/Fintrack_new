import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatUsd(amount: string, rate: number) {
  const value = parseFloat(amount) * rate
  return `$${value.toFixed(2)}`
}

export function formatUsdPrecise(amount: string, rate: number) {
  const value = parseFloat(amount) * rate
  return value < 0.01 ? `$${value.toFixed(6)}` : `$${value.toFixed(2)}`
}

export function toDecimalStringNat(nat: { 0: string }, decimals: number) {
  if (!nat || !nat[0] || nat[0] === '') {
    return '0'
  }
  const value = BigInt(nat[0])
  const divisor = BigInt(10 ** decimals)
  const integer = value / divisor
  const fractional = value % divisor
  const fractionalStr = fractional.toString().padStart(decimals, '0').replace(/0+$/, '')
  return fractionalStr ? `${integer}.${fractionalStr}` : integer.toString()
}

export function toDecimalStringBigInt(value: bigint, decimals: number) {
  if (!value || value === BigInt(0)) {
    return '0'
  }
  const divisor = BigInt(10 ** decimals)
  const integer = value / divisor
  const fractional = value % divisor
  const fractionalStr = fractional.toString().padStart(decimals, '0').replace(/0+$/, '')
  return fractionalStr ? `${integer}.${fractionalStr}` : integer.toString()
}

export function parseDecimalToBaseUnits(decimal: string, decimals: number) {
  if (!decimal || decimal === '' || isNaN(parseFloat(decimal))) {
    return BigInt(0)
  }
  const parts = decimal.split('.')
  const integer = parts[0] || '0'
  const fractional = (parts[1] || '').padEnd(decimals, '0').slice(0, decimals)
  return BigInt(integer + fractional)
}
