import { describe, it, expect } from 'vitest'
import { resolveWorkRoles, resolveEducationRoles, resolveCustomSectionRoles } from '../roles'

describe('resolveWorkRoles', () => {
  it('returns [] for an entry with no role content at all', () => {
    expect(resolveWorkRoles({ name: 'Acme' })).toEqual([])
  })

  it('synthesizes a single legacy role from top-level fields when roles is absent', () => {
    const result = resolveWorkRoles({ name: 'Acme', position: 'Engineer', startDate: '2020' })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ position: 'Engineer', startDate: '2020' })
  })

  it('returns roles[] as-is when there is no legacy role data', () => {
    const roles = [{ id: 'r1', position: 'Lead', startDate: '2022' }]
    expect(resolveWorkRoles({ name: 'Acme', roles })).toEqual(roles)
  })

  it('prepends the legacy role ahead of roles[] when a document has both — never drops either', () => {
    // This is exactly the shape every résumé built by the original nested-roles
    // feature produces: role 1 on the entry's own fields, roles 2+ in roles[].
    const result = resolveWorkRoles({
      name: 'Meta', position: 'Data Analyst', startDate: '2019',
      roles: [{ id: 'r1', position: 'Data Team Lead', startDate: '2021' }],
    })
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ position: 'Data Analyst', startDate: '2019' })
    expect(result[1]).toMatchObject({ position: 'Data Team Lead', startDate: '2021' })
  })
})

describe('resolveEducationRoles', () => {
  it('prepends the legacy role ahead of roles[]', () => {
    const result = resolveEducationRoles({
      institution: 'MIT', studyType: 'BSc',
      roles: [{ id: 'r1', studyType: 'MSc' }],
    })
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ studyType: 'BSc' })
    expect(result[1]).toMatchObject({ studyType: 'MSc' })
  })
})

describe('resolveCustomSectionRoles', () => {
  it('maps the legacy item.subtitle into role.subtitle (preserving its enabledFields gating) and prepends ahead of roles[]', () => {
    const result = resolveCustomSectionRoles({
      id: 'i1', title: 'IDF', subtitle: 'Soldier',
      roles: [{ id: 'r1', title: 'Squad Commander' }],
    })
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ subtitle: 'Soldier' })
    expect(result[1]).toMatchObject({ title: 'Squad Commander' })
  })

  it('returns [] when the item has neither legacy role content nor roles[]', () => {
    expect(resolveCustomSectionRoles({ id: 'i1', title: 'Certifications' })).toEqual([])
  })
})
