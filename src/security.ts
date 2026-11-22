import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

function blockedIPv4(ip: string): boolean {
  const n = ip.split('.').reduce((v, p) => (v * 256 + Number(p)) >>> 0, 0)
  const ranges: Array<[number, number]> = [
    [0x00000000, 0x00ffffff], [0x0a000000, 0x0affffff],
    [0x64400000, 0x647fffff], [0x7f000000, 0x7fffffff],
    [0xa9fe0000, 0xa9feffff], [0xac100000, 0xac1fffff],
    [0xc0a80000, 0xc0a8ffff], [0xc0000000, 0xc00000ff],
    [0xc0000200, 0xc00002ff], [0xc0586300, 0xc05863ff], [0xc6120000, 0xc613ffff], [0xc6336400, 0xc63364ff],
    [0xcb007100, 0xcb0071ff], [0xe0000000, 0xffffffff],
  ]
  return ranges.some(([start, end]) => n >= start && n <= end)
}

function blockedAddress(address: string): boolean {
  const version = isIP(address)
  if (version === 4) return blockedIPv4(address)
  if (version === 6) {
    const ip = address.toLowerCase()
    return ip === '::' || ip === '::1' || ip.startsWith('fc') ||
      ip.startsWith('fd') || ip.startsWith('fe8') || ip.startsWith('fe9') ||
      ip.startsWith('fea') || ip.startsWith('feb') || ip.startsWith('ff') ||
      ip.startsWith('::ffff:')
  }
  return false
}

/** Fail-closed SSRF guard for browser navigation and subresource requests. */
export async function assertSafeUrl(input: string, allowPrivateNetworks = false): Promise<URL> {
  let url: URL
  try { url = new URL(input) } catch { throw new Error('Invalid URL') }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP(S) URLs are allowed')
  if (url.username || url.password) throw new Error('URL credentials are not allowed')
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
  if (!hostname || (!allowPrivateNetworks && (hostname === 'localhost' || hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') || hostname.endsWith('.internal')))) {
    throw new Error('Local and internal hostnames are blocked')
  }
  if (isIP(hostname)) {
    if (!allowPrivateNetworks && blockedAddress(hostname)) throw new Error('Private or reserved IP addresses are blocked')
    return url
  }
  if (allowPrivateNetworks) return url
  let records
  try { records = await lookup(hostname, { all: true, verbatim: true }) }
  catch { throw new Error('Hostname DNS resolution failed; request blocked') }
  if (!records.length || records.some(record => blockedAddress(record.address))) {
    throw new Error('Hostname resolves to a private or reserved address; request blocked')
  }
  return url
}

export function validateSelector(selector: string): string {
  if (!selector.trim() || selector.length > 2048) throw new Error('Selector must be 1–2048 characters')
  return selector
}

export function validateTextInput(value: string, maxLength = 10000): string {
  if (value.length > maxLength) throw new Error(`Input exceeds ${maxLength} characters`)
  return value
}
