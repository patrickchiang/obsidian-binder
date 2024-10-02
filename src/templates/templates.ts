// Frontmatter

export const copyrightTemplate = `
div(class='copyright-page sp')
    p(class='sp') #{data["Book Name"]} &copy; #{data["Year"]} #{data["Copyright Holder"]}.
    p(class='sp') All rights reserved.
    each val in data["Collaborators"]
        p(class='sp') #{val}
    each val in data["ISBNs"]
        p(class='sp') #{val}
    p(class='sp') #{data["Disclaimer"]}
    each val in data["Publishers"]
        p(class='sp') #{val}
`;

export const dedicationTemplate = `
div(class='dedication-page sp')
    h1(class='sp') #{data["Title"]}
    p(class='dedication sp') #{data["Text"]}
`;

export const epigraphTemplate = `
div(class='epigraph-page sp')
    each val in data["Quotes"]
        p(class='quote sp') #{val}
    p(class='attribution sp')
        if data["Source"]
            span(class='author') #{data["Author"]},&nbsp;
            span(class='source') #{data["Source"]}
        else
            span(class='author') #{data["Author"]}
`;

export const blurbTemplate = `
div(class='blurb-page sp')
    h1(class='sp') #{data["Title"]}
    each val, i in data["Blurbs"]
        p(class='blurb sp') #{data["Blurbs"][i]}
        p(class='source sp') #{data["Sources"][i]}
`;

export const halfTitleTemplate = `
div(class='half-title-page sp')
    h1(class='sp') #{data["Title"]}
`;

export const titlePageTemplate = `
div(class='title-page sp')
    h1(class='sp') #{data["Title"]}
    p(class='subtitle sp') #{data["Subtitle"]}
    p(class='authors sp')
        each val in data["Author Names"]
            span(class='author sp') #{val}
    div(class='collaborators sp')
        each val, i in data["Collaborator Roles"]
            p(class='collaborator-role sp') #{data["Collaborator Roles"][i]}
            p(class='collaborator-name sp') #{data["Collaborator Names"][i]}
    p(class='publisher sp')
        if data["Publisher Link"]
            a(href=data["Publisher Link"] class='sp') #{data["Publisher"]}
        else
            span(class='sp') #{data["Publisher"]}
`;

// Backmatter

export const aboutAuthorTemplate = `
div(class='about-author-page sp')
    h1(class='sp') #{data["Title"]}
    div(class='about-author sp')
        each val in data["About Authors"]
            p(class='sp') #{val}
    div(class='links sp')
        each val in Object.keys(storeLinkers)
            if data["Link To " + val]
                a(href=data["Link To " + val] class='sp binder-store-link') !{storeLinkers[val]}
                    span(class='sp label') #{val}
                div(class='sp')
`;

export const alsoByTemplate = `
div(class='also-by-page sp')
    h1(class='sp') #{data["Title"]}
    each val, i in data["Books"]
        p(class='sp book-title')
            a(href=data["Links"][i] class='sp') #{val}
        p(class='sp book-description') #{data["Descriptions"][i]}
`;