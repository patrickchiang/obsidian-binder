import jsYaml from "js-yaml";
import pug from "pug";
import {
    aboutAuthorTemplate,
    alsoByTemplate,
    blurbTemplate,
    copyrightTemplate,
    dedicationTemplate,
    epigraphTemplate,
    halfTitleTemplate,
    titlePageTemplate
} from "./templates.js";

interface Page {
    [key: string]: string | string[];
}

export interface Matter {
    title: string;
    yaml: string;
    template: pug.compileTemplate;
}

const options = {
    pretty: true
};

const extractBookmatter = (mdContent: string) => {
    const lines = mdContent.split('\n');

    let startIndex = -1;
    let endIndex = -1;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '---') {
            if (startIndex === -1) {
                startIndex = i;
            } else {
                endIndex = i;
                break;
            }
        }
    }

    if (startIndex !== -1 && endIndex !== -1 && startIndex !== endIndex) {
        const bookmatterLines = lines.slice(startIndex + 1, endIndex);
        return bookmatterLines.join('\n').trim();
    }

    return "";
}

export const convertToPage = (input: string): Page => {
    const firstStage = extractBookmatter(input);
    const secondStage = jsYaml.load(firstStage) as Record<string, string>;
    const response: Page = {};
    for (const [key, value] of Object.entries(secondStage)) {
        const splitKey = key.split(" ");
        const lastPart = splitKey[splitKey.length - 1];

        if (!isNaN(parseInt(lastPart))) {
            const baseKey = splitKey.slice(0, -1).join(" ") + "s";

            if (!response[baseKey]) {
                response[baseKey] = [];
            }

            if (value && value !== "") {
                (response[baseKey] as string[]).push(value);
            }
        } else {
            response[key] = value || "";
        }
    }
    return response;
};

const copyright = `---
Book Name:
Year: "2024"
Copyright Holder: Author Name
Collaborator 1: Cover Art by
Collaborator 2: Illustration by
Collaborator 3:
ISBN 1:
ISBN 2:
Disclaimer: This is a work of fiction. Names, characters, places and incidents either are products of the author’s imagination or are used fictitiously. Any resemblance to actual events or locales or persons, living or dead, is entirely coincidental.
Publisher 1: Published by
Publisher 2:
---`;

const dedication = `---
Title: Dedication
Text: This book is dedicated to...
---`;

const epigraph = `---
Quote 1: It was the best of times, it was the worst of times.
Quote 2:
Author: Charles Dickens
Source: A Tale of Two Cities
---`;

const blurbs = `---
Title: Reviews
Blurb 1: A thrilling page-turner!
Source 1: Binders Weekly
Blurb 2: A must-read for fans of the genre.
Source 2: My Mom
Blurb 3:
Source 3:
---`;

const halfTitle = `---
Title: Book Title
---`;

const titlePage = `---
Title: Book Title
Subtitle: Subtitle
Author Name 1: Author Name
Author Name 2:
Collaborator Role 1: Cover Art
Collaborator Name 1: Artist McArtface
Collaborator Role 2: Edited by
Collaborator Name 2: My Editor
Collaborator Role 3:
Collaborator Name 3:
Publisher: Publisher Name
Publisher Link: https://www.publisher.com
---`;

export const frontmatters: Matter[] = [
    {
        title: "Copyright",
        yaml: copyright,
        template: pug.compile(copyrightTemplate, options)
    },
    {
        title: "Dedication",
        yaml: dedication,
        template: pug.compile(dedicationTemplate, options)
    },
    {
        title: "Epigraph",
        yaml: epigraph,
        template: pug.compile(epigraphTemplate, options)
    },
    {
        title: "Blurbs",
        yaml: blurbs,
        template: pug.compile(blurbTemplate, options)
    },
    {
        title: "Title Page",
        yaml: titlePage,
        template: pug.compile(titlePageTemplate, options)
    },
    {
        title: "Half Title",
        yaml: halfTitle,
        template: pug.compile(halfTitleTemplate, options)
    }
];

const aboutAuthor = `---
Title: About the Author
About Author 1: Author Name is the author of Book Name. Introduce other books/series here.
About Author 2: Something personal.
About Author 3:
Link To Amazon: https://www.amazon.com/author/authorname
Link To Apple: https://books.apple.com/author/authorname
Link To Audible: https://www.audible.com/author/authorname
Link To Facebook: https://www.facebook.com/authorname
Link To Patreon: https://www.patreon.com/authorname
Link To Royal Road: https://www.royalroad.com/author/authorname
Link To Twitter:
Link To Website:
---`;

const alsoBy = `---
Title: Also By Author Name
Book 1: Book Title 1
Link 1: https://www.amazon.com/myotherbook1
Description 1: Description of Book 1
Book 2: Book Title 2
Link 2: https://www.amazon.com/myotherbook2
Description 2: Description of Book 2
Book 3:
Link 3:
Description 3:
---`;

export const backmatters: Matter[] = [
    {
        title: "About the Author",
        yaml: aboutAuthor,
        template: pug.compile(aboutAuthorTemplate, options)
    },
    {
        title: "Also By Author",
        yaml: alsoBy,
        template: pug.compile(alsoByTemplate, options)
    }
];