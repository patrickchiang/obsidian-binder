export const _all = `
body {
    word-wrap: break-word;
}

p {
    font-size: 1em;
    text-align: justify;
    text-indent: 0;
    margin-top: 0;
    margin-bottom: 0.5em;
    line-height: 1.5em;
}

section.frontmatter {
    text-align: center;
}

span.frontmatter {
    display: none;
}

li.frontmatter {
    margin-bottom: 1em;
}

li.backmatter {
    margin-top: 1em;
}

span.backmatter {
    display: none;
}

.copyright-page p {
    margin-top: 0;
    text-align: center;
}

.copyright-page {
    margin-top: 5em;
    font-size: 1em;
}

.dedication-page {
    margin-top: 5em;
    text-align: center;
}

.dedication-page .dedication {
    text-align: center;
}

.epigraph-page .source {
    font-style: italic;
}

.epigraph-page .author {
    font-weight: bold;
}

.epigraph-page {
    margin-top: 5em;
}

.epigraph-page .quote {
    text-align: left;
}

.epigraph-page .attribution {
    text-align: right;
}

.blurb-page h1 {
    text-align: center;
}

.blurb-page .blurb {
    margin-top: 3em;
    text-align: center;
}

.blurb-page .source {
    font-weight: bold;
    text-align: center;
}

.half-title-page h1 {
    margin-top: 4em;
    text-align: center;
    font-weight: bold;
    font-size: 250%;
}

.title-page h1 {
    margin-top: 3em;
    text-align: center;
    font-weight: bold;
    font-size: 250%;
}

.title-page .subtitle {
    text-align: center;
    font-size: 200%;
}

.title-page .authors {
    margin-top: 5em;
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    gap: 1em;
    text-align: center;
}

.title-page .author {
    font-weight: bold;
    font-size: 180%;
    text-align: center;
}

.title-page .collaborators {
    margin-top: 4em;
}

.title-page .collaborator-role {
    font-size: 80%;
    margin: 0;
    text-align: center;
}

.title-page .collaborator-name {
    font-size: 100%;
    font-weight: bold;
    margin-top: 0;
    margin-bottom: 2em;
    text-align: center;
}

.title-page .publisher {
    margin-top: 5em;
    text-align: center;
}

.about-author-page h1 {
    text-align: center;
}

.about-author-page p {
    text-align: justify;
}

.about-author-page .links {
    margin-top: 3em;
}

.about-author-page .label {
    display: inline-block;
    text-align: left;
}

.binder-store-link {
    margin: 1em;
    display: grid;
    grid-template-columns: auto 1fr;
    grid-gap: 3em;
    align-items: center;
}

.binder-store-link svg {
    height: 3em;
    width: 3em;
    display: inline-block;
    // border: blue 3px solid;
    padding: 0.5em;
    border-radius: 50%;
}

.also-by-page h1 {
    text-align: center;
}

.also-by-page .book-title {
    text-align: center;
    margin-top: 3em;
    font-weight: bold;
}
`;