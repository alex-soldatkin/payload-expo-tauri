import type { GlobalConfig } from 'payload'

/**
 * SiteSettings — first global in the project. Exercises tabs inside a
 * global, localized fields, uploads, condition-dependent fields, and
 * a named group of social links.
 */
export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: 'Site Settings',
  admin: {
    group: 'Settings',
    // @ts-expect-error — payload-universal icon extension
    icon: 'settings',
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'General',
          fields: [
            {
              name: 'siteName',
              type: 'text',
              required: true,
              localized: true,
              admin: {
                description: 'Shown in the browser tab and app header',
              },
            },
            {
              name: 'tagline',
              type: 'textarea',
              localized: true,
            },
            {
              name: 'maintenanceMode',
              type: 'checkbox',
              defaultValue: false,
              admin: {
                description: 'Take the public site offline',
              },
            },
            {
              // Only shown while maintenance mode is on
              name: 'maintenanceMessage',
              type: 'textarea',
              localized: true,
              admin: {
                condition: (data) => Boolean(data?.maintenanceMode),
                placeholder: 'We will be back shortly…',
              },
            },
          ],
        },
        {
          label: 'Branding',
          fields: [
            {
              name: 'logo',
              type: 'upload',
              relationTo: 'media',
              admin: {
                description: 'Displayed in the navigation bar',
              },
            },
            {
              name: 'accentColor',
              type: 'text',
              admin: {
                placeholder: '#7C5CFF',
                description: 'Hex color used for primary actions',
              },
            },
          ],
        },
        {
          label: 'Social',
          fields: [
            {
              name: 'social',
              type: 'group',
              admin: {
                description: 'Full profile URLs, including https://',
              },
              fields: [
                {
                  name: 'twitter',
                  type: 'text',
                  admin: {
                    placeholder: 'https://x.com/…',
                  },
                },
                {
                  name: 'instagram',
                  type: 'text',
                  admin: {
                    placeholder: 'https://instagram.com/…',
                  },
                },
                {
                  name: 'github',
                  type: 'text',
                  admin: {
                    placeholder: 'https://github.com/…',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}
