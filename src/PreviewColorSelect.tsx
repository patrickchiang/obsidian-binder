import React from 'react';

interface PreviewColorSelectProps {
    value: string;
    onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
}

const PreviewColorSelect: React.FC<PreviewColorSelectProps> = ({ value, onChange }) => {
    const colorSchemes = [
        'light',
        'dark',
        'sepia',
        'green'
    ];

    return (
        <select
            id="color-scheme"
            className="toolbar-button"
            value={value}
            onChange={onChange}
            aria-label="Change reading color scheme"
        >
            {colorSchemes.map(colorScheme => (
                <option key={colorScheme} value={colorScheme}>
                    {colorScheme}
                </option>
            ))}
        </select>
    );
};

export default PreviewColorSelect;