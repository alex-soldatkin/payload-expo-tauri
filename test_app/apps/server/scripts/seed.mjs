/**
 * seed.mjs — Rich demo seed for payload_universal_test database.
 *
 * Covers ALL user-facing collections (users, media, posts, pages, products,
 * events, view-presets) and globals (site-settings, footer).
 *
 * Usage:
 *   pnpm seed           — idempotent (skips docs that already exist by slug/sku/title)
 *   pnpm seed --fresh   — drops user-facing collection docs first, then re-seeds
 *
 * Run via tsx so the TypeScript config can be imported:
 *   node --import tsx/esm ./scripts/seed.mjs
 * (configured in package.json "seed" script)
 *
 * Env resolution mirrors reset-db.mjs: repo-root .env → test_app/.env →
 * apps/server/.env, first-definition wins.
 */
import zlib from 'node:zlib'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import dotenv from 'dotenv'

// ─── Env resolution (same as reset-db.mjs) ────────────────────────────────

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(serverDir, '../../..')

const envPaths = [
  path.join(repoRoot, '.env'),
  path.join(repoRoot, 'test_app', '.env'),
  path.join(serverDir, '.env'),
]

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false })
  }
}

if (!process.env.DATABASE_URL) {
  console.error('[seed] DATABASE_URL is not set in any .env file. Aborting.')
  process.exit(1)
}
if (!process.env.PAYLOAD_SECRET) {
  console.error('[seed] PAYLOAD_SECRET is not set in any .env file. Aborting.')
  process.exit(1)
}

// ─── Payload config (imported via tsx loader) ─────────────────────────────

const { default: config } = await import('../src/payload.config.ts')
const { getPayload } = await import('payload')

const payload = await getPayload({ config })

// ─── Flags ─────────────────────────────────────────────────────────────────

const FRESH = process.argv.includes('--fresh')

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Create a minimal Lexical SerializedEditorState with one or more paragraph texts. */
function richText(...paragraphs) {
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: 'ltr',
      children: paragraphs.map((text) => ({
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr',
        textStyle: '',
        textFormat: 0,
        children: [
          {
            type: 'text',
            format: 0,
            style: '',
            mode: 'normal',
            detail: 0,
            text,
            version: 1,
          },
        ],
      })),
    },
  }
}

/** Rich text with a heading + bullet list + paragraph. */
function richTextFull(heading, items, body) {
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: 'ltr',
      children: [
        {
          type: 'heading',
          tag: 'h2',
          format: '',
          indent: 0,
          version: 1,
          direction: 'ltr',
          children: [
            { type: 'text', format: 0, style: '', mode: 'normal', detail: 0, text: heading, version: 1 },
          ],
        },
        {
          type: 'list',
          listType: 'bullet',
          start: 1,
          format: '',
          indent: 0,
          version: 1,
          direction: 'ltr',
          children: items.map((item) => ({
            type: 'listitem',
            value: 1,
            checked: undefined,
            format: '',
            indent: 0,
            version: 1,
            direction: 'ltr',
            children: [
              { type: 'text', format: 0, style: '', mode: 'normal', detail: 0, text: item, version: 1 },
            ],
          })),
        },
        {
          type: 'paragraph',
          format: '',
          indent: 0,
          version: 1,
          direction: 'ltr',
          textStyle: '',
          textFormat: 0,
          children: [
            { type: 'text', format: 0, style: '', mode: 'normal', detail: 0, text: body, version: 1 },
          ],
        },
      ],
    },
  }
}

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

function daysFromNow(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString()
}

