export function dirMark(d: 1 | -1 | 0) {
  return d === 1 ? '▲' : d === -1 ? '▼' : ''
}

export function dirCls(d: 1 | -1 | 0) {
  return d === 1 ? 'up' : d === -1 ? 'dn' : ''
}
