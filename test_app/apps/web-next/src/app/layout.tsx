import './globals.css'

export const metadata = {
  title: 'Payload Universal Admin Schema Preview',
  description: 'Next wrapper for the admin schema preview',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
