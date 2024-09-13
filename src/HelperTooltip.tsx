import PropTypes from 'prop-types';
import { CircleHelp } from 'lucide-react';

interface HelperTooltipProps {
    children: React.ReactNode;
}

const HelperTooltip: React.FC<HelperTooltipProps> = ({ children }) => {
    return (
        <CircleHelp
            data-tooltip-id="helper-tooltip"
            data-tooltip-content={children}
            data-tooltip-place="bottom"
            data-tooltip-position-strategy="fixed"
            size={12} />
    );
};

HelperTooltip.propTypes = {
    children: PropTypes.node.isRequired,
};

export default HelperTooltip;
