import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildConfig } from 'payload'

import { Media } from './collections/Media'
import { Users } from './collections/Users'
import { createRawConfig } from './createPayloadConfig'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export const rawConfig = createRawConfig({
  baseDir: dirname,
  admin: {
    user: Users.slug,
  },
  collections: [Users, Media],
})

export default buildConfig(rawConfig)
