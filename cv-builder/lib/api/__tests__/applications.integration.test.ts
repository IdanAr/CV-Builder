// lib/api/__tests__/applications.integration.test.ts
// Exercises patchApplication() against a real MongoDB replica set (required
// for transactions — a standalone mongod can't demonstrate this bug) instead
// of a mock. See docs/superpowers/plans/2026-08-31-top-5-confirmed-bug-fixes.md.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { connectMemoryMongo, disconnectMemoryMongo, clearMemoryMongo } from '@/test/mongo-memory'
import type { CreateApplicationInput } from '@/lib/schemas/application.zod'

let createApplication: typeof import('../applications')['createApplication']
let patchApplication: typeof import('../applications')['patchApplication']
let ApplicationActivity: typeof import('@/models/ApplicationActivity')['default']
let Application: typeof import('@/models/Application')['default']

beforeAll(async () => {
  await connectMemoryMongo()
  ;({ createApplication, patchApplication } = await import('../applications'))
  ApplicationActivity = (await import('@/models/ApplicationActivity')).default
  Application = (await import('@/models/Application')).default
}, 30000)

afterAll(async () => {
  await disconnectMemoryMongo()
})

beforeEach(async () => {
  await clearMemoryMongo()
})

const baseApp: CreateApplicationInput = {
  company: 'Acme',
  role: 'Engineer',
  status: 'applied',
  customFields: {},
}

describe('patchApplication — atomic update + audit log', () => {
  it('writes the Application update and its ApplicationActivity row together on success', async () => {
    const created = await createApplication('u1', baseApp)
    const id = String(created._id)

    await patchApplication('u1', id, { company: 'NewCo' })

    const rows = await ApplicationActivity.find({ applicationId: id }).lean()
    expect(rows).toHaveLength(1)
    expect(rows[0].field).toBe('company')
  })

  it('rolls back the Application update when the audit-log write fails, instead of leaving an unlogged change', async () => {
    const created = await createApplication('u1', baseApp)
    const id = String(created._id)

    const originalInsertMany = ApplicationActivity.insertMany.bind(ApplicationActivity)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(ApplicationActivity as any).insertMany = async () => {
      throw new Error('simulated audit-log failure')
    }

    try {
      await expect(patchApplication('u1', id, { company: 'NewCo' })).rejects.toThrow(
        'simulated audit-log failure'
      )
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(ApplicationActivity as any).insertMany = originalInsertMany
    }

    const current = await Application.findOne({ _id: id }).lean()
    expect(current?.company).toBe('Acme') // rolled back, not silently left as 'NewCo'

    const rows = await ApplicationActivity.find({ applicationId: id }).lean()
    expect(rows).toHaveLength(0)
  })
})
