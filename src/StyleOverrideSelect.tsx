import React from 'react';

interface StyleOverride {
    name: string;
    identifier: string;
}

export const dropcaps: StyleOverride[] = [
    {
        name: 'None',
        identifier: ''
    },
    {
        name: 'Style 1',
        identifier: '_dropcap1'
    }
];

export const horizontalRules: StyleOverride[] = [
    {
        name: 'None',
        identifier: ''
    },
    {
        name: 'Style 1',
        identifier: '_hr1'
    }
];

export const indents: StyleOverride[] = [
    {
        name: 'None',
        identifier: ''
    },
    {
        name: 'Style 1',
        identifier: '_indent1'
    }
];

interface StyleOverrideSelectProps {
    value: string[];
    styleOverrides: StyleOverride[];
    onChange: (event: React.ChangeEvent<HTMLSelectElement>, components: string[]) => void;
}

const StyleOverrideSelect: React.FC<StyleOverrideSelectProps> = ({ value, styleOverrides, onChange }) => {
    let selectedValue = 'None';
    styleOverrides.forEach((styleOverride) => {
        if (value.includes(styleOverride.identifier)) {
            selectedValue = styleOverride.identifier;
        }
    });

    const handleSelection = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const finalComponents = [];
        value.forEach((component) => {
            if (!styleOverrides.find(styleOverride => styleOverride.identifier === component)) {
                finalComponents.push(component);
            }
        });

        const selectedOption = styleOverrides.find(styleOverride => styleOverride.identifier === event.target.value);
        if (selectedOption) {
            finalComponents.push(selectedOption.identifier);
        }

        return finalComponents;
    };

    return (
        <select
            className="metadata-input"
            value={selectedValue}
            onChange={(event) => onChange(event, handleSelection(event))}
        >
            {styleOverrides.map(styleOverride => (
                <option key={styleOverride.identifier} value={styleOverride.identifier}>
                    {styleOverride.name}
                </option>
            ))}
        </select>
    );
};

export default StyleOverrideSelect;