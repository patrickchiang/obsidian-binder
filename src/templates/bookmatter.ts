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
    previewMoreTemplate,
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

    let bookmatter = null;
    let body = null;

    if (startIndex !== -1 && endIndex !== -1 && startIndex !== endIndex) {
        const bookmatterLines = lines.slice(startIndex + 1, endIndex);
        bookmatter = bookmatterLines.join('\n').trim();

        const bodyLines = lines.slice(endIndex + 1);
        body = bodyLines.join('\n').trim();
    }

    return {
        bookmatter: bookmatter || '',
        body: body || ''
    };
}

export const convertToPage = (input: string): Page => {
    const firstStage = extractBookmatter(input);
    const secondStage = jsYaml.load(firstStage.bookmatter) as Record<string, string>;
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

    response["Body"] = firstStage.body;

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
---

(Everything is ignored by Binder below this point.)

Instructions:

- Book Name: The title of the book.
- Year: The year of publication.
- Copyright Holder: The name of the copyright holder, usually the author.
- Collaborator #: The role and name of a collaborator. For example, "Cover Art by John Doe." You can add more collaborators by increasing the number.
- ISBN #: ISBN number. For example, "ISBN 123-4-5678-9012-3 (ebook)". You can add more ISBNs by increasing the number.
- Disclaimer: Disclaimer text.
- Publisher #: Publisher name. For example, "Published by My Publishing Company." You can add more publishers by increasing the number.
`;

const dedication = `---
Title: Dedication
Text: This book is dedicated to...
---

(Everything is ignored by Binder below this point.)

Instructions:

- Title: The title of the dedication.
- Text: The text of the dedication.
`;

const epigraph = `---
Quote 1: It was the best of times, it was the worst of times.
Quote 2:
Author: Charles Dickens
Source: A Tale of Two Cities
---

(Everything is ignored by Binder below this point.)

Instructions:

- Quote #: A quote in a paragraph. You can add more paragraphs by increasing the number.
- Author: The author of the quote. Bolded.
- Source: (Optional) The source of the quote. Italics. Can also be location...etc.
`;

const blurbs = `---
Title: Reviews
Blurb 1: A thrilling page-turner!
Source 1: Binders Weekly
Blurb 2: A must-read for fans of the genre.
Source 2: My Mom
Blurb 3:
Source 3:
---

(Everything is ignored by Binder below this point.)

Instructions:

- Title: The title of the blurb section.
- Blurb #: A blurb in a paragraph. You can add more blurbs by increasing the number.
- Source #: The source of the blurb. Bolded. You should have the same number of sources as blurbs.
`;

const halfTitle = `---
Title: Book Title
---

(Everything is ignored by Binder below this point.)

Instructions:

- Title: The title of the book.
`;

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
---

(Everything is ignored by Binder below this point.)

Instructions:

- Title: The title of the book.
- Subtitle: The subtitle of the book.
- Author Name #: The name of the author. You can add more authors by increasing the number. They will be displayed in order side-by-side.
- Collaborator Role #: The role of a collaborator. For example, "Cover Art". You can add more roles by increasing the number. Bolded.
- Collaborator Name #: The name of a collaborator. For example, "John Doe". You can add more names by increasing the number. You should have the same number of roles and names.
- Publisher: The name of the publisher.
- Publisher Link: (Optional) A link to the publisher's website.
`;

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
Link To Apple:
Link To Audible:
Link To Facebook:
Link To Patreon:
Link To Royal Road:
Link To Twitter:
Link To Website:
---

(Everything is ignored by Binder below this point.)

Instructions:

- Title: The title of the about the author section.
- About Author #: A paragraph about the author. You can add more paragraphs by increasing the number.
- Link To X: (Optional) A link to the author's social media page.
`;

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
---

(Everything is ignored by Binder below this point.)

Instructions:

- Title: The title of the also by section.
- Book #: The title of a book. You can add more books by increasing the number.
- Link #: A link to the book. You can add more links by increasing the number.
- Description #: A description of the book. You can add more descriptions by increasing the number. You should have the same number of books and links and descriptions.
`;

const previewMore = `---
Title: Preview More
Book: Book Title 1
Link: https://www.amazon.com/myotherbook1
Description: Description of Book 1
---

Remove this line and put the rest of the preview in the markdown:

# Chapter 1

Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
`;

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
    },
    {
        title: "Preview More",
        yaml: previewMore,
        template: pug.compile(previewMoreTemplate, options)
    }
];