import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    // @ts-expect-error — payload-universal icon extension
    icon: 'users',
  },
  auth: {
    useAPIKey: true,
    maxLoginAttempts: 5,
    lockTime: 10 * 60 * 1000, // 10 minutes
  },
  fields: [
    // Email added by default

    {
      name: 'name',
      type: 'text',
      admin: {
        placeholder: 'Jane Doe',
      },
    },
    {
      name: 'role',
      type: 'select',
      defaultValue: 'editor',
      saveToJWT: true,
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Editor', value: 'editor' },
        { label: 'Viewer', value: 'viewer' },
      ],
      admin: {
        description: 'Stored in the JWT for client-side access checks',
      },
    },
    {
      name: 'avatar',
      type: 'upload',
      relationTo: 'media',
    },

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
