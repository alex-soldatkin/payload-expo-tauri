import type { GlobalConfig } from 'payload'

/**
 * Footer — global with an array of link rows and a custom RowLabel
 * component.
 */
export const Footer: GlobalConfig = {
  slug: 'footer',
  admin: {
    group: 'Settings',
    // @ts-expect-error — payload-universal icon extension
    icon: 'panel-bottom',
  },
  fields: [
    {
      name: 'copyrightText',
      type: 'text',
      localized: true,
      admin: {
        placeholder: '© 2026 Acme Inc.',
      },
    },
    {
      name: 'links',
      type: 'array',
      labels: { singular: 'Link', plural: 'Links' },
      admin: {
        description: 'Rendered left-to-right in the site footer',
        components: {
          RowLabel: { path: './components/FooterLinkRowLabel' },
        },
      },
      fields: [
        {
          name: 'label',
          type: 'text',
          required: true,
          localized: true,
        },
        {
          name: 'url',
          type: 'text',
          required: true,
          admin: {
            placeholder: 'https://example.com or /about',
          },
        },
        {
          name: 'newTab',
          type: 'checkbox',
          defaultValue: false,
        },
      ],
    },
  ],
}
