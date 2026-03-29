const baseUrlInput = document.getElementById('baseUrl')
const languageInput = document.getElementById('language')
const tokenInput = document.getElementById('token')
const includeCredentialsInput = document.getElementById('includeCredentials')
const loadButton = document.getElementById('loadSchema')
const statusMessage = document.getElementById('statusMessage')
const summaryNode = document.getElementById('summary')
const collectionsNode = document.getElementById('collections')
const globalsNode = document.getElementById('globals')

const showStatus = (message, isError = false) => {
  statusMessage.textContent = message
  statusMessage.classList.add('visible')
  statusMessage.style.background = isError ? '#f8d7da' : '#fff3cd'
  statusMessage.style.borderColor = isError ? '#f5c6cb' : '#ffeeba'
  statusMessage.style.color = isError ? '#721c24' : '#7a5a00'
}

const clearStatus = () => {
  statusMessage.textContent = ''
  statusMessage.classList.remove('visible')
}

const getRootFields = (mapEntries, slug) => {
  const map = new Map(mapEntries)
  const root = map.get(slug)
  if (!root || !Array.isArray(root.fields)) {
    return []
  }

  return root.fields.map((field) => {
    return {
      name: field.name || '(unnamed)',
      type: field.type || 'unknown',
    }
  })
}

const getSchemaPaths = (mapEntries, limit = 12) => {
  return mapEntries
    .map(([path, field]) => ({
      path,
      type: field?.type || (field?.fields ? 'group' : 'unknown'),
    }))
    .slice(0, limit)
}

const renderList = (node, items) => {
  if (!items.length) {
    node.innerHTML = '<p>No entries found.</p>'
    return
  }

  node.innerHTML = `<div class="list">${items
    .map((item) => {
      const fields = item.fields
        .map((field) => `<li><span class="code">${field.name}</span> — ${field.type}</li>`)
        .join('')
      const paths = item.paths
        .map((entry) => `<li><span class="code">${entry.path}</span> — ${entry.type}</li>`)
        .join('')

      return `
        <div class="card">
          <h3>${item.title}</h3>
          <p><strong>${item.count}</strong> schema entries</p>
          <ul>${fields}</ul>
          <details class="paths">
            <summary>Schema paths (first ${item.paths.length})</summary>
            <ul>${paths}</ul>
          </details>
        </div>
      `
    })
    .join('')}</div>`
}

const renderSchema = (schema) => {
  summaryNode.innerHTML = `
    <p><strong>Generated at:</strong> ${schema.generatedAt}</p>
    <p><strong>Collections:</strong> ${Object.keys(schema.collections).length}</p>
    <p><strong>Globals:</strong> ${Object.keys(schema.globals).length}</p>
  `

  const collectionItems = Object.entries(schema.collections).map(([slug, entries]) => {
    const fields = getRootFields(entries, slug)
    return {
      title: slug,
      count: entries.length,
      fields,
      paths: getSchemaPaths(entries),
    }
  })

  const globalItems = Object.entries(schema.globals).map(([slug, entries]) => {
    const fields = getRootFields(entries, slug)
    return {
      title: slug,
      count: entries.length,
      fields,
      paths: getSchemaPaths(entries),
    }
  })

  renderList(collectionsNode, collectionItems)
  renderList(globalsNode, globalItems)
}

const fetchSchema = async () => {
  clearStatus()

  const baseUrl = baseUrlInput.value.trim()
  const language = languageInput.value.trim()
  const token = tokenInput.value.trim()
  const includeCredentials = includeCredentialsInput.checked

  if (!baseUrl) {
    showStatus('Base URL is required.', true)
    return
  }

  try {
    const url = new URL('/api/admin-schema', baseUrl)
    if (language) {
      url.searchParams.set('language', language)
    }

    const headers = {
      Accept: 'application/json',
    }

    if (token) {
      headers.Authorization = `JWT ${token}`
    }

    showStatus('Loading admin schema...')

    const response = await fetch(url.toString(), {
      headers,
      credentials: includeCredentials ? 'include' : 'omit',
    })

    if (!response.ok) {
      const message = await response.text()
      throw new Error(`Request failed (${response.status}): ${message}`)
    }

    const schema = await response.json()
    renderSchema(schema)
    showStatus('Schema loaded successfully.')
  } catch (error) {
    showStatus(error.message || 'Failed to load schema.', true)
  }
}

loadButton.addEventListener('click', fetchSchema)
