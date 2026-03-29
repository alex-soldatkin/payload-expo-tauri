import { NextResponse } from 'next/server'

const getPayloadURL = () => process.env.PAYLOAD_BASE_URL || 'http://localhost:3000'

export async function GET(request: Request) {
  const payloadURL = getPayloadURL()
  const incomingURL = new URL(request.url)
  const targetURL = new URL('/api/admin-schema', payloadURL)
  targetURL.search = incomingURL.search

  const headers = new Headers()
  headers.set('accept', 'application/json')

  const authHeader = request.headers.get('authorization')
  if (authHeader) {
    headers.set('authorization', authHeader)
  }

  const cookieHeader = request.headers.get('cookie')
  if (cookieHeader) {
    headers.set('cookie', cookieHeader)
  }

  const response = await fetch(targetURL.toString(), {
    headers,
  })

  const body = await response.text()
  const contentType = response.headers.get('content-type') || 'application/json'

  return new NextResponse(body, {
    status: response.status,
    headers: {
      'content-type': contentType,
    },
  })
}
