import { CircleHelp } from 'lucide-react';
import PropTypes from 'prop-types';
import { useEffect, useRef, useState } from 'react';

interface HelperTooltipProps {
    children: React.ReactNode;
}

const HelperTooltip: React.FC<HelperTooltipProps> = ({ children }) => {
    const spanRef = useRef<HTMLSpanElement>(null);
    const [iconSize, setIconSize] = useState<number | undefined>(undefined);

    useEffect(() => {
        if (spanRef.current && spanRef.current.parentElement) {
            const computedStyle = window.getComputedStyle(spanRef.current.parentElement);
            const lineHeight = computedStyle.fontSize;
            const parsedLineHeight = parseFloat(lineHeight);
            setIconSize(parsedLineHeight || undefined);
        }
    }, []);

    return (
        <span aria-label={String(children)} className="binder-tooltip-helper" ref={spanRef}>
            <CircleHelp size={iconSize} />
        </span>
    );
};

HelperTooltip.propTypes = {
    children: PropTypes.node.isRequired,
};

export default HelperTooltip;
