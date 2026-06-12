import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createPayloadConfig } from '@payload-universal/schema'

import { Events } from './collections/Events'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Posts } from './collections/Posts'
import { Products } from './collections/Products'
import { Users } from './collections/Users'
import { ViewPresets } from './collections/ViewPresets'
import { Footer } from './globals/Footer'
import { SiteSettings } from './globals/SiteSettings'

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
  collections: [Users, Media, Posts, Pages, Products, Events, ViewPresets],
  globals: [SiteSettings, Footer],
  // Native Payload query presets (payload-query-presets) — power saved
  // filters/columns in the web admin list view. The collection slug starts
  // with 'payload-' so the mobile local-first sync intentionally skips it;
  // mobile reads presets via REST (utils/api.ts payloadApi) when needed.
  queryPresets: {
    // `access` and `constraints` are required keys on this payload version's
    // Config type — empty objects keep Payload's built-in defaults
    // (authenticated users + onlyMe/specificUsers/everyone constraints).
    access: {},
    constraints: {},
    labels: {
      singular: 'Filter Preset',
      plural: 'Filter Presets',
    },
  },
  localization: {
    locales: [
      { label: 'English', code: 'en' },
      { label: 'Español', code: 'es' },
    ],
    defaultLocale: 'en',
    fallback: true,
  },
})
