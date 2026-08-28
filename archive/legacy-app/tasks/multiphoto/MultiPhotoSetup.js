import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import styles from '../../Styles';

const PhotoSetup = ({ options, setOptions }) => {
    const [mode, setMode] = useState('unlimited');
    const [exact, setExact] = useState('');
    const [min, setMin] = useState('');
    const [max, setMax] = useState('');

    useEffect(() => {
        const { photoCount } = options;
        if (photoCount === undefined || photoCount === null) {
            setMode('unlimited');
            setExact('');
            setMin('');
            setMax('');
        } else if (typeof photoCount === 'number') {
            setMode('exact');
            setExact(photoCount.toString());
            setMin('');
            setMax('');
        } else if (typeof photoCount === 'object') {
            setMode('range');
            setExact('');
            setMin(photoCount.min?.toString() || '');
            setMax(photoCount.max?.toString() || '');
        }
    }, [options]);

    // Update options.photoCount on any change
    useEffect(() => {
        if (mode === 'unlimited') {
            setOptions(prev => ({ ...prev, photoCount: undefined }));
        } else if (mode === 'exact') {
            const count = parseInt(exact);
            if (!isNaN(count) && count >= 0) {
                setOptions(prev => ({ ...prev, photoCount: count }));
            }
        } else if (mode === 'range') {
            const minVal = min !== '' ? parseInt(min) : undefined;
            const maxVal = max !== '' ? parseInt(max) : undefined;

            if (
                (minVal === undefined || !isNaN(minVal)) &&
                (maxVal === undefined || !isNaN(maxVal)) &&
                (minVal === undefined || maxVal === undefined || minVal <= maxVal)
            ) {
                setOptions(prev => ({
                    ...prev,
                    photoCount: { ...(minVal !== undefined && { min: minVal }), ...(maxVal !== undefined && { max: maxVal }) }
                }));
            }
        }
    }, [mode, exact, min, max]);

    return (
        <View style={localStyles.container}>
            <Text style={localStyles.header}>Photo Count Settings</Text>

            <View style={localStyles.modeButtons}>
                {['unlimited', 'exact', 'range'].map((m) => (
                    <TouchableOpacity
                        key={m}
                        style={[
                            localStyles.modeButton,
                            mode === m && localStyles.selectedMode
                        ]}
                        onPress={() => setMode(m)}
                    >
                        <Text>{m}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {mode === 'exact' && (
                <TextInput
                    placeholder="Exact number of photos"
                    value={exact}
                    keyboardType="number-pad"
                    onChangeText={setExact}
                    style={styles.textInput}
                />
            )}

            {mode === 'range' && (
                <>
                    <TextInput
                        placeholder="Minimum photos"
                        value={min}
                        keyboardType="number-pad"
                        onChangeText={setMin}
                        style={styles.textInput}
                    />
                    <TextInput
                        placeholder="Maximum photos"
                        value={max}
                        keyboardType="number-pad"
                        onChangeText={setMax}
                        style={styles.textInput}
                    />
                </>
            )}
        </View>
    );
};

const localStyles = StyleSheet.create({
    container: {
        padding: 20,
    },
    header: {
        fontSize: 18,
        marginBottom: 10,
    },
    modeButtons: {
        flexDirection: 'row',
        marginBottom: 10,
    },
    modeButton: {
        marginRight: 10,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderRadius: 4,
    },
    selectedMode: {
        backgroundColor: '#d0e0ff',
    }
});

export default PhotoSetup;