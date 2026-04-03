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

    // Join — shows all posts authored by this user as a scrollable table
    {
      name: 'posts',
      type: 'join',
      collection: 'posts',
      on: 'author',
      admin: {
        defaultColumns: ['title', 'status', 'publishedDate'],
      },
      defaultLimit: 10,
      defaultSort: '-createdAt',
    },
  ],
}
