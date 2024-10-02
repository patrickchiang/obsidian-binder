import { App, Notice, TFolder } from "obsidian";

import * as copyright from "./templates/copyright.js";
import * as findme from "./templates/findme.js";
import * as dedication from "./templates/dedication.js";
import * as otherbooks from "./templates/otherbooks.js";
import * as previewbook from "./templates/previewbook.js";
import * as aboutauthor from "./templates/aboutauthor.js";

const openFile = async (app: App, folder: TFolder, fileName: string, markdown: string) => {
    const filePath = folder.path + "/" + fileName;
    if (app.vault.getFileByPath(filePath)) {
        new Notice(`File ${fileName} already exists in ${folder.path}.`);
    }
    await app.vault.create(filePath, markdown);
    const file = app.vault.getFileByPath(filePath);
    if (file) {
        app.workspace.getLeaf("tab").openFile(file);
    }
}

export const frontMatter = {
    createCopyright: async (app: App, folder: TFolder) => {
        const fileName = "000 Copyright.md";
        const markdown = copyright.markdown;
        openFile(app, folder, fileName, markdown);
    },
    createFindMe: async (app: App, folder: TFolder) => {
        const fileName = "000 Find Me Online.md";
        const markdown = findme.markdown;
        openFile(app, folder, fileName, markdown);
    },
    createDedication: async (app: App, folder: TFolder) => {
        const fileName = "000 Dedication.md";
        const markdown = dedication.markdown;
        openFile(app, folder, fileName, markdown);
    },
    createOtherBooks: async (app: App, folder: TFolder) => {
        const fileName = "999 Other Books.md";
        const markdown = otherbooks.markdown;
        openFile(app, folder, fileName, markdown);
    },
    createPreviewBook: async (app: App, folder: TFolder) => {
        const fileName = "999 Preview Book.md";
        const markdown = previewbook.markdown;
        openFile(app, folder, fileName, markdown);
    },
    createAboutAuthor: async (app: App, folder: TFolder) => {
        const fileName = "999 About the Author.md";
        const markdown = aboutauthor.markdown;
        openFile(app, folder, fileName, markdown);
    }
};
