import React from 'react';
import { _all } from './themes/components/all.js';
import { _dropcap1, _dropcap2, _dropcap3 } from './themes/components/dropcap.js';
import { _hr1 } from './themes/components/hr.js';
import { _indent1, _indent2 } from './themes/components/indent.js';

interface StyleOverride {
    name: string;
    identifier: string;
    style: string;
}

export const dropcaps: StyleOverride[] = [
    {
        name: 'None',
        identifier: '',
        style: ''
    },
    {
        name: 'First Letter',
        identifier: '_dropcap1',
        style: _dropcap1
    },
    {
        name: 'First Word',
        identifier: '_dropcap2',
        style: _dropcap2
    },
    {
        name: 'First Line',
        identifier: '_dropcap3',
        style: _dropcap3
    }
];

export const horizontalRules: StyleOverride[] = [
    {
        name: 'Hide',
        identifier: '',
        style: ''
    },
    {
        name: 'Three Asterisks',
        identifier: '_hr1',
        style: _hr1
    }
];

export const indents: StyleOverride[] = [
    {
        name: 'No Indent',
        identifier: '',
        style: ''
    },
    {
        name: 'Indent After First',
        identifier: '_indent1',
        style: _indent1
    },
    {
        name: 'Indent All',
        identifier: '_indent2',
        style: _indent2
    }
];

const allStyleOverrides = [...dropcaps, ...horizontalRules, ...indents];

export const calculateStyleOverrides = (components: string[]): string => {
    return _all + components.reduce((acc, component) => {
        const styleOverride = allStyleOverrides.find(styleOverride => styleOverride.identifier === component);
        if (styleOverride) {
            return acc + styleOverride.style;
        }
        return acc;
    }, '');
};

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