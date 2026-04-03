import React, { useCallback } from 'react'
import { useField, useForm, TextInput, FieldLabel, FieldDescription, FieldError, Button, Pill } from '@payload-universal/ui'
import { View, TextInput as RNTextInput } from "react-native";

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
        <View className="custom-slug-field" style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <FieldLabel label={label || 'Custom Slug Component'} />
                <Button onPress={generateSlug} style={{ paddingVertical: 4, paddingHorizontal: 8, fontSize: 12 }}>
                    Regenerate
                </Button>
            </View>

            <View style={{ padding: 4 }}>
                <RNTextInput
                    value={value || ''}
                    onChangeText={(text) => setValue(text)}
                    placeholder="yoursite.com/post/auto-generated-slug"
                    style={{ width: '100%', padding: 8 }}
                />
            </View>

            <FieldDescription description={description} />
            {errorMessage && <FieldError error={errorMessage} />}
            <Pill>Experimental Field Plugin</Pill>
        </View>
    )
}

export default SlugField
