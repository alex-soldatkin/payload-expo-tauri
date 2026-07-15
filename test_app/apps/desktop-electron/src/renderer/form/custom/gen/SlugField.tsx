// GENERATED PASSTHROUGH — do not edit. Regenerate with codegen:dom.
// Verbatim copy of components/SlugField/index.tsx ('use client' stripped);
// '@payloadcms/ui' resolves to the desktop ui-dom shim.
import React, { useCallback } from 'react'
import { useField, useForm, TextInput, FieldLabel, FieldDescription, FieldError, Button, Pill } from '@payloadcms/ui'

export const SlugField: React.FC<any> = ({ path, label, description, required }) => {
  const { value, setValue, errorMessage } = useField<string>({ path })
  const { getData } = useForm()

  const generateSlug = useCallback(() => {
    const title = getData()?.title
    if (typeof title === 'string') {
      setValue(title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''))
    }
  }, [getData, setValue])

  return (
    <div className="custom-slug-field" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <FieldLabel label={label || 'Custom Slug Component'} />
        <Button onClick={generateSlug} buttonStyle="secondary" size="xsmall">
          Regenerate
        </Button>
      </div>
      
      <div style={{ padding: 4 }}>
        <input 
          type="text"
          value={value || ''}
          onChange={(e) => setValue(e.target.value)}
          placeholder="yoursite.com/post/auto-generated-slug"
          style={{ width: '100%', padding: '8px', border: '1px solid #ccc' }}
        />
      </div>

      <FieldDescription description={description} path={path} />
      {errorMessage && <FieldError message={errorMessage} path={path} showError />}
      <Pill>Experimental Field Plugin</Pill>
    </div>
  )
}

export default SlugField