/** Return an ISO string for the nth day of the current month at a given hour. */
function thisMonthDay(day, hour = 10) {
  const d = new Date()
  d.setDate(day)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

/** Return an ISO string for the nth day of next month at a given hour. */
function nextMonthDay(day, hour = 10) {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  d.setDate(day)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

/** Midnight start for all-day events: YYYY-MM-DDT00:00:00.000Z */
function allDay(day) {
  const d = new Date()
  d.setDate(day)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

let counts = {}
function logCount(collection, n) {
  counts[collection] = (counts[collection] || 0) + n
}

// ─── --fresh wipe ─────────────────────────────────────────────────────────

const USER_FACING_SLUGS = ['posts', 'pages', 'products', 'events', 'media', 'view-presets']

if (FRESH) {
  console.log('[seed] --fresh: wiping user-facing collections (not users)…')
  for (const slug of USER_FACING_SLUGS) {
    await payload.delete({ collection: slug, where: {} })
    console.log(`[seed]   cleared ${slug}`)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. USERS
// ═══════════════════════════════════════════════════════════════════════════

const SEED_PASSWORD = 'payload-test-1234'

async function ensureUser({ email, name, role }) {
  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
  })
  if (existing.docs.length > 0) {
    console.log(`[seed] users: skip ${email} (exists)`)
    return existing.docs[0]
  }
  const user = await payload.create({
    collection: 'users',
    data: { email, name, role, password: SEED_PASSWORD },
  })
  logCount('users', 1)
  console.log(`[seed] users: created ${email}`)
  return user
}

const editorUser = await ensureUser({ email: 'editor@example.com', name: 'Elena Editor', role: 'editor' })
const viewerUser = await ensureUser({ email: 'viewer@example.com', name: 'Victor Viewer', role: 'viewer' })

// Grab the first admin user
const adminResult = await payload.find({
  collection: 'users',
  where: { role: { equals: 'admin' } },
  limit: 1,
})
const adminUser = adminResult.docs[0] ?? editorUser

// ═══════════════════════════════════════════════════════════════════════════
// 2. MEDIA  (sharp → solid-color 1200×800 PNGs; tiny 4×4 fallback)
// ═══════════════════════════════════════════════════════════════════════════

// ── CRC-32 + PNG chunk builder for the fallback path ──

function crc32(buf) {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c
  }
  let crc = 0xffffffff
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(data.length, 0)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0)
  return Buffer.concat([lenBuf, typeBytes, data, crcBuf])
}

/** Hand-crafted minimal 4×4 solid-color PNG — no extra deps. */
function buildTinyPng(r, g, b) {
  const W = 4, H = 4
  const raw = Buffer.alloc(H * (1 + W * 3))
  for (let row = 0; row < H; row++) {
    const base = row * (1 + W * 3)
    raw[base] = 0 // filter type None
    for (let col = 0; col < W; col++) {
      raw[base + 1 + col * 3] = r
      raw[base + 1 + col * 3 + 1] = g
      raw[base + 1 + col * 3 + 2] = b
    }
  }
  const compressed = zlib.deflateSync(raw)

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(W, 0)
  ihdr.writeUInt32BE(H, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 2  // color type: RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  return Buffer.concat([
    Buffer.from('\x89PNG\r\n\x1a\n'),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

// Try sharp; fall back to tiny hand-crafted PNG buffers.
let sharpAvailable = false
let sharpMod
try {
  sharpMod = (await import('sharp')).default
  sharpAvailable = true
} catch (_) {
  console.warn('[seed] sharp not available — using minimal 4×4 inline PNGs')
}

/** Build a solid-color PNG buffer via sharp (1200×800) or 4×4 fallback. */
async function makeColorPng(r, g, b) {
  if (sharpAvailable) {
    const pixel = Buffer.from([r, g, b])
    return sharpMod(pixel, { raw: { width: 1, height: 1, channels: 3 } })
      .resize(1200, 800, { fit: 'fill' })
      .png()
      .toBuffer()
  }
  return buildTinyPng(r, g, b)
}

const PALETTE = [
  { r: 99,  g: 102, b: 241, name: 'indigo',   alt: 'Indigo abstract hero'    },
  { r: 34,  g: 197, b: 94,  name: 'emerald',  alt: 'Emerald forest backdrop' },
  { r: 239, g: 68,  b: 68,  name: 'red',      alt: 'Crimson product splash'  },
  { r: 245, g: 158, b: 11,  name: 'amber',    alt: 'Amber warm texture'      },
  { r: 59,  g: 130, b: 246, name: 'blue',     alt: 'Sky-blue gradient'       },
  { r: 168, g: 85,  b: 247, name: 'purple',   alt: 'Purple brand shot'       },
  { r: 20,  g: 184, b: 166, name: 'teal',     alt: 'Teal ocean thumbnail'    },
  { r: 249, g: 115, b: 22,  name: 'orange',   alt: 'Orange editorial'        },
]

const mediaIds = []

for (const color of PALETTE) {
  const existing = await payload.find({
    collection: 'media',
    where: { alt: { equals: color.alt } },
    limit: 1,
  })
  if (existing.docs.length > 0) {
    console.log(`[seed] media: skip "${color.alt}" (exists)`)
    mediaIds.push(existing.docs[0].id)
    continue
  }

  const buf = await makeColorPng(color.r, color.g, color.b)
  const tmpPath = path.join(os.tmpdir(), `seed-${color.name}-${Date.now()}.png`)
  fs.writeFileSync(tmpPath, buf)

  try {
    const doc = await payload.create({
      collection: 'media',
      data: { alt: color.alt },
      filePath: tmpPath,
    })
    mediaIds.push(doc.id)
    logCount('media', 1)
    console.log(`[seed] media: created "${color.alt}" (${sharpAvailable ? '1200×800' : '4×4 fallback'})`)
  } finally {
    fs.unlinkSync(tmpPath)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. POSTS  (12 posts, all statuses, two with scheduling)
// ═══════════════════════════════════════════════════════════════════════════

const POST_SPECS = [
  {
    title: 'Getting Started with TypeScript',
    slug: 'getting-started-typescript',
    status: 'published',
    category: 'technology',
    contentFormat: 'tutorial',
    language: 'en',
    tags: ['typescript', 'javascript', 'beginners'],
    publishedDate: daysAgo(55),
    featured: true,
    readTime: 8,
    priority: 9,
    excerpt: 'A comprehensive beginner guide to TypeScript covering types, interfaces, and generics.',
    authorRef: adminUser.id,
    heroImageIdx: 0,
    galleryIdxs: [1, 2],
  },
  {
    title: 'Empezando con TypeScript',
    slug: 'empezando-typescript',
    status: 'published',
    category: 'technology',
    contentFormat: 'tutorial',
    language: 'es',
    tags: ['typescript', 'programacion'],
    publishedDate: daysAgo(50),
    featured: false,
    readTime: 10,
    priority: 7,
    excerpt: 'Una guía completa para principiantes sobre TypeScript cubriendo tipos, interfaces y genéricos.',
    authorRef: editorUser.id,
    heroImageIdx: 1,
    galleryIdxs: [0],
  },
  {
    title: 'The Future of AI in Content Creation',
    slug: 'future-ai-content-creation',
    status: 'published',
    category: 'technology',
    contentFormat: 'article',
    language: 'en',
    tags: ['ai', 'content', 'future'],
    publishedDate: daysAgo(40),
    featured: true,
    readTime: 6,
    priority: 8,
    excerpt: 'Exploring how large language models are reshaping the landscape of digital content.',
    authorRef: editorUser.id,
    heroImageIdx: 2,
    galleryIdxs: [3, 4],
    schedulePublish: daysFromNow(2),
    scheduleUnpublish: daysFromNow(60),
  },
  {
    title: 'Science of Sleep: What Research Tells Us',
    slug: 'science-of-sleep',
    status: 'published',
    category: 'science',
    contentFormat: 'article',
    language: 'en',
    tags: ['health', 'science', 'sleep'],
    publishedDate: daysAgo(35),
    featured: false,
    readTime: 12,
    priority: 6,
    excerpt: 'Cutting-edge sleep research decoded for the everyday reader.',
    authorRef: adminUser.id,
    heroImageIdx: 3,
    galleryIdxs: [5],
  },
  {
    title: 'Street Food Tour: Mexico City',
    slug: 'street-food-mexico-city',
    status: 'published',
    category: 'travel',
    contentFormat: 'review',
    language: 'en',
    tags: ['food', 'travel', 'mexico'],
    publishedDate: daysAgo(28),
    featured: false,
    readTime: 5,
    priority: 5,
    excerpt: "Tacos, tlayudas, and tamales — the ultimate guide to Mexico City's street food scene.",
    authorRef: editorUser.id,
    heroImageIdx: 4,
    galleryIdxs: [6, 7],
  },
  {
    title: 'Jazz Revival: The New Generation',
    slug: 'jazz-revival-new-generation',
    status: 'published',
    category: 'culture',
    contentFormat: 'article',
    language: 'en',
    tags: ['music', 'jazz', 'culture'],
    publishedDate: daysAgo(20),
    featured: false,
    readTime: 7,
    priority: 4,
    excerpt: 'How a new cohort of musicians is bringing jazz to a new audience.',
    authorRef: adminUser.id,
    heroImageIdx: 5,
    galleryIdxs: [0, 1],
  },
  {
    title: 'Building a Design System from Scratch',
    slug: 'design-system-from-scratch',
    status: 'review',
    category: 'technology',
    contentFormat: 'tutorial',
    language: 'en',
    tags: ['design', 'ux', 'components'],
    publishedDate: daysAgo(10),
    featured: false,
    readTime: 15,
    priority: 7,
    excerpt: 'Step-by-step process for creating a robust, scalable design system.',
    authorRef: editorUser.id,
    heroImageIdx: 6,
    galleryIdxs: [2],
  },
  {
    title: 'Construyendo un Sistema de Diseño',
    slug: 'construyendo-sistema-diseno',
    status: 'review',
    category: 'technology',
    contentFormat: 'tutorial',
    language: 'es',
    tags: ['diseno', 'ux'],
    publishedDate: daysAgo(8),
    featured: false,
    readTime: 15,
    priority: 6,
    excerpt: 'Proceso paso a paso para crear un sistema de diseño robusto y escalable.',
    authorRef: editorUser.id,
    heroImageIdx: 7,
    galleryIdxs: [],
  },
  {
    title: 'Introduction to Quantum Computing',
    slug: 'intro-quantum-computing',
    status: 'draft',
    category: 'science',
    contentFormat: 'article',
    language: 'en',
    tags: ['quantum', 'computing', 'science'],
    publishedDate: null,
    featured: false,
    readTime: 18,
    priority: 9,
    excerpt: "A non-mathematician's guide to quantum superposition, entanglement, and qubits.",
    authorRef: adminUser.id,
    heroImageIdx: 0,
    galleryIdxs: [3],
  },
  {
    title: 'Exploring the Amazon Rainforest',
    slug: 'exploring-amazon-rainforest',
    status: 'draft',
    category: 'travel',
    contentFormat: 'article',
    language: 'en',
    tags: ['travel', 'nature', 'amazon'],
    publishedDate: null,
    featured: false,
    readTime: 9,
    priority: 3,
    excerpt: 'An immersive travel account of three weeks in the heart of the Amazon.',
    authorRef: viewerUser.id,
    heroImageIdx: 1,
    galleryIdxs: [4, 5],
    schedulePublish: daysFromNow(14),
  },
  {
    title: 'The Rise of Remote Work Culture',
    slug: 'rise-remote-work-culture',
    status: 'archived',
    category: 'culture',
    contentFormat: 'article',
    language: 'en',
    tags: ['remote', 'work', 'culture'],
    publishedDate: daysAgo(58),
    featured: false,
    readTime: 6,
    priority: 2,
    excerpt: 'How the pandemic permanently reshaped how companies think about office work.',
    authorRef: adminUser.id,
    heroImageIdx: 2,
    galleryIdxs: [],
  },
  {
    title: 'Sustainable Travel: Tips for Eco-Tourists',
    slug: 'sustainable-travel-tips',
    status: 'archived',
    category: 'travel',
    contentFormat: 'review',
    language: 'en',
    tags: ['sustainable', 'travel', 'eco'],
    publishedDate: daysAgo(60),
    featured: false,
    readTime: 4,
    priority: 2,
    excerpt: 'Practical advice for travelling the world with a lighter environmental footprint.',
    authorRef: editorUser.id,
    heroImageIdx: 3,
    galleryIdxs: [6],
  },
]

const postIds = []
const publishedPostIds = []

for (const spec of POST_SPECS) {
  const existing = await payload.find({
    collection: 'posts',
    where: { slug: { equals: spec.slug } },
    limit: 1,
  })
  if (existing.docs.length > 0) {
    console.log(`[seed] posts: skip "${spec.slug}" (exists)`)
    const doc = existing.docs[0]
    postIds.push(doc.id)
    if (spec.status === 'published') publishedPostIds.push(doc.id)
    continue
  }

  const isPublished = spec.status === 'published'

  const doc = await payload.create({
    collection: 'posts',
    draft: !isPublished,
    data: {
      title: spec.title,
      slug: spec.slug,
      summary: richText(spec.excerpt),
      contentFormat: spec.contentFormat,
      language: spec.language,
      excerpt: spec.excerpt,
      content: richTextFull(
        `${spec.title} — Overview`,
        ['Key insight one', 'Key insight two', 'Key insight three'],
        `This is the full body of "${spec.title}". It covers all the essential aspects in detail, giving readers a thorough understanding of the subject matter.`,
      ),
      heroImage: mediaIds[spec.heroImageIdx],
      gallery: {
        images: spec.galleryIdxs.map((idx, i) => ({
          image: mediaIds[idx],
          caption: `Gallery image ${i + 1} for ${spec.title}`,
        })),
      },
      readTime: spec.readTime,
      priority: spec.priority,
      category: spec.category,
      subcategory: spec.category === 'technology' ? 'Engineering' : undefined,
      status: spec.status,
      publishedDate: spec.publishedDate ?? undefined,
      author: spec.authorRef,
      featured: spec.featured,
      tags: spec.tags,
      scheduling: {
        scheduledPublish: spec.schedulePublish ?? undefined,
        scheduledUnpublish: spec.scheduleUnpublish ?? undefined,
      },
      _status: isPublished ? 'published' : 'draft',
    },
  })
  postIds.push(doc.id)
  if (isPublished) publishedPostIds.push(doc.id)
  logCount('posts', 1)
  console.log(`[seed] posts: created "${spec.slug}" [${spec.status}]`)
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. PAGES  (5 pages, exercising all block types)
// ═══════════════════════════════════════════════════════════════════════════

const PAGE_SPECS = [
  {
    title: 'Home',
    slug: 'home',
    status: 'published',
    metaDescription: 'Welcome to our site — discover posts, products, and events.',
    metaKeywords: ['home', 'welcome'],
    showInNav: true,
    navOrder: 1,
    layout: [
      {
        blockType: 'hero',
        heading: 'Welcome to Payload Universal',
        subheading: 'The best demo content for your admin review.',
        backgroundImage: mediaIds[0],
        overlayOpacity: 0.45,
      },
      {
        blockType: 'content',
        body: richText(
          'Payload Universal brings native mobile, desktop, and web admin together through a single Payload backend. Explore the collections and see every field type in action.',
        ),
      },
      {
        blockType: 'cta',
        label: 'Browse Posts',
        style: 'primary',
        linkType: 'external',
        externalUrl: '/admin/collections/posts',
        openInNewTab: false,
      },
      {
        blockType: 'mediaGallery',
        title: 'Featured Imagery',
        galleryLayout: 'grid',
        items: [
          { image: mediaIds[1], caption: 'Gallery item A' },
          { image: mediaIds[2], caption: 'Gallery item B' },
          { image: mediaIds[3], caption: 'Gallery item C' },
        ],
      },
    ],
  },
  {
    title: 'About',
    slug: 'about',
    status: 'published',
    metaDescription: 'Learn about the team behind this project.',
    metaKeywords: ['about', 'team'],
    showInNav: true,
    navOrder: 2,
    layout: [
      {
        blockType: 'hero',
        heading: 'About Us',
        subheading: 'We build universal admin experiences.',
        backgroundImage: mediaIds[5],
        overlayOpacity: 0.3,
      },
      {
        blockType: 'content',
        body: richTextFull(
          'Our Mission',
          ['Open-source first', 'Mobile and desktop parity', 'Real-time sync'],
          'We believe great content management should work everywhere — web, iOS, Android, and desktop.',
        ),
      },
    ],
  },
  {
    title: 'Developer Docs',
    slug: 'developer-docs',
    status: 'published',
    metaDescription: 'Technical documentation for Payload Universal integration.',
    metaKeywords: ['docs', 'api', 'sdk'],
    showInNav: true,
    navOrder: 3,
    layout: [
      {
        blockType: 'hero',
        heading: 'Developer Documentation',
        subheading: 'Everything you need to integrate with Payload Universal.',
        backgroundImage: mediaIds[4],
        overlayOpacity: 0.5,
      },
      {
        blockType: 'codeSnippet',
        language: 'typescript',
        snippet: `import { getPayload } from 'payload'\nimport config from '@payload-config'\n\nconst payload = await getPayload({ config })\nconst posts = await payload.find({ collection: 'posts' })\nconsole.log(posts.docs)`,
        showLineNumbers: true,
      },
      {
        blockType: 'content',
        body: richText(
          'The Local API lets you interact with Payload directly in Node.js without HTTP overhead. Perfect for scripts, crons, and server-side rendering.',
        ),
      },
      {
        blockType: 'cta',
        label: 'Read Full API Docs',
        style: 'ghost',
        linkType: 'external',
        externalUrl: 'https://payloadcms.com/docs',
        openInNewTab: true,
      },
    ],
  },
  {
    title: 'Política de Privacidad',
    slug: 'politica-privacidad',
    status: 'draft',
    metaDescription: 'Nuestra política de privacidad y cómo tratamos tus datos.',
    metaKeywords: ['privacidad', 'legal'],
    showInNav: false,
    navOrder: 10,
    layout: [
      {
        blockType: 'content',
        body: richText(
          'Esta política de privacidad describe cómo recopilamos y usamos tu información personal.',
        ),
      },
      {
        blockType: 'cta',
        label: 'Contáctanos',
        style: 'secondary',
        linkType: 'external',
        externalUrl: '/contacto',
        openInNewTab: false,
      },
    ],
  },
  {
    title: 'Gallery Showcase',
    slug: 'gallery-showcase',
    status: 'published',
    metaDescription: 'A visual showcase of our media gallery block.',
    metaKeywords: ['gallery', 'images'],
    showInNav: true,
    navOrder: 5,
    layout: [
      {
        blockType: 'hero',
        heading: 'Gallery Showcase',
        subheading: 'Every shade of the color spectrum.',
        backgroundImage: mediaIds[6],
        overlayOpacity: 0.25,
      },
      {
        blockType: 'mediaGallery',
        title: 'Full Palette',
        galleryLayout: 'masonry',
        items: mediaIds.slice(0, 6).map((id, i) => ({ image: id, caption: `Palette ${i + 1}` })),
      },
      {
        blockType: 'mediaGallery',
        title: 'Carousel View',
        galleryLayout: 'carousel',
        items: mediaIds.slice(2, 5).map((id, i) => ({ image: id, caption: `Slide ${i + 1}` })),
      },
    ],
  },
]

const pageIds = []

for (const spec of PAGE_SPECS) {
  const existing = await payload.find({
    collection: 'pages',
    where: { slug: { equals: spec.slug } },
    limit: 1,
  })
  if (existing.docs.length > 0) {
    console.log(`[seed] pages: skip "${spec.slug}" (exists)`)
    pageIds.push(existing.docs[0].id)
    continue
  }

  const isPublished = spec.status === 'published'

  const doc = await payload.create({
    collection: 'pages',
    draft: !isPublished,
    data: {
      title: spec.title,
      slug: spec.slug,
      layout: spec.layout,
      meta: {
        description: spec.metaDescription,
        keywords: spec.metaKeywords,
        image: mediaIds[0],
      },
      settings: {
        showInNav: spec.showInNav,
        navOrder: spec.navOrder,
      },
      _status: isPublished ? 'published' : 'draft',
    },
  })
  pageIds.push(doc.id)
  logCount('pages', 1)
  console.log(`[seed] pages: created "${spec.slug}" [${spec.status}]`)
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. PRODUCTS  (9 products, all lifecycleStages, kanban demo)
// ═══════════════════════════════════════════════════════════════════════════

const PRODUCT_SPECS = [
  {
    name: 'Wireless Noise-Cancelling Headphones',
    sku: 'PRD-HC-001',
    lifecycleStage: 'launched',
    availability: 'in-stock',
    price: 249.99, salePrice: 199.99, taxRate: 20, onSale: true,
    features: ['wireless', 'rechargeable'],
    availableSizes: [],
    searchKeywords: ['headphones', 'audio', 'wireless'],
    stockLevel: 500, restockThreshold: 50,
    relatedPostIdxs: [0], relatedPageIdxs: [1],
    featuredPostIdx: 0,
  },
  {
    name: 'Eco-Friendly Water Bottle (1L)',
    sku: 'PRD-WB-002',
    lifecycleStage: 'mature',
    availability: 'in-stock',
    price: 34.95, salePrice: null, taxRate: 20, onSale: false,
    features: ['eco-friendly', 'waterproof'],
    availableSizes: [],
    searchKeywords: ['bottle', 'sustainable', 'water'],
    stockLevel: 1200, restockThreshold: 200,
    relatedPostIdxs: [2], relatedPageIdxs: [],
    featuredPostIdx: 3,
  },
  {
    name: 'Smart Running Shoes v3',
    sku: 'PRD-SH-003',
    lifecycleStage: 'launched',
    availability: 'in-stock',
    price: 179.0, salePrice: 149.0, taxRate: 20, onSale: true,
    features: ['wireless', 'rechargeable'],
    availableSizes: [38, 39, 40, 41, 42, 43, 44, 45],
    searchKeywords: ['shoes', 'running', 'smart'],
    stockLevel: 320, restockThreshold: 30,
    relatedPostIdxs: [1], relatedPageIdxs: [2],
    featuredPostIdx: null,
  },
  {
    name: 'Portable Solar Charger 20W',
    sku: 'PRD-SC-004',
    lifecycleStage: 'development',
    availability: 'backorder',
    price: 89.0, salePrice: null, taxRate: 20, onSale: false,
    features: ['eco-friendly', 'rechargeable'],
    availableSizes: [],
    searchKeywords: ['solar', 'charger', 'sustainable'],
    stockLevel: 0, restockThreshold: 10,
    relatedPostIdxs: [0], relatedPageIdxs: [],
    featuredPostIdx: null,
  },
  {
    name: 'Mechanical Keyboard TKL',
    sku: 'PRD-KB-005',
    lifecycleStage: 'concept',
    availability: 'in-stock',
    price: 129.99, salePrice: null, taxRate: 20, onSale: false,
    features: ['wireless', 'rechargeable', 'limited-edition'],
    availableSizes: [],
    searchKeywords: ['keyboard', 'mechanical', 'tenkeyless'],
    stockLevel: 80, restockThreshold: 15,
    relatedPostIdxs: [0, 2], relatedPageIdxs: [],
    featuredPostIdx: null,
  },
  {
    name: 'Bamboo Yoga Mat',
    sku: 'PRD-YM-006',
    lifecycleStage: 'mature',
    availability: 'in-stock',
    price: 65.0, salePrice: 50.0, taxRate: 20, onSale: true,
    features: ['eco-friendly'],
    availableSizes: [],
    searchKeywords: ['yoga', 'mat', 'bamboo', 'eco'],
    stockLevel: 450, restockThreshold: 60,
    relatedPostIdxs: [3], relatedPageIdxs: [0],
    featuredPostIdx: 4,
  },
  {
    name: 'AR Developer Glasses (Beta)',
    sku: 'PRD-AR-007',
    lifecycleStage: 'development',
    availability: 'backorder',
    price: 1299.0, salePrice: null, taxRate: 20, onSale: false,
    features: ['wireless', 'rechargeable'],
    availableSizes: [],
    searchKeywords: ['ar', 'glasses', 'augmented', 'reality'],
    stockLevel: 0, restockThreshold: 5,
    relatedPostIdxs: [0, 1], relatedPageIdxs: [],
    featuredPostIdx: null,
  },
  {
    name: 'Vintage Denim Jacket (Limited)',
    sku: 'PRD-DJ-008',
    lifecycleStage: 'retired',
    availability: 'discontinued',
    price: 220.0, salePrice: null, taxRate: 20, onSale: false,
    features: ['limited-edition'],
    availableSizes: [36, 38, 40, 42, 44],
    searchKeywords: ['denim', 'jacket', 'vintage', 'limited'],
    stockLevel: 3, restockThreshold: 0,
    relatedPostIdxs: [4], relatedPageIdxs: [],
    featuredPostIdx: null,
  },
  {
    name: 'UltraBook Pro 14"',
    sku: 'PRD-LT-009',
    lifecycleStage: 'launched',
    availability: 'in-stock',
    price: 1499.0, salePrice: 1349.0, taxRate: 20, onSale: true,
    features: ['wireless', 'rechargeable'],
    availableSizes: [],
    searchKeywords: ['laptop', 'ultrabook', 'portable', 'computing'],
    stockLevel: 150, restockThreshold: 20,
    relatedPostIdxs: [0, 2], relatedPageIdxs: [2],
    featuredPostIdx: 0,
  },
]

const productIds = []

for (const spec of PRODUCT_SPECS) {
  const existing = await payload.find({
    collection: 'products',
    where: { sku: { equals: spec.sku } },
    limit: 1,
  })
  if (existing.docs.length > 0) {
    console.log(`[seed] products: skip "${spec.sku}" (exists)`)
    productIds.push(existing.docs[0].id)
    continue
  }

  // Build polymorphic relatedContent array
  const relatedContent = [
    ...spec.relatedPostIdxs
      .filter((idx) => postIds[idx] != null)
      .map((idx) => ({ relationTo: 'posts', value: postIds[idx] })),
    ...spec.relatedPageIdxs
      .filter((idx) => pageIds[idx] != null)
      .map((idx) => ({ relationTo: 'pages', value: pageIds[idx] })),
  ]

  const featuredPost =
    spec.featuredPostIdx != null && publishedPostIds[spec.featuredPostIdx] != null
      ? publishedPostIds[spec.featuredPostIdx]
      : undefined

  const doc = await payload.create({
    collection: 'products',
    data: {
      name: spec.name,
      sku: spec.sku,
      stockLevel: spec.stockLevel,
      restockThreshold: spec.restockThreshold,
      availability: spec.availability,
      lifecycleStage: spec.lifecycleStage,
      pricing: {
        price: spec.price,
        salePrice: spec.salePrice ?? undefined,
        taxRate: spec.taxRate,
        onSale: spec.onSale,
      },
      features: spec.features,
      availableSizes: spec.availableSizes.length > 0 ? spec.availableSizes : undefined,
      searchKeywords: spec.searchKeywords,
      integrationSnippet: `import { getPayload } from 'payload'\n// Fetch ${spec.name}\nconst payload = await getPayload({ config })\nconst product = await payload.findByID({ collection: 'products', id: '<id>' })`,
      specs: {
        weightGrams: 200 + Math.round(Math.random() * 1800),
        dimensions: {
          widthMm: 100 + Math.round(Math.random() * 200),
          heightMm: 50 + Math.round(Math.random() * 150),
          depthMm: 20 + Math.round(Math.random() * 80),
        },
        materials: ['aluminium', 'polycarbonate'].slice(0, 1 + Math.floor(Math.random() * 2)),
      },
      warehouseLocation: [
        -0.1278 + (Math.random() - 0.5) * 0.2,
        51.5074 + (Math.random() - 0.5) * 0.2,
      ],
      relatedContent: relatedContent.length > 0 ? relatedContent : undefined,
      featuredPost: featuredPost ?? undefined,
      releaseDate: daysAgo(30 + Math.floor(Math.random() * 300)),
    },
  })
  productIds.push(doc.id)
  logCount('products', 1)
  console.log(`[seed] products: created "${spec.sku}" — ${spec.name} [${spec.lifecycleStage}]`)
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. EVENTS  (11 events spread across current + next month)
// ═══════════════════════════════════════════════════════════════════════════

// Events use timezone: true on startsAt / endsAt — Payload stores a sibling
// field `<fieldName>_tz`.  Must be a value from Payload's timezone enum;
// Europe/London is the closest to UTC in the list.
const TZ = 'Europe/London'

const EVENT_SPECS = [
  {
    name: 'TypeScript Meetup — June Edition',
    eventType: 'meetup',
    startsAt: thisMonthDay(5, 18),
    endsAt: thisMonthDay(5, 20),
    registrationDeadline: thisMonthDay(3),
    doorsOpen: thisMonthDay(5, 17),
    requiresRegistration: true,
    registrationUrl: 'https://meetup.com/typescript-meetup',
    capacity: 80,
    contactEmail: 'ts-meetup@example.com',
    organizer: adminUser.id,
    sessions: [
      { title: 'TypeScript 5.x Features Deep Dive', speaker: 'Elena Editor', startTime: thisMonthDay(5, 18) },
      { title: 'Q&A and Networking', speaker: undefined, startTime: thisMonthDay(5, 19) },
    ],
  },
  {
    name: 'AI & Society Conference',
    eventType: 'conference',
    startsAt: thisMonthDay(8, 9),
    endsAt: thisMonthDay(10, 17),
    registrationDeadline: thisMonthDay(5),
    doorsOpen: thisMonthDay(8, 8),
    requiresRegistration: true,
    registrationUrl: 'https://conf.example.com/ai-society',
    capacity: 300,
    contactEmail: 'conference@example.com',
    organizer: adminUser.id,
    sessions: [
      { title: 'Opening Keynote: AI in 2026', speaker: 'Dr. Research Person', startTime: thisMonthDay(8, 9) },
      { title: 'Ethics Panel', speaker: 'Various', startTime: thisMonthDay(8, 14) },
      { title: 'Hands-on Workshop', speaker: 'Workshop Leads', startTime: thisMonthDay(9, 10) },
    ],
  },
  {
    name: 'Introduction to Web3 — Webinar',
    eventType: 'webinar',
    startsAt: thisMonthDay(12, 15),
    endsAt: thisMonthDay(12, 16),
    registrationDeadline: thisMonthDay(11),
    doorsOpen: undefined,
    requiresRegistration: true,
    registrationUrl: 'https://webinar.example.com/web3-intro',
    capacity: 500,
    contactEmail: 'webinars@example.com',
    organizer: editorUser.id,
    sessions: [
      { title: 'Web3 Fundamentals', speaker: 'Token Expert', startTime: thisMonthDay(12, 15) },
    ],
  },
  {
    name: 'Design Systems Workshop',
    eventType: 'workshop',
    startsAt: thisMonthDay(15, 10),
    endsAt: thisMonthDay(15, 13),
    registrationDeadline: thisMonthDay(12),
    doorsOpen: thisMonthDay(15, 9),
    requiresRegistration: true,
    registrationUrl: 'https://workshop.example.com/design-systems',
    capacity: 25,
    contactEmail: 'workshops@example.com',
    organizer: editorUser.id,
    sessions: [
      { title: 'Figma to Code Pipeline', speaker: 'Design Lead', startTime: thisMonthDay(15, 10) },
      { title: 'Component API Design', speaker: 'Dev Lead', startTime: thisMonthDay(15, 11) },
    ],
  },
  {
    name: 'Open Source Contributor Day',
    eventType: 'meetup',
    startsAt: thisMonthDay(18, 10),
    endsAt: thisMonthDay(18, 17),
    registrationDeadline: thisMonthDay(15),
    doorsOpen: thisMonthDay(18, 9),
    requiresRegistration: false,
    contactEmail: 'oss@example.com',
    organizer: adminUser.id,
    sessions: [],
  },
  {
    name: 'React Native Summit',
    eventType: 'conference',
    startsAt: thisMonthDay(22, 9),
    endsAt: thisMonthDay(23, 18),
    registrationDeadline: thisMonthDay(18),
    doorsOpen: thisMonthDay(22, 8),
    requiresRegistration: true,
    registrationUrl: 'https://rn-summit.example.com',
    capacity: 200,
    contactEmail: 'summit@example.com',
    organizer: adminUser.id,
    sessions: [
      { title: 'New Architecture Deep Dive', speaker: 'Core Team Member', startTime: thisMonthDay(22, 9) },
      { title: 'Expo SDK 54 Preview', speaker: 'Expo Engineer', startTime: thisMonthDay(22, 14) },
    ],
  },
  {
    name: 'Midnight Hackathon (All-Day)',
    eventType: 'workshop',
    startsAt: allDay(25),
    endsAt: allDay(26),
    registrationDeadline: thisMonthDay(20),
    doorsOpen: undefined,
    requiresRegistration: true,
    registrationUrl: 'https://hack.example.com',
    capacity: 60,
    contactEmail: 'hack@example.com',
    organizer: editorUser.id,
    sessions: [
      { title: 'Kick-off & Team Formation', speaker: undefined, startTime: allDay(25) },
      { title: 'Final Demos', speaker: undefined, startTime: allDay(26) },
    ],
  },
  {
    name: 'Next-Gen Database Webinar',
    eventType: 'webinar',
    startsAt: nextMonthDay(3, 16),
    endsAt: nextMonthDay(3, 17),
    registrationDeadline: nextMonthDay(1),
    doorsOpen: undefined,
    requiresRegistration: true,
    registrationUrl: 'https://db-webinar.example.com',
    capacity: 300,
    contactEmail: 'db-webinar@example.com',
    organizer: adminUser.id,
    sessions: [
      { title: 'MongoDB vs Postgres for CMS workloads', speaker: 'DBA', startTime: nextMonthDay(3, 16) },
    ],
  },
  {
    name: 'Mobile UX Best Practices Workshop',
    eventType: 'workshop',
    startsAt: nextMonthDay(7, 10),
    endsAt: nextMonthDay(7, 12),
    registrationDeadline: nextMonthDay(4),
    doorsOpen: nextMonthDay(7, 9),
    requiresRegistration: true,
    registrationUrl: 'https://ux-workshop.example.com',
    capacity: 30,
    contactEmail: 'ux@example.com',
    organizer: editorUser.id,
    sessions: [
      { title: 'Gesture Navigation Patterns', speaker: 'UX Lead', startTime: nextMonthDay(7, 10) },
      { title: 'Accessibility in Mobile Apps', speaker: 'A11y Expert', startTime: nextMonthDay(7, 11) },
    ],
  },
  {
    name: 'Cloud Architecture Meetup',
    eventType: 'meetup',
    startsAt: nextMonthDay(14, 19),
    endsAt: nextMonthDay(14, 21),
    registrationDeadline: nextMonthDay(11),
    doorsOpen: nextMonthDay(14, 18),
    requiresRegistration: false,
    contactEmail: 'cloud@example.com',
    organizer: adminUser.id,
    sessions: [
      { title: 'Serverless at Scale', speaker: 'Cloud Architect', startTime: nextMonthDay(14, 19) },
    ],
  },
  {
    name: 'Developer Experience Summit (Multi-Day)',
    eventType: 'conference',
    startsAt: nextMonthDay(20, 9),
    endsAt: nextMonthDay(22, 17),
    registrationDeadline: nextMonthDay(15),
    doorsOpen: nextMonthDay(20, 8),
    requiresRegistration: true,
    registrationUrl: 'https://dx-summit.example.com',
    capacity: 400,
    contactEmail: 'dx@example.com',
    organizer: adminUser.id,
    sessions: [
      { title: 'State of Developer Tooling 2026', speaker: 'Keynote Speaker', startTime: nextMonthDay(20, 9) },
      { title: 'AI-Assisted Development', speaker: 'AI Panel', startTime: nextMonthDay(20, 14) },
      { title: 'CLI Design Patterns', speaker: 'CLI Expert', startTime: nextMonthDay(21, 10) },
    ],
  },
]

for (const spec of EVENT_SPECS) {
  const existing = await payload.find({
    collection: 'events',
    where: { name: { equals: spec.name } },
    limit: 1,
  })
  if (existing.docs.length > 0) {
    console.log(`[seed] events: skip "${spec.name}" (exists)`)
    continue
  }

  await payload.create({
    collection: 'events',
    data: {
      name: spec.name,
      eventType: spec.eventType,
      // Timezone-aware date fields require a sibling `<field>_tz` key
      startsAt: spec.startsAt,
      startsAt_tz: TZ,
      endsAt: spec.endsAt ?? undefined,
      endsAt_tz: spec.endsAt ? TZ : undefined,
      registrationDeadline: spec.registrationDeadline,
      doorsOpen: spec.doorsOpen ?? undefined,
      programMonth: spec.startsAt,
      requiresRegistration: spec.requiresRegistration,
      registrationUrl: spec.requiresRegistration ? spec.registrationUrl : undefined,
      capacity: spec.requiresRegistration ? spec.capacity : undefined,
      contactEmail: spec.contactEmail,
      organizer: spec.organizer,
      sessions: spec.sessions.map((s) => ({
        title: s.title,
        speaker: s.speaker ?? undefined,
        startTime: s.startTime,
      })),
    },
  })
  logCount('events', 1)
  console.log(`[seed] events: created "${spec.name}" [${spec.eventType}]`)
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. GLOBALS
// ═══════════════════════════════════════════════════════════════════════════

// SiteSettings — en
await payload.updateGlobal({
  slug: 'site-settings',
  locale: 'en',
  data: {
    siteName: 'Payload Universal Demo',
    tagline: 'The universal admin — web, mobile, and desktop in perfect sync.',
    maintenanceMode: false,
    accentColor: '#7C5CFF',
    social: {
      twitter: 'https://x.com/payloadcms',
      instagram: 'https://instagram.com/payloadcms',
      github: 'https://github.com/payloadcms/payload',
    },
  },
})

// SiteSettings — es
await payload.updateGlobal({
  slug: 'site-settings',
  locale: 'es',
  data: {
    siteName: 'Demo de Payload Universal',
    tagline: 'El administrador universal — web, móvil y escritorio en perfecta sincronía.',
    maintenanceMode: false,
  },
})
console.log('[seed] globals: site-settings updated (en + es)')
logCount('globals', 1)

// Footer — en
await payload.updateGlobal({
  slug: 'footer',
  locale: 'en',
  data: {
    copyrightText: `© ${new Date().getFullYear()} Payload Universal Demo`,
    links: [
      { label: 'Home', url: '/', newTab: false },
      { label: 'About', url: '/about', newTab: false },
      { label: 'Developer Docs', url: '/developer-docs', newTab: false },
      { label: 'Privacy Policy', url: '/politica-privacidad', newTab: false },
      { label: 'GitHub', url: 'https://github.com/payloadcms/payload', newTab: true },
    ],
  },
})

// Footer — es
await payload.updateGlobal({
  slug: 'footer',
  locale: 'es',
  data: {
    copyrightText: `© ${new Date().getFullYear()} Demo de Payload Universal`,
    links: [
      { label: 'Inicio', url: '/', newTab: false },
      { label: 'Acerca de', url: '/about', newTab: false },
      { label: 'Documentación', url: '/developer-docs', newTab: false },
      { label: 'Política de Privacidad', url: '/politica-privacidad', newTab: false },
      { label: 'GitHub', url: 'https://github.com/payloadcms/payload', newTab: true },
    ],
  },
})
console.log('[seed] globals: footer updated (en + es)')
logCount('globals', 1)

// ═══════════════════════════════════════════════════════════════════════════
// 8. VIEW PRESETS
// ═══════════════════════════════════════════════════════════════════════════

async function ensureViewPreset(title, data) {
  const existing = await payload.find({
    collection: 'view-presets',
    where: { title: { equals: title } },
    limit: 1,
  })
  if (existing.docs.length > 0) {
    console.log(`[seed] view-presets: skip "${title}" (exists)`)
    return
  }
  await payload.create({
    collection: 'view-presets',
    overrideAccess: true,
    data: {
      title,
      owner: adminUser.id,
      ...data,
    },
  })
  logCount('view-presets', 1)
  console.log(`[seed] view-presets: created "${title}"`)
}

await ensureViewPreset('Posts Status Board', {
  relatedCollection: 'posts',
  viewType: 'kanban',
  statusField: 'status',
  columnOrder: ['draft', 'review', 'published', 'archived'],
  columnColors: {
    draft: '#F59E0B',
    review: '#3B82F6',
    published: '#22C55E',
    archived: '#9CA3AF',
  },
  cardFields: ['title', 'author', 'publishedDate', 'category'],
  accessMode: 'everyone',
})

await ensureViewPreset('Products Lifecycle Board', {
  relatedCollection: 'products',
  viewType: 'kanban',
  statusField: 'lifecycleStage',
  columnOrder: ['concept', 'development', 'launched', 'mature', 'retired'],
  columnColors: {
    concept: '#8B5CF6',
    development: '#F59E0B',
    launched: '#22C55E',
    mature: '#3B82F6',
    retired: '#9CA3AF',
  },
  cardFields: ['name', 'sku', 'availability', 'pricing.price'],
  accessMode: 'everyone',
})

await ensureViewPreset('Events Calendar', {
  relatedCollection: 'events',
  viewType: 'calendar',
  calendarSources: [
    { id: 'main', label: 'Event', startField: 'startsAt', endField: 'endsAt', color: '#3B82F6' },
    { id: 'deadline', label: 'Registration Deadline', startField: 'registrationDeadline', color: '#EF4444' },
  ],
  calendarDefaultMode: 'month',
  cardFields: ['name', 'eventType', 'contactEmail'],
  accessMode: 'everyone',
})

// ═══════════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════════

console.log('\n[seed] ─────────────────────────────────────────')
console.log('[seed] Seed complete. Documents created this run:')
if (Object.keys(counts).length === 0) {
  console.log('[seed]   (all documents already existed — nothing new created)')
} else {
  for (const [col, n] of Object.entries(counts)) {
    console.log(`[seed]   ${col}: +${n}`)
  }
}
console.log('[seed] ─────────────────────────────────────────\n')

process.exit(0)
