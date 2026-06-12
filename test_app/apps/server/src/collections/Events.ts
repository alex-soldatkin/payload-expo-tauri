import type { CollectionConfig } from 'payload'

/**
 * Events — exercises timezone-aware dates, every pickerAppearance variant,
 * displayFormat, the explicit email field type, an array with a custom
 * RowLabel component, clearable selects, and condition-dependent fields.
 */
export const Events: CollectionConfig = {
  slug: 'events',
  enableQueryPresets: true,
  admin: {
    useAsTitle: 'name',
    group: 'Content',
    defaultColumns: ['name', 'startsAt', 'eventType'],
    // @ts-expect-error — payload-universal icon extension
    icon: 'calendar',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'eventType',
      type: 'select',
      options: [
        { label: 'Conference', value: 'conference' },
        { label: 'Meetup', value: 'meetup' },
        { label: 'Webinar', value: 'webinar' },
        { label: 'Workshop', value: 'workshop' },
      ],
      admin: {
        isClearable: true,
        description: 'Clearable — leave empty for uncategorized events',
      },
    },
    // Explicit email field type
    {
      name: 'contactEmail',
      type: 'email',
      admin: {
        placeholder: 'organizer@example.com',
        description: 'Shown on the public event page',
      },
    },
    // Timezone-aware day-and-time pair
    {
      type: 'row',
      fields: [
        {
          name: 'startsAt',
          type: 'date',
          required: true,
          timezone: true,
          admin: {
            width: '50%',
            date: {
              pickerAppearance: 'dayAndTime',
              displayFormat: 'd MMM yyy h:mm a',
            },
          },
        },
        {
          name: 'endsAt',
          type: 'date',
          timezone: true,
          admin: {
            width: '50%',
            date: {
              pickerAppearance: 'dayAndTime',
              displayFormat: 'd MMM yyy h:mm a',
            },
          },
        },
      ],
    },
    // pickerAppearance: dayOnly
    {
      name: 'registrationDeadline',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayOnly',
          displayFormat: 'd MMM yyy',
        },
        description: 'Last day to register',
      },
    },
    // pickerAppearance: timeOnly
    {
      name: 'doorsOpen',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'timeOnly',
          displayFormat: 'h:mm a',
        },
        description: 'Time attendees can arrive',
      },
    },
    // pickerAppearance: monthOnly
    {
      name: 'programMonth',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'monthOnly',
          displayFormat: 'MMMM yyy',
        },
        description: 'Which monthly program this event belongs to',
      },
    },
    // Checkbox driving condition-dependent fields
    {
      name: 'requiresRegistration',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      // Only shown when requiresRegistration is checked
      name: 'registrationUrl',
      type: 'text',
      admin: {
        condition: (_data, siblingData) => Boolean(siblingData?.requiresRegistration),
        placeholder: 'https://tickets.example.com/…',
      },
    },
    {
      // Only shown when requiresRegistration is checked
      name: 'capacity',
      type: 'number',
      min: 1,
      admin: {
        condition: (_data, siblingData) => Boolean(siblingData?.requiresRegistration),
        step: 10,
        placeholder: 'e.g. 150',
        description: 'Maximum number of attendees',
      },
    },
    // Array with a custom RowLabel component
    {
      name: 'sessions',
      type: 'array',
      labels: { singular: 'Session', plural: 'Sessions' },
      admin: {
        description: 'Agenda items — row labels come from a custom component',
        components: {
          RowLabel: { path: './components/SessionRowLabel' },
        },
      },
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
        },
        {
          name: 'speaker',
          type: 'text',
        },
        {
          name: 'startTime',
          type: 'date',
          admin: {
            date: {
              pickerAppearance: 'timeOnly',
              displayFormat: 'h:mm a',
            },
          },
        },
      ],
    },
    {
      name: 'organizer',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        position: 'sidebar',
      },
    },
  ],
}
