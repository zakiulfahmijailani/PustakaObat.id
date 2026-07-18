import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('staff workspace navigation boundary', () => {
  it('passes serializable icon keys from server layouts to the client navigation', () => {
    const navigation = readFileSync('src/components/dashboard/StaffNavigation.tsx', 'utf8')
    const layouts = [
      'src/app/admin/(protected)/layout.tsx',
      'src/app/editor/(protected)/layout.tsx',
      'src/app/reviewer/(protected)/layout.tsx',
    ].map((path) => readFileSync(path, 'utf8')).join('\n')

    expect(navigation).toContain('const iconComponents =')
    expect(layouts).toContain("icon: 'layout-dashboard'")
    expect(layouts).not.toMatch(/icon:\s*[A-Z][A-Za-z]+/)
  })
})
