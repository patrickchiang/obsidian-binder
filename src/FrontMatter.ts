import { App, TFolder } from "obsidian";

import * as copyright from "./templates/copyright.js";
import * as findme from "./templates/findme.js";
import * as otherbooks from "./templates/otherbooks.js";
import * as previewbook from "./templates/previewbook.js";
import * as aboutauthor from "./templates/aboutauthor.js";

const openFile = async (app: App, filePath: string) => {
    const file = app.vault.getFileByPath(filePath);
    if (file) {
        app.workspace.getLeaf("tab").openFile(file);
    }
}

export const frontMatter = {
    createCopyright: async (app: App, folder: TFolder) => {
        const filePath = folder.path + "/000 Copyright.md";
        await app.vault.create(filePath, copyright.markdown);
        openFile(app, filePath);
    },
    createFindMe: async (app: App, folder: TFolder) => {
        const filePath = folder.path + "/000 Find Me Online.md";
        await app.vault.create(filePath, findme.markdown);
        openFile(app, filePath);
    },
    createOtherBooks: async (app: App, folder: TFolder) => {
        const filePath = folder.path + "/999 Other Books.md";
        await app.vault.create(filePath, otherbooks.markdown);
        openFile(app, filePath);
    },
    createPreviewBook: async (app: App, folder: TFolder) => {
        const filePath = folder.path + "/999 Preview Book.md";
        await app.vault.create(filePath, previewbook.markdown);
        openFile(app, filePath);
    },
    createAboutAuthor: async (app: App, folder: TFolder) => {
        const filePath = folder.path + "/999 About the Author.md";
        await app.vault.create(filePath, aboutauthor.markdown);
        openFile(app, filePath);
    }
};
