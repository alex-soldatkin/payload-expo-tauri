import type { CollectionConfig } from 'payload'

/**
 * Products — exercises code, json (with jsonSchema), point, hasMany
 * number/select/text, polymorphic relationships, filterOptions,
 * named groups, row width splits, and a ui field with a custom component.
 */
export const Products: CollectionConfig = {
  slug: 'products',
  enableQueryPresets: true,
  admin: {
    useAsTitle: 'name',
    group: 'Commerce',
    defaultColumns: ['name', 'sku', 'availability', 'lifecycleStage', 'updatedAt'],
    // @ts-expect-error — payload-universal icon extension
    icon: 'shopping-cart',
    // payload-universal native action extensions (suppressed by the icon
    // directive above — TS only reports the first excess property)
    listActions: [
      { key: 'exportProducts', label: 'Export Selected', icon: 'square.and.arrow.up.on.square' },
    ],
    editActions: [
      { key: 'archiveProduct', label: 'Archive Product', icon: 'archivebox', destructive: true },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    // Row — three-way width split
    {
      type: 'row',
      fields: [
        {
          name: 'sku',
          type: 'text',
          unique: true,
          admin: {
            width: '40%',
            placeholder: 'PRD-0001',
            description: 'Stock keeping unit',
          },
        },
        {
          name: 'stockLevel',
          type: 'number',
          min: 0,
          max: 10000,
          admin: {
            width: '30%',
            step: 10,
            placeholder: 'e.g. 250',
          },
        },
        {
          name: 'restockThreshold',
          type: 'number',
          min: 0,
          max: 1000,
          admin: {
            width: '30%',
            step: 5,
            placeholder: 'e.g. 25',
          },
        },
      ],
    },
    {
      name: 'availability',
      type: 'radio',
      defaultValue: 'in-stock',
      options: [
        { label: 'In Stock', value: 'in-stock' },
        { label: 'Backorder', value: 'backorder' },
        { label: 'Discontinued', value: 'discontinued' },
      ],
      admin: {
        layout: 'horizontal',
      },
    },
    // Kanban-friendly select — drives board columns on mobile (view-presets)
    {
      name: 'lifecycleStage',
      type: 'select',
      defaultValue: 'concept',
      options: [
        { label: 'Concept', value: 'concept' },
        { label: 'Development', value: 'development' },
        { label: 'Launched', value: 'launched' },
        { label: 'Mature', value: 'mature' },
        { label: 'Retired', value: 'retired' },
      ],
      admin: {
        description: 'Where this product sits in its lifecycle',
      },
    },
    // Named group — data nests under `pricing`
    {
      name: 'pricing',
      type: 'group',
      admin: {
        description: 'All monetary values in USD',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'price',
              type: 'number',
              required: true,
              min: 0,
              admin: {
                width: '50%',
                step: 0.01,
                placeholder: '0.00',
              },
            },
            {
              name: 'salePrice',
              type: 'number',
              min: 0,
              admin: {
                width: '50%',
                step: 0.01,
                placeholder: '0.00',
              },
            },
          ],
        },
        {
          name: 'taxRate',
          type: 'number',
          min: 0,
          max: 100,
          defaultValue: 20,
          admin: {
            step: 0.5,
            description: 'Percent applied at checkout',
          },
        },
        {
          name: 'onSale',
          type: 'checkbox',
          defaultValue: false,
        },
      ],
    },
    // UI field — presentational only, no data stored
    {
      name: 'priceSummary',
      type: 'ui',
      admin: {
        components: {
          Field: { path: './components/PriceSummary' },
        },
      },
    },
    // Select hasMany — sortable + clearable chips
    {
      name: 'features',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Waterproof', value: 'waterproof' },
        { label: 'Wireless', value: 'wireless' },
        { label: 'Rechargeable', value: 'rechargeable' },
        { label: 'Eco-Friendly', value: 'eco-friendly' },
        { label: 'Limited Edition', value: 'limited-edition' },
      ],
      admin: {
        isSortable: true,
        isClearable: true,
        description: 'Drag to reorder — order is preserved',
      },
    },
    // Number hasMany
    {
      name: 'availableSizes',
      type: 'number',
      hasMany: true,
      admin: {
        description: 'EU sizes this product ships in',
      },
    },
    // Text hasMany
    {
      name: 'searchKeywords',
      type: 'text',
      hasMany: true,
      admin: {
        description: 'Synonyms used by site search',
      },
    },
    // Code field
    {
      name: 'integrationSnippet',
      type: 'code',
      admin: {
        language: 'typescript',
        description: 'TypeScript snippet for embedding this product',
      },
    },
    // JSON field with a jsonSchema for editor validation
    {
      name: 'specs',
      type: 'json',
      jsonSchema: {
        uri: 'a://payload-universal/product-specs.schema.json',
        fileMatch: ['a://payload-universal/product-specs.schema.json'],
        schema: {
          type: 'object',
          properties: {
            weightGrams: { type: 'number' },
            dimensions: {
              type: 'object',
              properties: {
                widthMm: { type: 'number' },
                heightMm: { type: 'number' },
                depthMm: { type: 'number' },
              },
            },
            materials: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
      admin: {
        description: 'Free-form technical specs (validated against a JSON schema)',
      },
    },
    // Point field — [longitude, latitude]
    {
      name: 'warehouseLocation',
      type: 'point',
      label: 'Warehouse Location',
      admin: {
        description: 'Longitude / latitude of the fulfilling warehouse',
      },
    },
    // Polymorphic relationship — multiple collections + hasMany
    {
      name: 'relatedContent',
      type: 'relationship',
      relationTo: ['posts', 'pages'],
      hasMany: true,
      admin: {
        description: 'Posts or pages featuring this product',
      },
    },
    // Relationship with filterOptions — only published posts
    {
      name: 'featuredPost',
      type: 'relationship',
      relationTo: 'posts',
      filterOptions: {
        _status: { equals: 'published' },
      },
      admin: {
        position: 'sidebar',
        description: 'Only published posts can be selected',
      },
    },
    {
      name: 'releaseDate',
      type: 'date',
      admin: {
        position: 'sidebar',
        date: {
          pickerAppearance: 'dayOnly',
          displayFormat: 'd MMM yyy',
        },
      },
    },
  ],
}
