import { access } from 'fs/promises'
import path from 'path'
import { describe, it, expect } from 'vitest'

const root = path.resolve(__dirname, '../apps/server/src/app/(payload)')

const mustExist = [
  path.join(root, 'layout.tsx'),
  path.join(root, 'admin/[[...segments]]/page.tsx'),
  path.join(root, 'api/[...slug]/route.ts'),
]

describe('server app scaffold', () => {
  it('includes payload admin routes', async () => {
    for (const filePath of mustExist) {
      await expect(access(filePath)).resolves.toBeUndefined()
    }
  })
})
