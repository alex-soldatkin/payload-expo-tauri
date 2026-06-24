/**
 * Walks the sanitized (server) field tree in parallel with the client field
 * tree (createClientFields preserves order 1:1) and re-attaches serializable
 * metadata that `createClientConfig` strips:
 *
 * - `admin.condition` functions → `admin.hasCondition: true` marker on the
 *   client field, plus the schema path collected into `conditionPaths`.
 * - object-form `filterOptions` (Where clauses) on relationship/upload
 *   fields → copied back onto the client field (function-form stays server-only).
 *
 * Mutates the client fields in place — they are shared by reference between
 * `clientConfig` and the serialized field schema maps, so both carry markers.
 */
export const applyServerFieldMarkers = ({
  clientFields,
  conditionPaths,
  parentPath,
  serverFields,
}: {
  clientFields: unknown
  conditionPaths: string[]
  parentPath: string
  serverFields: unknown
}): void => {
  if (!Array.isArray(serverFields) || !Array.isArray(clientFields)) {
    return
  }

  for (let i = 0; i < serverFields.length; i++) {
    const server = serverFields[i] as Record<string, any> | undefined
    const client = clientFields[i] as Record<string, any> | undefined
    if (!server || !client || client.type !== server.type) {
      continue
    }

    const name = typeof server.name === 'string' ? server.name : undefined
    const path = name ? (parentPath ? `${parentPath}.${name}` : name) : parentPath

    if (typeof server.admin?.condition === 'function') {
      client.admin = client.admin ?? {}
      client.admin.hasCondition = true
      conditionPaths.push(
        name ? path : parentPath ? `${parentPath}._index-${i}` : `_index-${i}`,
      )
    }

    if (
      (server.type === 'relationship' || server.type === 'upload') &&
      server.filterOptions &&
      typeof server.filterOptions === 'object'
    ) {
      client.filterOptions = server.filterOptions
    }

    if (Array.isArray(server.fields)) {
      applyServerFieldMarkers({
        clientFields: client.fields,
        conditionPaths,
        parentPath: path,
        serverFields: server.fields,
      })
    }

    if (Array.isArray(server.tabs)) {
      const clientTabs = Array.isArray(client.tabs) ? client.tabs : []
      for (let t = 0; t < server.tabs.length; t++) {
        const serverTab = server.tabs[t] as Record<string, any> | undefined
        const clientTab = clientTabs[t] as Record<string, any> | undefined
        if (!serverTab || !clientTab) {
          continue
        }
        const tabPath =
          typeof serverTab.name === 'string'
            ? path
              ? `${path}.${serverTab.name}`
              : serverTab.name
            : path
        applyServerFieldMarkers({
          clientFields: clientTab.fields,
          conditionPaths,
          parentPath: tabPath,
          serverFields: serverTab.fields,
        })
      }
    }

    if (Array.isArray(server.blocks)) {
      const clientBlocks = Array.isArray(client.blocks) ? client.blocks : []
      for (let b = 0; b < server.blocks.length; b++) {
        const serverBlock = server.blocks[b] as Record<string, any> | string | undefined
        const clientBlock = clientBlocks[b] as Record<string, any> | string | undefined
        // String entries reference the global block registry — skip (rare).
        if (
          !serverBlock ||
          typeof serverBlock === 'string' ||
          !clientBlock ||
          typeof clientBlock === 'string'
        ) {
          continue
        }
        applyServerFieldMarkers({
          clientFields: clientBlock.fields,
          conditionPaths,
          parentPath: `${path}.${serverBlock.slug}`,
          serverFields: serverBlock.fields,
        })
      }
    }
  }
}
