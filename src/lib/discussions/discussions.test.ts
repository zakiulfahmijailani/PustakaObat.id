import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createDiscussionSchema, discussionMessageSchema, discussionStatusSchema } from './schemas'

describe('internal staff discussions', () => {
  it('validates a private discussion with unique recipients', () => {
    const valid = createDiscussionSchema.safeParse({
      subject: 'Konfirmasi dosis vankomisin',
      participantIds: ['11111111-1111-4111-8111-111111111111'],
      message: 'Mohon reviewer memeriksa rekomendasi ini.',
    })
    expect(valid.success).toBe(true)

    expect(createDiscussionSchema.safeParse({
      subject: 'Tes',
      participantIds: [],
      message: '',
    }).success).toBe(false)
  })

  it('accepts messages and only known thread states', () => {
    expect(discussionMessageSchema.safeParse({ message: 'Sudah saya periksa.' }).success).toBe(true)
    expect(discussionMessageSchema.safeParse({ message: ' '.repeat(3) }).success).toBe(false)
    expect(discussionStatusSchema.safeParse({ status: 'resolved' }).success).toBe(true)
    expect(discussionStatusSchema.safeParse({ status: 'published' }).success).toBe(false)
  })

  it('enforces same-origin, authentication, and participant membership on writes', () => {
    const createRoute = readFileSync('src/app/api/discussions/route.ts', 'utf8')
    const messageRoute = readFileSync('src/app/api/discussions/[id]/messages/route.ts', 'utf8')
    const statusRoute = readFileSync('src/app/api/discussions/[id]/route.ts', 'utf8')

    expect(createRoute).toContain('isSameOriginMutation(request)')
    expect(createRoute).toContain('getActiveProfile()')
    expect(messageRoute).toContain('participant.profile_id = $2')
    expect(statusRoute).toContain('participant.profile_id = $2')
  })

  it('does not expose the former public question UI', () => {
    const adminLayout = readFileSync('src/app/admin/(protected)/layout.tsx', 'utf8')
    const reviewerLayout = readFileSync('src/app/reviewer/(protected)/layout.tsx', 'utf8')
    const editorLayout = readFileSync('src/app/editor/(protected)/layout.tsx', 'utf8')

    expect(adminLayout).toContain("title: 'Diskusi Internal'")
    expect(reviewerLayout).toContain("title: 'Diskusi Internal'")
    expect(editorLayout).toContain("title: 'Diskusi Internal'")
    expect(adminLayout).not.toContain('Tanya Farmasis')
  })
})
