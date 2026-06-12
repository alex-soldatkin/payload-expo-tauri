import type { Block, CollectionConfig } from 'payload'

/**
 * Pages — exercises the blocks field, NAMED (data-holding) tabs alongside
 * unnamed tabs, localized fields, and autosave drafts.
 */

const HeroBlock: Block = {
  slug: 'hero',
  labels: { singular: 'Hero', plural: 'Heroes' },
  fields: [
    {
      name: 'heading',
      type: 'text',
      required: true,
      localized: true,
      admin: {
        description: 'Main headline rendered over the background image',
      },
    },
    {
      name: 'subheading',
      type: 'textarea',
      localized: true,
    },
    {
      name: 'backgroundImage',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Full-bleed background — use a wide image',
      },
    },
    {
      name: 'overlayOpacity',
      type: 'number',
      min: 0,
      max: 1,
      defaultValue: 0.4,
      admin: {
        step: 0.1,
        description: 'Darkening overlay strength (0–1)',
      },
    },
  ],
}

const ContentBlock: Block = {
  slug: 'content',
  labels: { singular: 'Content', plural: 'Content Blocks' },
  fields: [
    {
      name: 'body',
      type: 'richText',
      admin: {
        description: 'Rich-text body for this section',
      },
    },
  ],
}

const CallToActionBlock: Block = {
  slug: 'cta',
  labels: { singular: 'Call to Action', plural: 'Calls to Action' },
  fields: [
    {
      name: 'label',
      type: 'text',
      required: true,
      localized: true,
      admin: {
        description: 'Button text',
      },
    },
    {
      name: 'style',
      type: 'select',
      defaultValue: 'primary',
      options: [
        { label: 'Primary', value: 'primary' },
        { label: 'Secondary', value: 'secondary' },
        { label: 'Ghost', value: 'ghost' },
      ],
    },
    {
      name: 'linkType',
      type: 'radio',
      defaultValue: 'internal',
      options: [
        { label: 'Internal Page', value: 'internal' },
        { label: 'External URL', value: 'external' },
      ],
      admin: {
        layout: 'horizontal',
      },
    },
    {
      // Only shown when linkType === 'internal'
      name: 'internalPage',
      type: 'relationship',
      relationTo: 'pages',
      admin: {
        condition: (_data, siblingData) => siblingData?.linkType === 'internal',
        description: 'Destination page',
      },
    },
    {
      // Only shown when linkType === 'external'
      name: 'externalUrl',
      type: 'text',
      admin: {
        condition: (_data, siblingData) => siblingData?.linkType === 'external',
        placeholder: 'https://example.com',
      },
    },
    {
      name: 'openInNewTab',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        condition: (_data, siblingData) => siblingData?.linkType === 'external',
      },
    },
  ],
}

const CodeSnippetBlock: Block = {
  slug: 'codeSnippet',
  labels: { singular: 'Code Snippet', plural: 'Code Snippets' },
  fields: [
    {
      name: 'language',
      type: 'select',
      defaultValue: 'typescript',
      options: [
        { label: 'TypeScript', value: 'typescript' },
        { label: 'JavaScript', value: 'javascript' },
        { label: 'JSON', value: 'json' },
        { label: 'CSS', value: 'css' },
        { label: 'HTML', value: 'html' },
        { label: 'Bash', value: 'bash' },
      ],
    },
    {
      name: 'snippet',
      type: 'code',
      required: true,
      admin: {
        language: 'typescript',
        description: 'Code rendered with syntax highlighting',
      },
    },
    {
      name: 'showLineNumbers',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
}

const MediaGalleryBlock: Block = {
  slug: 'mediaGallery',
  labels: { singular: 'Media Gallery', plural: 'Media Galleries' },
  fields: [
    {
      name: 'title',
      type: 'text',
      localized: true,
      admin: {
        description: 'Optional heading shown above the gallery',
      },
    },
    {
      name: 'galleryLayout',
      type: 'radio',
      defaultValue: 'grid',
      options: [
        { label: 'Grid', value: 'grid' },
        { label: 'Carousel', value: 'carousel' },
        { label: 'Masonry', value: 'masonry' },
      ],
      admin: {
        layout: 'horizontal',
      },
    },
    {
      name: 'items',
      type: 'array',
      labels: { singular: 'Gallery Item', plural: 'Gallery Items' },
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
        {
          name: 'caption',
          type: 'text',
          localized: true,
        },
      ],
    },
  ],
}

export const Pages: CollectionConfig = {
  slug: 'pages',
  enableQueryPresets: true,
  admin: {
    useAsTitle: 'title',
    group: 'Content',
    defaultColumns: ['title', 'slug', '_status', 'updatedAt'],
    // @ts-expect-error — payload-universal icon extension
    icon: 'layout-template',
  },
  versions: {
    drafts: {
      autosave: {
        interval: 1500,
      },
    },
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      localized: true,
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      admin: {
        description: 'URL-friendly identifier for this page',
      },
    },
    {
      type: 'tabs',
      tabs: [
        {
          // Unnamed tab — fields stay at the document root
          label: 'Layout',
          fields: [
            {
              name: 'layout',
              type: 'blocks',
              labels: { singular: 'Section', plural: 'Sections' },
              admin: {
                description: 'Compose the page from reusable section blocks',
              },
              blocks: [
                HeroBlock,
                ContentBlock,
                CallToActionBlock,
                CodeSnippetBlock,
                MediaGalleryBlock,
              ],
            },
          ],
        },
        {
          // NAMED tab — data nests under `meta` in the document
          name: 'meta',
          label: 'Meta',
          admin: {
            description: 'SEO metadata stored under the named "meta" key',
          },
          fields: [
            {
              name: 'description',
              type: 'textarea',
              localized: true,
              admin: {
                description: 'Search engine description',
              },
            },
            {
              name: 'keywords',
              type: 'text',
              hasMany: true,
              admin: {
                description: 'SEO keywords',
              },
            },
            {
              name: 'image',
              type: 'upload',
              relationTo: 'media',
            },
          ],
        },
        {
          // NAMED tab — data nests under `settings`
          name: 'settings',
          label: 'Settings',
          fields: [
            {
              name: 'showInNav',
              type: 'checkbox',
              defaultValue: true,
            },
            {
              // Only shown when showInNav is checked
              name: 'navOrder',
              type: 'number',
              min: 0,
              admin: {
                condition: (_data, siblingData) => Boolean(siblingData?.showInNav),
                description: 'Lower numbers appear first',
              },
            },
          ],
        },
      ],
    },
  ],
}
