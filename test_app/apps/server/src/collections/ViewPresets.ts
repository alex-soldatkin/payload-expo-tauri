import type { Access, CollectionConfig } from 'payload'

/**
 * ViewPresets — shareable, per-user saved views (kanban boards / table views /
 * calendars) for any collection, modeled on Payload's native Query Presets
 * (`payload-query-presets`, see payload/src/query-presets/*).
 *
 * Why a separate collection instead of `payload-query-presets`?
 *   1. The mobile local-first sync (LocalDBProvider) skips slugs starting
 *      with 'payload-', so native query presets never reach RxDB. This slug
 *      ('view-presets') IS synced, making boards available offline.
 *   2. Native query presets only model list-view state (where/columns/groupBy).
 *      View presets add kanban-specific state: the select field driving the
 *      columns, column order, column colors, and the fields shown on cards.
 *
 * Access model (simplified from Payload's per-operation constraints):
 *   - read:   owner, OR accessMode 'everyone', OR ('specificUsers' AND the
 *             user is in sharedWith) — mirrors payload-query-presets'
 *             onlyMe/specificUsers/everyone read semantics.
 *   - update/delete: owner only. (Payload's native presets allow a
 *             constraint per operation; we deliberately keep mutation
 *             owner-scoped for simplicity.)
 *   - create: any authenticated user; `owner` is forced to req.user.id.
 */
export const ViewPresets: CollectionConfig = {
  slug: 'view-presets',
  admin: {
    useAsTitle: 'title',
    group: 'System',
    defaultColumns: ['title', 'relatedCollection', 'viewType', 'accessMode', 'owner'],
    // @ts-expect-error — payload-universal icon extension
    icon: 'kanban',
  },
  access: {
    create: ({ req: { user } }) => Boolean(user),
    read: (({ req: { user } }) => {
      if (!user) return false
      return {
        or: [
          { owner: { equals: user.id } },
          { accessMode: { equals: 'everyone' } },
          {
            and: [
              { accessMode: { equals: 'specificUsers' } },
              { sharedWith: { in: [user.id] } },
            ],
          },
        ],
      }
    }) as Access,
    update: (({ req: { user } }) => {
      if (!user) return false
      return { owner: { equals: user.id } }
    }) as Access,
    delete: (({ req: { user } }) => {
      if (!user) return false
      return { owner: { equals: user.id } }
    }) as Access,
  },
  hooks: {
    beforeChange: [
      ({ data, operation, originalDoc, req }) => {
        if (operation === 'create' && req.user) {
          data.owner = req.user.id
        }
        // Owner is immutable after create — mirrors query presets where the
        // creator is always retained in the constraint users list.
        if (operation === 'update' && originalDoc?.owner) {
          data.owner =
            typeof originalDoc.owner === 'object' ? originalDoc.owner.id : originalDoc.owner
        }
        // Prevent lockout: the owner is always part of sharedWith when
        // sharing with specific users (same as payload-query-presets'
        // beforeChange on access[op].users).
        if (data?.accessMode === 'specificUsers' && req.user) {
          const shared: Array<number | string> = (data.sharedWith ?? []).map(
            (u: { id: number | string } | number | string) =>
              typeof u === 'object' ? u.id : u,
          )
          const ownerId =
            operation === 'create' || !originalDoc?.owner
              ? req.user.id
              : typeof originalDoc.owner === 'object'
                ? originalDoc.owner.id
                : originalDoc.owner
          if (!shared.includes(ownerId)) {
            data.sharedWith = [...shared, ownerId]
          }
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      // Slug of the collection this preset belongs to (e.g. 'posts').
      // Text (not select) so new collections don't require a config change —
      // unlike payload-query-presets which builds select options from
      // collections with enableQueryPresets.
      name: 'relatedCollection',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Slug of the collection this view applies to (e.g. "posts")',
      },
    },
    {
      name: 'viewType',
      type: 'select',
      defaultValue: 'kanban',
      options: [
        { label: 'Table', value: 'table' },
        { label: 'Kanban', value: 'kanban' },
        { label: 'Calendar', value: 'calendar' },
      ],
    },
    {
      // Name of the select/radio field whose options become kanban columns
      // (e.g. 'status' on posts, 'lifecycleStage' on products).
      name: 'statusField',
      type: 'text',
      admin: {
        description: 'Select field whose options drive the kanban columns',
        condition: (data) => data?.viewType !== 'table',
      },
    },
    {
      // JSON array of option values in display order,
      // e.g. ["draft", "review", "published", "archived"]
      name: 'columnOrder',
      type: 'json',
      admin: {
        description: 'Array of option values in display order',
      },
    },
    {
      // JSON map of option value -> hex color,
      // e.g. { "draft": "#F59E0B", "published": "#22C55E" }
      name: 'columnColors',
      type: 'json',
      admin: {
        description: 'Map of option value to hex color',
      },
    },
    {
      // JSON array of field names rendered on each card,
      // e.g. ["title", "author", "publishedDate"]
      name: 'cardFields',
      type: 'json',
      admin: {
        description: 'Array of field names shown on cards',
      },
    },
    {
      // JSON array of date sources plotted on the calendar, e.g.
      // [
      //   { "id": "main", "label": "Event", "startField": "startsAt",
      //     "endField": "endsAt", "color": "#3B82F6" },
      //   { "id": "deadline", "label": "Registration deadline",
      //     "startField": "registrationDeadline", "color": "#EF4444" }
      // ]
      // Each entry: { id: string; label: string; startField: string;
      //               endField?: string; color: string }.
      // startField/endField are dot-paths to date fields on the related
      // collection; omitting endField makes it a point event.
      name: 'calendarSources',
      type: 'json',
      admin: {
        description:
          'Array of { id, label, startField, endField?, color } date sources shown on the calendar',
        condition: (data) => data?.viewType === 'calendar',
      },
    },
    {
      name: 'calendarDefaultMode',
      type: 'select',
      defaultValue: 'month',
      options: [
        { label: 'Month', value: 'month' },
        { label: 'Week', value: 'week' },
        { label: 'Day', value: 'day' },
      ],
      admin: {
        description: 'Calendar mode the view opens in',
        condition: (data) => data?.viewType === 'calendar',
      },
    },
    {
      // Optional board-level Payload `Where` filter applied before grouping.
      name: 'where',
      type: 'json',
      label: 'Filters',
      admin: {
        description: 'Optional Payload where-query applied to the whole board',
      },
    },
    {
      name: 'owner',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      defaultValue: ({ user }: { user?: { id: number | string } }) => user?.id,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Set automatically to the user who created the preset',
      },
    },
    {
      name: 'accessMode',
      type: 'select',
      defaultValue: 'onlyMe',
      required: true,
      options: [
        { label: 'Only Me', value: 'onlyMe' },
        { label: 'Specific Users', value: 'specificUsers' },
        { label: 'Everyone', value: 'everyone' },
      ],
      admin: {
        position: 'sidebar',
        description: 'Who can see this view',
      },
    },
    {
      name: 'sharedWith',
      type: 'relationship',
      relationTo: 'users',
      hasMany: true,
      admin: {
        position: 'sidebar',
        condition: (data) => data?.accessMode === 'specificUsers',
        description: 'Users this view is shared with (owner is always included)',
      },
    },
  ],
}
