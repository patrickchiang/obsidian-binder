import React from 'react';
import { apexTheme } from './themes/apex.js';
import { monoTheme } from './themes/mono.js';
import { timberTheme } from './themes/timber.js';
import { styleOverrideDefaults } from './StyleOverrideSelect.js';

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
        components: ['_dropcap1', '_hrAsterisks3', '_indent1', ...styleOverrideDefaults]
    },
    {
        name: 'Mono',
        identifier: 'mono',
        style: monoTheme,
        components: ['_hr1', ...styleOverrideDefaults]
    },
    {
        name: 'Timber',
        identifier: 'timber',
        style: timberTheme,
        components: ['_dropcap1', '_hrAsterisks3', '_indent1', ...styleOverrideDefaults]
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