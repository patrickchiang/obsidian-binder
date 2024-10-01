export const baseTheme = `
/* Base Styles */
body {
    word-wrap: break-word;
}

p {
    font-size: 1em;
    text-align: justify;
    text-indent: 0;
}

section:not(.front-matter-page, .back-matter-page) p.first-paragraph:first-letter {
    font-weight: normal;
    font-size: 150%;
    float: left;
    margin-top: -0.3225em;
    margin-bottom: -0.3245em;
}

section:not(.front-matter-page, .back-matter-page) p.first-paragraph .first-word {
    color: green;
}

section:not(.front-matter-page, .back-matter-page) p.first-paragraph .first-four-words {
    font-weight: bold;
}

section:not(.front-matter-page, .back-matter-page) p.first-paragraph:first-line {
    text-transform: uppercase;
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
    font-size: 1.5rem;
    margin-top: 0;
    margin-bottom: 3rem;
}

.chapter-word {
    display: none;
}

// .chapter-number-numeric {
//     display: none;
// }

.chapter-number-text {
    display: none;
}

.horizontal-rule {
    text-align: center;
    font-size: 1rem;
    margin-top: 0.8rem;
    margin-bottom: 0;
    font-weight: bold;
}

.horizontal-rule::before {
    content: "* * *";
}
`;