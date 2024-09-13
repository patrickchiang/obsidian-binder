export interface BookStyle {
    width: string;
    height: string;

    insideMargin: string;
    outsideMargin: string;
    verticalMargin: string;

    fontSize: string;
    fontFamily: string;

    lineHeight: string;
}

export const defaultStyle: BookStyle = {
    width: "5in",
    height: "8in",

    insideMargin: "0.875in",
    outsideMargin: "0.25in",
    verticalMargin: "0.5in",
    
    fontSize: "12px",
    fontFamily: "Bookerly, sans-serif",
    
    lineHeight: "22px"
}

export const makeStylesheet = (setting: BookStyle) => `
:root {
    font-size: ${setting.fontSize};
}

@page {
    size: ${setting.width} ${setting.height};
    margin-top: ${setting.verticalMargin};
    margin-bottom: ${setting.verticalMargin};
}

@page :left {
    margin-left: ${setting.insideMargin};
    margin-right: ${setting.outsideMargin};
    
    @top-left {
        vertical-align: center;
        content: counter(page);
    }
}

@page :right {
    margin-left: ${setting.outsideMargin};
    margin-right: ${setting.insideMargin};
    
    @top-right {
        vertical-align: center;
        content: counter(page);
    }
}

section {
    break-before: page;
}

p {
    line-height: ${setting.lineHeight};
}

h1 {
    font-size: 24px;
}

.pagedjs_pages {
    font-family: ${setting.fontFamily};
}

.pagedjs_pages p.dropcap:first-letter {
    color: #903;
    float: left;
    font-family: Georgia;
    font-size: 75px;
    line-height: 60px;
    padding-top: 4px;
    padding-right: 8px;
    padding-left: 3px;
}
`;