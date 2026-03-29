import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import Page from './page'

const sampleSchema = {
  generatedAt: '2026-02-05T00:00:00.000Z',
  clientConfig: {},
  collections: {
    users: [
      ['users', { fields: [{ name: 'email', type: 'text' }] }],
      ['users.email', { name: 'email', type: 'text' }],
    ],
  },
  globals: {},
}

describe('Admin schema preview page', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders schema summary after fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => sampleSchema,
      text: async () => JSON.stringify(sampleSchema),
      headers: new Map([['content-type', 'application/json']]),
    })

    // @ts-expect-error - test override
    global.fetch = fetchMock

    render(<Page />)

    fireEvent.click(screen.getByRole('button', { name: /load schema/i }))

    expect(await screen.findByText(/Generated at/i)).toBeInTheDocument()
    expect(await screen.findByText(/users/i)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalled()
  })
})
