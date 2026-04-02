import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    // @ts-expect-error — payload-universal icon extension
    icon: 'users',
  },
  auth: true,
  fields: [
    // Email added by default
    // Add more fields as needed
  ],
}
