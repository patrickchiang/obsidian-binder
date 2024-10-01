export const monoTheme = `
/* Base Styles */
body {
    font-family: monospace;
    word-wrap: break-word;
}

p {
    font-size: 1em;
    text-align: justify;
    text-indent: 0;
}

.chapter-number{
    text-align: center;
    margin-top: 1rem;
    margin-bottom: 0;
    font-size: 4rem;
    text-transform: uppercase;
}

.chapter-title {
    text-align: center;
    font-size: 2.4rem;
    margin-top: 0;
    margin-bottom: 3rem;
}

.chapter-word {
    font-size: 1.9rem;
}

.chapter-number-numeric {
    display: none;
}

.chapter-number-text {
    font-size: 1.9rem;
}

.chapter-title-divider {
    border-top: 3px solid #000;
    margin-top: 1rem;
    margin-bottom: 1rem;
    margin-left: 20%;
    margin-right: 20%;
}

.horizontal-rule {
    text-align: center;
    font-size: 1rem;
    margin-top: 0.8rem;
    margin-bottom: 0;
    font-weight: bold;
}

.horizontal-rule::before {
    content: "+ + + + +";
}
`;