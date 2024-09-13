export const STYLE = `
/* Base Styles */
body {
    line-height: 1.6;
    padding: 5%;
}

h1 {
    font-size: 2em;
    margin-top: 0.67em;
    margin-bottom: 0.67em;
}

h2 {
    font-size: 1.5em;
    margin-top: 0.83em;
    margin-bottom: 0.83em;
}

p {
    margin: 0.8em 0;
}

/* Image styles */
img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 0 auto; /* Centers image */
}

/* Link styles */
a {
    color: #1a0dab;
    text-decoration: none;
}

a:hover {
    text-decoration: underline;
}

/* Table of Contents */
.nav {
    margin-top: 1em;
    margin-bottom: 1em;
}

.nav a {
    padding: 0.5em;
    display: inline-block; /* makes the links align in a line on large screens */
}

/* Misc Elements */
ul, ol {
    padding-left: 20px;
}

blockquote {
    font-style: italic;
    margin: 1em 20px;
    padding: 0.5em 10px;
    border-left: 3px solid #ccc;
}

hr {
    border: 0;
    height: 1px;
    background-image: linear-gradient(to right, #bbb, #333, #bbb);
}

/* Responsive design adjustments */
@media (max-width: 600px) {
    body {
        padding: 10px;
    }

    h1 {
        font-size: 1.5em;
    }

    h2 {
        font-size: 1.3em;
    }
}
`;