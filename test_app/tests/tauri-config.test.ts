import { readFile } from 'fs/promises'
import path from 'path'
import { describe, expect, it } from 'vitest'

const tauriConfigPath = path.resolve(
  __dirname,
  '../apps/desktop-tauri/src-tauri/tauri.conf.json',
)

describe('desktop tauri config', () => {
  it('points at the static web preview', async () => {
    const raw = await readFile(tauriConfigPath, 'utf-8')
    const config = JSON.parse(raw) as { build?: { devUrl?: string; frontendDist?: string } }

    expect(config.build?.frontendDist).toBe('../web')
    expect(config.build?.devUrl).toBe('http://localhost:4173')
  })
})
