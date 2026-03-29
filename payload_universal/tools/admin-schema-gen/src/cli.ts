import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

import { rawConfig } from '@payload-universal/schema/payload.config'

import { buildAdminSchema } from '@payload-universal/admin-schema'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const outDir = path.resolve(dirname, '../../../packages/admin-schema/generated')
const outFile = path.join(outDir, 'admin-schema.json')

const run = async () => {
  const schema = await buildAdminSchema({ config: rawConfig })

  await fs.mkdir(outDir, { recursive: true })
  await fs.writeFile(outFile, JSON.stringify(schema, null, 2))

  // eslint-disable-next-line no-console
  console.log(`Wrote ${outFile}`)
}

await run()
