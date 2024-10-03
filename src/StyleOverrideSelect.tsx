import React from 'react';
import { _all } from './themes/components/all.js';
import { _dropcap1, _dropcap2, _dropcap3 } from './themes/components/dropcap.js';
import { _hr1, _hr10, _hr11, _hr12, _hr13, _hr2, _hr3, _hr4, _hr5, _hr6, _hr7, _hr8, _hr9 } from './themes/components/hr.js';
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
    },
    {
        name: 'Solid Line',
        identifier: '_hr2',
        style: _hr2
    },
    {
        name: 'Solid Line 80%',
        identifier: '_hr3',
        style: _hr3
    },
    {
        name: 'Solid Line 50%',
        identifier: '_hr4',
        style: _hr4
    },
    {
        name: 'Solid Line 30%',
        identifier: '_hr5',
        style: _hr5
    },
    {
        name: 'Thick Line',
        identifier: '_hr6',
        style: _hr6
    },
    {
        name: 'Thick Line 80%',
        identifier: '_hr7',
        style: _hr7
    },
    {
        name: 'Thick Line 50%',
        identifier: '_hr8',
        style: _hr8
    },
    {
        name: 'Thick Line 30%',
        identifier: '_hr9',
        style: _hr9
    },
    {
        name: 'Dotted Line',
        identifier: '_hr10',
        style: _hr10
    },
    {
        name: 'Dotted Line 80%',
        identifier: '_hr11',
        style: _hr11
    },
    {
        name: 'Dotted Line 50%',
        identifier: '_hr12',
        style: _hr12
    },
    {
        name: 'Dotted Line 30%',
        identifier: '_hr13',
        style: _hr13
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