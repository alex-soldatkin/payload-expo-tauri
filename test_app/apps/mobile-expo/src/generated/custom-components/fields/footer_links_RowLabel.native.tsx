/**
 * FooterLinkRowLabel — custom RowLabel for the footer.links array.
 *
 * Exercises: useRowLabel inside a global, div→View, span→Text.
 * RN-translatable (no document/window/canvas).
 */
import React from 'react'
import { useRowLabel } from '@payload-universal/ui'
import { View, Text } from "react-native";

type FooterLinkRow = {
    label?: string
    url?: string
    newTab?: boolean
}

export const FooterLinkRowLabel: React.FC = () => {
    // Guarded call: the native shim may not export useRowLabel yet. The
    // condition is constant per platform, so hook order stays stable.
    const { data, rowNumber } =
        typeof useRowLabel === 'function'
            ? useRowLabel<FooterLinkRow>()
            : {
                data: undefined as FooterLinkRow | undefined,
                rowNumber: undefined as number | undefined,
            }

    const label = data?.label || `Link ${(rowNumber ?? 0) + 1}`

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontWeight: 600, fontSize: 13 }}>{label}</Text>
            {data?.url ? <Text style={{ color: '#888', fontSize: 12 }}>{data.url}</Text> : null}
            {data?.newTab ? (
                <Text style={{ color: '#1a7f37', fontSize: 11, fontWeight: 600 }}>NEW TAB</Text>
            ) : null}
        </View>
    )
}

export default FooterLinkRowLabel
