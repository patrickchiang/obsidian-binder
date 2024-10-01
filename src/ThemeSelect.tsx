import React from 'react';

interface Theme {
    name: string;
    identifier: string;
}

interface ThemeSelectProps {
    value: string;
    onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
}

const ThemeSelect: React.FC<ThemeSelectProps> = ({ value, onChange }) => {
    const themes: Theme[] = [
        {
            name: 'Base',
            identifier: 'base'
        },
        {
            name: 'Mono',
            identifier: 'mono'
        }
    ];

    return (
        <select
            id="theme"
            className="metadata-input"
            value={value}
            onChange={onChange}
        >
            {themes.map(theme => (
                <option key={theme.name} value={theme.identifier}>
                    {theme.name}
                </option>
            ))}
        </select>
    );
};

export default ThemeSelect;