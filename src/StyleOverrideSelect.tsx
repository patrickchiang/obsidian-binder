import React from 'react';
import { _all } from './themes/components/all.js';
import { _dropcap1, _dropcap2, _dropcap3 } from './themes/components/dropcap.js';
import {
    _hrAsterisks3,
    _hrDotted,
    _hrDotted30,
    _hrDotted50,
    _hrDotted80,
    _hrDouble,
    _hrDouble30,
    _hrDouble50,
    _hrDouble80,
    _hrGroove,
    _hrGroove30,
    _hrGroove50,
    _hrGroove80,
    _hrRidge,
    _hrRidge30,
    _hrRidge50,
    _hrRidge80,
    _hrThick,
    _hrThick30,
    _hrThick50,
    _hrThick80,
    _hrThin,
    _hrThin30,
    _hrThin50,
    _hrThin80,
} from './themes/components/hr.js';
import { _indent1, _indent2 } from './themes/components/indent.js';
import { _toc1, _toc2, _toc3 } from './themes/components/toc.js';
import { _tocBmShow, _tocBmHide } from './themes/components/toc-bm.js';
import { _tocFmShow, _tocFmHide } from './themes/components/toc-fm.js';

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
        identifier: '_hrAsterisks3',
        style: _hrAsterisks3
    },
    {
        name: 'Thin Line',
        identifier: '_hrThin',
        style: _hrThin
    },
    {
        name: 'Thin Line 80%',
        identifier: '_hrThin80',
        style: _hrThin80
    },
    {
        name: 'Thin Line 50%',
        identifier: '_hrThin50',
        style: _hrThin50
    },
    {
        name: 'Thin Line 30%',
        identifier: '_hrThin30',
        style: _hrThin30
    },
    {
        name: 'Thick Line',
        identifier: '_hrThick',
        style: _hrThick
    },
    {
        name: 'Thick Line 80%',
        identifier: '_hrThick80',
        style: _hrThick80
    },
    {
        name: 'Thick Line 50%',
        identifier: '_hrThick50',
        style: _hrThick50
    },
    {
        name: 'Thick Line 30%',
        identifier: '_hrThick30',
        style: _hrThick30
    },
    {
        name: 'Dotted Line',
        identifier: '_hrDotted',
        style: _hrDotted
    },
    {
        name: 'Dotted Line 80%',
        identifier: '_hrDotted80',
        style: _hrDotted80
    },
    {
        name: 'Dotted Line 50%',
        identifier: '_hrDotted50',
        style: _hrDotted50
    },
    {
        name: 'Dotted Line 30%',
        identifier: '_hrDotted30',
        style: _hrDotted30
    },
    // Grooved Line 100/80/50/30, Double..., Ridge...
    {
        name: 'Grooved Line',
        identifier: '_hrGroove',
        style: _hrGroove
    },
    {
        name: 'Grooved Line 80%',
        identifier: '_hrGroove80',
        style: _hrGroove80
    },
    {
        name: 'Grooved Line 50%',
        identifier: '_hrGroove50',
        style: _hrGroove50
    },
    {
        name: 'Grooved Line 30%',
        identifier: '_hrGroove30',
        style: _hrGroove30
    },
    {
        name: 'Double Line',
        identifier: '_hrDouble',
        style: _hrDouble
    },
    {
        name: 'Double Line 80%',
        identifier: '_hrDouble80',
        style: _hrDouble80
    },
    {
        name: 'Double Line 50%',
        identifier: '_hrDouble50',
        style: _hrDouble50
    },
    {
        name: 'Double Line 30%',
        identifier: '_hrDouble30',
        style: _hrDouble30
    },
    {
        name: 'Ridge Line',
        identifier: '_hrRidge',
        style: _hrRidge
    },
    {
        name: 'Ridge Line 80%',
        identifier: '_hrRidge80',
        style: _hrRidge80
    },
    {
        name: 'Ridge Line 50%',
        identifier: '+hrRidge50',
        style: _hrRidge50
    },
    {
        name: 'Ridge Line 30%',
        identifier: '_hrRidge30',
        style: _hrRidge30
    },
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

export const toc: StyleOverride[] = [
    {
        name: 'Centered',
        identifier: '_toc1',
        style: _toc1
    },
    {
        name: 'Left Aligned',
        identifier: '_toc2',
        style: _toc2
    },
    {
        name: 'Right Aligned',
        identifier: '_toc3',
        style: _toc3
    }
];

export const tocFm: StyleOverride[] = [
    {
        name: 'Include Frontmatter',
        identifier: '_tocFmShow',
        style: _tocFmShow
    },
    {
        name: 'Exclude Frontmatter',
        identifier: '_tocFmHide',
        style: _tocFmHide
    }
];

export const tocBm: StyleOverride[] = [
    {
        name: 'Include Backmatter',
        identifier: '_tocBmShow',
        style: _tocBmShow
    },
    {
        name: 'Exclude Backmatter',
        identifier: '_tocBmHide',
        style: _tocBmHide
    }
];

export const styleOverrideDefaults = ['_toc1', '_tocBmShow', '_tocFmShow'];
const allStyleOverrides = [...dropcaps, ...horizontalRules, ...indents, ...toc, ...tocFm, ...tocBm];

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