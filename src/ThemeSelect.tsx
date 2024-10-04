import React from 'react';
import { apexTheme } from './themes/apex.js';
import { monoTheme } from './themes/mono.js';
import { timberTheme } from './themes/timber.js';
import { styleOverrideDefaults } from './StyleOverrideSelect.js';
import { cedarTheme } from './themes/cedar.js';
import { waferTheme } from './themes/wafer.js';
import { urbanTheme } from './themes/urban.js';
import { blockTheme } from './themes/block.js';

interface Theme {
    name: string;
    identifier: string;
    style: string;
    components: string[];
}

const themes: Theme[] = [
    {
        name: 'Apex',
        identifier: 'apex',
        style: apexTheme,
        components: ['_dropcap1', '_hrThick80', '_indent1', ...styleOverrideDefaults]
    },
    {
        name: 'Block',
        identifier: 'block',
        style: blockTheme,
        components: ['_dropcap3', '_hrThin', ...styleOverrideDefaults]
    },
    {
        name: 'Cedar',
        identifier: 'cedar',
        style: cedarTheme,
        components: ['_dropcap3', '_hrThick80', '_indent1', ...styleOverrideDefaults]
    },
    {
        name: 'Mono',
        identifier: 'mono',
        style: monoTheme,
        components: ['_hrAsterisks3', ...styleOverrideDefaults]
    },
    {
        name: 'Timber',
        identifier: 'timber',
        style: timberTheme,
        components: ['_dropcap3', '_hrDotted50', '_indent1', ...styleOverrideDefaults]
    },
    {
        name: 'Urban',
        identifier: 'urban',
        style: urbanTheme,
        components: ['_hrThick30', '_indent1', ...styleOverrideDefaults]
    },
    {
        name: 'Wafer',
        identifier: 'wafer',
        style: waferTheme,
        components: ['_dropcap2', '_hrThin30', '_indent1', ...styleOverrideDefaults]
    },
];

export const getStyleForTheme = (theme: string) => {
    const selectedTheme = themes.find(t => t.identifier === theme);
    if (selectedTheme) {
        return selectedTheme.style;
    }
    return '';
};

export const populateComponentsForTheme = (theme: string) => {
    const selectedTheme = themes.find(t => t.identifier === theme);
    if (selectedTheme) {
        return selectedTheme.components;
    }
    return [];
};

interface ThemeSelectProps {
    value: string;
    onChange: (event: React.ChangeEvent<HTMLSelectElement>, style: string, components: string[]) => void;
}

const ThemeSelect: React.FC<ThemeSelectProps> = ({ value, onChange }) => {
    return (
        <select
            id="theme"
            className="metadata-input"
            value={value}
            onChange={(event) => onChange(event, getStyleForTheme(event.target.value), populateComponentsForTheme(event.target.value))}
        >
            {themes.map(theme => (
                <option key={theme.identifier} value={theme.identifier}>
                    {theme.name}
                </option>
            ))}
        </select>
    );
};

export default ThemeSelect;