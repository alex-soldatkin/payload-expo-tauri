// DOM port of server SlugField — a real slug editor plus a "generate from
// title" button. Slugify rule copied verbatim from the original:
//   title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
import { useWatch } from 'react-hook-form'
import type { FieldComponentProps } from '../types'
import { FieldShell, useFieldValue, isReadOnly, placeholderOf } from '../fields/shared'

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function SlugField(props: FieldComponentProps) {
  const { value, setValue, onBlur } = useFieldValue<string | undefined>(props)
  const readOnly = isReadOnly(props)
  // Reactive read of the sibling title (unnamed tabs are transparent → root).
  const title = useWatch({ control: props.control, name: 'title' }) as unknown

  const generate = () => {
    if (typeof title === 'string' && title.trim() !== '') {
      setValue(slugify(title))
    }
  }

  return (
    <FieldShell props={props}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          className="input mono"
          type="text"
          value={value ?? ''}
          placeholder={placeholderOf(props) ?? 'auto-generated-slug'}
          readOnly={readOnly}
          onBlur={onBlur}
          onChange={(e) => setValue(e.target.value === '' ? undefined : e.target.value)}
          style={{ flex: 1 }}
        />
        {!readOnly && (
          <button
            type="button"
            onClick={generate}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              borderRadius: 6,
              background: 'rgba(124, 92, 255, 0.18)',
              border: '1px solid rgba(124, 92, 255, 0.4)',
              color: 'inherit',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Generate from title
          </button>
        )}
      </div>
    </FieldShell>
  )
}

export default SlugField
