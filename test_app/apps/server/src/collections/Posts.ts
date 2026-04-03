import type { CollectionConfig } from 'payload'

export const Posts: CollectionConfig = {
  slug: 'posts',
  admin: {
    useAsTitle: 'title',
    group: 'Content',
    // @ts-expect-error — payload-universal icon extension
    icon: 'file-text',
  },
  versions: {
    drafts: true,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      admin: {
        description: 'URL-friendly identifier for this post',
        components: {
          Field: { path: './components/SlugField' }
        }
      },
    },
    {
      name: 'summary',
      type: 'richText',
      admin: {
        description: 'A brief rich-text summary shown on the post card and in previews.',
      },
    },
    {
      // Tabs — maps to segmented control on mobile
      type: 'tabs',
      tabs: [
        {
          label: 'Content',
          fields: [
            // Row — different width ratio (60/40)
            {
              type: 'row',
              fields: [
                {
                  name: 'contentFormat',
                  type: 'radio',
                  options: ['article', 'tutorial', 'review'],
                  admin: {
                    width: '60%',
                  },
                },
                {
                  name: 'language',
                  type: 'select',
                  defaultValue: 'en',
                  options: [
                    { label: 'English', value: 'en' },
                    { label: 'Spanish', value: 'es' },
                    { label: 'French', value: 'fr' },
                  ],
                  admin: {
                    width: '40%',
                  },
                },
              ],
            },
            {
              name: 'excerpt',
              type: 'textarea',
              admin: {
                description: 'Short summary displayed in previews',
                components: {
                  afterInput: [{ path: './components/ContentMetrics' }],
                },
              },
            },
            {
              name: 'content',
              type: 'richText',
            },
          ],
        },
        {
          label: 'Media',
          fields: [
            {
              name: 'heroImage',
              type: 'upload',
              relationTo: 'media',
            },
            {
              // Group — maps to a card section on mobile
              name: 'gallery',
              type: 'group',
              admin: {
                description: 'Additional images for the post',
              },
              fields: [
                {
                  name: 'images',
                  type: 'array',
                  labels: { singular: 'Image', plural: 'Images' },
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
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'SEO',
          fields: [
            {
              // Collapsible — maps to animated accordion on mobile
              type: 'collapsible',
              label: 'Meta Tags',
              admin: {
                initCollapsed: true,
              },
              fields: [
                {
                  name: 'metaTitle',
                  type: 'text',
                  admin: {
                    description: 'Overrides the page title for search engines',
                    components: {
                      Field: { path: './components/SEOPreview' },
                    },
                  },
                },
                {
                  name: 'metaDescription',
                  type: 'textarea',
                  admin: {
                    description: 'Displayed in search engine results',
                  },
                },
                {
                  name: 'metaKeywords',
                  type: 'text',
                  admin: {
                    description: 'Comma-separated keywords',
                  },
                },
                // Row inside a collapsible — demonstrates nested width layout
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'canonicalUrl',
                      type: 'text',
                      admin: {
                        width: '70%',
                        description: 'Canonical URL override',
                      },
                    },
                    {
                      name: 'noIndex',
                      type: 'checkbox',
                      admin: {
                        width: '30%',
                        description: 'Hide from search',
                      },
                    },
                  ],
                },
              ],
            },
            {
              // Collapsible — starts expanded
              type: 'collapsible',
              label: 'Open Graph',
              fields: [
                {
                  name: 'ogTitle',
                  type: 'text',
                },
                {
                  name: 'ogDescription',
                  type: 'textarea',
                },
                {
                  name: 'ogImage',
                  type: 'upload',
                  relationTo: 'media',
                },
              ],
            },
          ],
        },
      ],
    },
    // Row — horizontal layout
    {
      type: 'row',
      fields: [
        {
          name: 'readTime',
          type: 'number',
          admin: {
            width: '50%',
            description: 'Estimated minutes',
            components: {
              afterInput: [{ path: './components/ReadTimeChart' }],
            },
          },
        },
        {
          name: 'priority',
          type: 'number',
          min: 1,
          max: 10,
          admin: {
            width: '50%',
          },
        },
      ],
    },

    // Standalone fields with admin.width — consecutive width fields are
    // automatically grouped into a flex row on native (via groupFieldsByWidth)
    {
      name: 'category',
      type: 'select',
      options: [
        { label: 'Technology', value: 'technology' },
        { label: 'Science', value: 'science' },
        { label: 'Culture', value: 'culture' },
        { label: 'Travel', value: 'travel' },
      ],
      admin: {
        width: '50%',
      },
    },
    {
      name: 'subcategory',
      type: 'text',
      admin: {
        width: '50%',
        description: 'Further classification',
      },
    },

    // ---- Sidebar fields ----
    // These map to a "Details" section at the bottom on mobile

    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
        { label: 'Archived', value: 'archived' },
      ],
      admin: {
        position: 'sidebar',
        components: {
          afterInput: [{ path: './components/StatusDashboard' }],
        },
      },
    },
    {
      name: 'publishedDate',
      type: 'date',
      admin: {
        position: 'sidebar',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'featured',
      type: 'checkbox',
      admin: {
        position: 'sidebar',
        description: 'Show on the homepage',
      },
    },
    {
      name: 'tags',
      type: 'text',
      hasMany: true,
      admin: {
        position: 'sidebar',
        description: 'Comma-separated tags',
      },
    },

    // Group inside sidebar
    {
      name: 'scheduling',
      type: 'group',
      admin: {
        position: 'sidebar',
      },
      fields: [
        {
          name: 'scheduledPublish',
          type: 'date',
        },
        {
          name: 'scheduledUnpublish',
          type: 'date',
        },
      ],
    },
  ],
}
