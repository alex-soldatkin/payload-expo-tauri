import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createPayloadConfig } from '@payload-universal/schema'

import { Media } from './collections/Media'
import { Posts } from './collections/Posts'
import { Users } from './collections/Users'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default createPayloadConfig({
  baseDir: dirname,
  admin: {
    user: Users.slug,
    components: {
      Nav: {
        path: './components/NativeNav',
      },
    },
  },
  collections: [Users, Media, Posts],
})
