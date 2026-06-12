import { afterEach, expect, jest, test } from '@jest/globals'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import App from '../App'

afterEach(() => {
  global.fetch = undefined as unknown as typeof fetch
})

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

test('loads and renders schema summary', async () => {
  global.fetch = jest.fn<typeof fetch>().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => sampleSchema,
  } as Response)

  const { getByText, getByPlaceholderText } = render(<App />)

  fireEvent.changeText(getByPlaceholderText('en'), 'en')
  fireEvent.press(getByText('Load schema'))

  await waitFor(() => {
    expect(getByText(/Schema loaded successfully/)).toBeTruthy()
    expect(getByText(/Collections/)).toBeTruthy()
  })
})
