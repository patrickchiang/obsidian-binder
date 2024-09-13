import React from 'react';

interface Language {
    code: string;
    name: string;
}

interface LanguageSelectProps {
    value: string;
    onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
}

const LanguageSelect: React.FC<LanguageSelectProps> = ({ value, onChange }) => {
    const languages: Language[] = [
        { code: 'af', name: 'Afrikaans' },
        { code: 'gsw', name: 'Alsatian' },
        { code: 'ast', name: 'Asturian' },
        { code: 'eu', name: 'Basque' },
        { code: 'br', name: 'Breton' },
        { code: 'ca', name: 'Catalan' },
        { code: 'kw', name: 'Cornish' },
        { code: 'co', name: 'Corsican' },
        { code: 'da', name: 'Danish' },
        { code: 'nl', name: 'Dutch/Flemish' },
        { code: 'frs', name: 'Eastern Frisian' },
        { code: 'en', name: 'English' },
        { code: 'fi', name: 'Finnish' },
        { code: 'fr', name: 'French' },
        { code: 'fy', name: 'Frisian' },
        { code: 'gl', name: 'Galician' },
        { code: 'de', name: 'German' },
        { code: 'is', name: 'Icelandic' },
        { code: 'ga', name: 'Irish' },
        { code: 'it', name: 'Italian' },
        { code: 'lb', name: 'Luxembourgish' },
        { code: 'gv', name: 'Manx' },
        { code: 'no', name: 'Norwegian' },
        { code: 'nb', name: 'Bokmål Norwegian' },
        { code: 'nn', name: 'Nynorsk Norwegian' },
        { code: 'pt', name: 'Portuguese' },
        { code: 'oc', name: 'Provençal' },
        { code: 'rm', name: 'Romansh' },
        { code: 'sco', name: 'Scots' },
        { code: 'gd', name: 'Scottish Gaelic' },
        { code: 'es', name: 'Spanish' },
        { code: 'sv', name: 'Swedish' },
        { code: 'cy', name: 'Welsh' },
    ];

    return (
        <select
            id="language"
            className="metadata-input"
            value={value}
            onChange={onChange}
        >
            {languages.map(language => (
                <option key={language.code} value={language.code}>
                    {language.name}
                </option>
            ))}
        </select>
    );
};

export default LanguageSelect;