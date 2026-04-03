/**
 * Client-side validators and hooks config for the test app.
 *
 * This file defines custom field validators and collection hooks that run
 * LOCALLY on the mobile device — before any data is written to RxDB or
 * synced to the server. No server dependencies allowed here.
 *
 * Built-in validators (required, min, max, minLength, maxLength, email regex,
 * select option matching, etc.) run automatically from the schema metadata.
 * Only add entries here for CUSTOM logic that goes beyond the schema constraints.
 */
import type { ClientHooksConfig } from '@payload-universal/client-validators'

export const clientHooksConfig: ClientHooksConfig = {
  collections: {
    posts: {
      hooks: {
        beforeChange: [
          // Auto-generate slug from title on create if slug is empty
          async ({ data, operation }) => {
            if (operation === 'create' && data.title && !data.slug) {
              data.slug = String(data.title)
                .toLowerCase()
                .trim()
                .replace(/\s+/g, '-')
                .replace(/[^a-z0-9-]/g, '')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '')
            }
            return data
          },
        ],
      },
      fields: {
        // Custom validator: slug must be URL-safe
        slug: {
          validate: (value, { required }) => {
            if (!value) return required ? 'Slug is required.' : true
            if (typeof value !== 'string') return 'Slug must be a string.'
            if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
              return 'Slug must be lowercase, alphanumeric, and use hyphens only (e.g. "my-post").'
            }
            return true
          },
        },
        // Priority range is already handled by built-in number validator (min: 1, max: 10)
        // but we add a friendlier message
        priority: {
          validate: (value) => {
            if (value === null || value === undefined || value === '') return true
            const num = Number(value)
            if (isNaN(num)) return 'Priority must be a number.'
            if (num < 1 || num > 10) return 'Priority must be between 1 and 10.'
            return true
          },
        },
      },
    },
    media: {
      fields: {
        alt: {
          validate: (value, { required }) => {
            if (!value) return required ? 'Alt text is required for accessibility.' : true
            if (typeof value === 'string' && value.trim().length < 3) {
              return 'Alt text should be at least 3 characters for meaningful accessibility.'
            }
            return true
          },
        },
      },
    },
    users: {
      // Users collection — email validation is handled by built-in email validator.
      // No custom hooks needed.
    },
  },
}
