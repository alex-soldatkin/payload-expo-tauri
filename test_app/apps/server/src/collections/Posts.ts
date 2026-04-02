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
      },
    },
    {
      // Tabs — maps to segmented control on mobile
      type: 'tabs',
      tabs: [
        {
          label: 'Content',
          fields: [
            {
              name: 'excerpt',
              type: 'textarea',
              admin: {
                description: 'Short summary displayed in previews',
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
