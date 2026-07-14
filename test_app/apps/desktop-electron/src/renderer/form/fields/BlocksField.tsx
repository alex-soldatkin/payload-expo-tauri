// Blocks field — repeatable rows where each row is one of several block types.
// Same card chrome + generation-remount pattern as ArrayField (rows keyed
// `${index}:${gen}`; generation bumped on every structural mutation so shifted
// uncontrolled inputs remount instead of showing stale values).
//
// Each row's fields resolve from its blockType. They're wrapped in
// BlockScopeProvider so nested conditions can resolve `{path}.{blockType}.{name}`.
// Unknown blockTypes render a warning card that keeps the data and offers remove.
//
// Drag reorder mirrors ArrayField: dnd-kit with the row's `${index}:${gen}` key
// as the sortable id (SortableRowCard supplies the left drag handle). On dragEnd
// the leading index of active/over ids maps back to array indexes for moveRow.
import { useState } from 'react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { FieldComponentProps, SchemaBlock } from '../types'
import { labelForField, resolveLabel } from '../labels'
import { BlockScopeProvider } from '../FieldRenderer'
import { SortableRowCard } from './ArrayField'
import { useFieldValue } from './shared'

type BlockRow = { blockType: string; blockName?: string; [k: string]: unknown }

export function BlocksField(props: FieldComponentProps) {
  const { field, path, error, renderField } = props
  const { value, setValue } = useFieldValue<BlockRow[] | undefined>(props)
  const rows = Array.isArray(value) ? value : []
  const blocks = field.blocks ?? []

  const [generation, setGeneration] = useState(0)
  const bump = () => setGeneration((g) => g + 1)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const rowIds = rows.map((_, index) => `${index}:${generation}`)

  const title = labelForField(field)
  const description = resolveLabel(field.admin?.description)

  const atMax = field.maxRows != null && rows.length >= field.maxRows
  const atMin = field.minRows != null && rows.length <= field.minRows
  const canRemove = !atMin

  const commit = (next: BlockRow[]) => {
    setValue(next)
    bump()
  }

  const addBlock = (block: SchemaBlock) => {
    if (atMax) return
    commit([...rows, { blockType: block.slug }])
  }
  const removeRow = (index: number) => {
    if (!canRemove) return
    commit(rows.filter((_, i) => i !== index))
  }
  const moveRow = (from: number, to: number) => {
    if (to < 0 || to >= rows.length) return
    const next = [...rows]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    commit(next)
  }
  const duplicateRow = (index: number) => {
    if (atMax) return
    const next = [...rows]
    next.splice(index + 1, 0, { ...rows[index] })
    commit(next)
  }

  // Sortable ids carry the row index before ':'; map both ends back to indexes.
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = Number(String(active.id).split(':')[0])
    const to = Number(String(over.id).split(':')[0])
    if (Number.isInteger(from) && Number.isInteger(to)) moveRow(from, to)
  }

  const blockDef = (slug: string) => blocks.find((b) => b.slug === slug)

  const rowControls = (index: number) => (
    <>
      <button type="button" disabled={index === 0} onClick={() => moveRow(index, index - 1)}>
        ↑
      </button>
      <button
        type="button"
        disabled={index === rows.length - 1}
        onClick={() => moveRow(index, index + 1)}
      >
        ↓
      </button>
      <button type="button" disabled={atMax} onClick={() => duplicateRow(index)}>
        Duplicate
      </button>
      <button type="button" disabled={!canRemove} onClick={() => removeRow(index)}>
        Remove
      </button>
    </>
  )

  return (
    <div className="field-group">
      {title && <div className="field-group-title">{title}</div>}
      {description && <div className="field-description">{description}</div>}
      {error && <div className="field-error">{error}</div>}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
          <div className="field-rows">
            {rows.map((row, index) => {
              const def = blockDef(row.blockType)
              if (!def) {
                return (
                  <SortableRowCard
                    key={rowIds[index]}
                    id={rowIds[index]}
                    head={
                      <>
                        <span className="title">Unknown block: {row.blockType}</span>
                        <button
                          type="button"
                          disabled={!canRemove}
                          onClick={() => removeRow(index)}
                        >
                          Remove
                        </button>
                      </>
                    }
                  >
                    <div className="field-error">
                      This block type is not defined in the schema. Its data is preserved.
                    </div>
                  </SortableRowCard>
                )
              }
              const singular = resolveLabel(def.labels?.singular, def.slug)
              const head = row.blockName ? `${singular} — ${row.blockName}` : singular
              return (
                <SortableRowCard
                  key={rowIds[index]}
                  id={rowIds[index]}
                  head={
                    <>
                      <span className="title">{head}</span>
                      {rowControls(index)}
                    </>
                  }
                >
                  <BlockScopeProvider value={row.blockType}>
                    {def.fields.map((sub) => renderField(sub, `${path}.${index}`))}
                  </BlockScopeProvider>
                </SortableRowCard>
              )
            })}
          </div>
        </SortableContext>
      </DndContext>

      <div className="field-row" style={{ flexWrap: 'wrap' }}>
        {blocks.map((block) => (
          <button
            key={block.slug}
            type="button"
            className="field-add-row"
            disabled={atMax}
            onClick={() => addBlock(block)}
          >
            Add {resolveLabel(block.labels?.singular, block.slug)}
          </button>
        ))}
      </div>
    </div>
  )
}
