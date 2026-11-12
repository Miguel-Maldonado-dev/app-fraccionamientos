import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

test('globals.css define los tokens del sistema', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8')
  for (const [name, value] of [
    ['--primary', '#086BB8'], ['--primary-hover', '#075A9C'], ['--primary-light', '#E7F1FD'],
    ['--brand-primary', '#087BE8'], ['--brand-navy', '#071F49'], ['--brand-aqua', '#00C7C7'],
    ['--brand-blue-mid', '#087FBD'], ['--tertiary', '#EAF7F8'], ['--tertiary-foreground', '#077389'],
    ['--background', '#F5F8FC'], ['--foreground', '#172536'], ['--text-secondary', '#496985'],
    ['--muted-foreground', '#5B6B80'], ['--border', '#E8EEF4'], ['--muted', '#EEF3F8'], ['--ring', '#087BE8'],
    ['--destructive', '#DC4C4C'],
    ['--success', '#16A36A'], ['--success-foreground', '#0B7A4D'], ['--success-light', '#E3F6EE'],
    ['--warning', '#E9A23B'], ['--warning-foreground', '#8A5300'], ['--warning-light', '#FDF1DE'],
    ['--danger', '#DC4C4C'], ['--danger-foreground', '#B42F2F'], ['--danger-light', '#FCE8E8'],
    ['--info', '#087BE8'], ['--info-foreground', '#0A5FB4'], ['--info-light', '#E7F1FD'],
    ['--neutral', '#5B6B80'], ['--neutral-foreground', '#475569'], ['--neutral-light', '#EEF3F8'],
    ['--chart-1', '#087BE8'], ['--chart-2', '#00C7C7'], ['--chart-3', '#071F49'], ['--chart-4', '#E9A23B'], ['--chart-5', '#DC4C4C'],
    ['--sidebar-primary', '#086BB8'], ['--sidebar-foreground', '#071F49'], ['--sidebar-ring', '#087BE8'],
    ['--radius', '14px'],
  ])
    expect(css).toMatch(new RegExp(`${name}:\\s*${value}\\b`, 'i'))
  expect(css).toContain('--brand-gradient: linear-gradient(110deg, #087BE8 0%, #087FBD 50%, #00C7C7 100%)')
  expect(css).toContain('--font-heading')
  expect(css).toContain('--color-brand-primary')
  expect(css).toContain('--color-neutral-light')
  for (const old of ['--badge-success', '--table-header', '--ingreso', '--egreso', '.dark {'])
    expect(css).not.toContain(old)
  expect(css).not.toContain('@custom-variant dark')
  expect(css).not.toContain('oklch(')
})
