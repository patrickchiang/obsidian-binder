import { App, TAbstractFile, TFile } from "obsidian";
import BinderPlugin from "./main.js";

export interface BookChapter {
    title: string;
    file: TFile;
    include: boolean;
    excludeFromContents: boolean;
    isFrontMatter: boolean;
    isBackMatter: boolean;
}

export interface BookStoredChapter {
    title: string;
    file: string;
    include: boolean;
    excludeFromContents: boolean;
    isFrontMatter: boolean;
    isBackMatter: boolean;
}

export interface BookMetadata {
    title: string;
}

export interface BookData {
    metadata: BookMetadata;
    chapters: BookStoredChapter[];
}

export interface BinderModalProps {
    folder: TAbstractFile;
    app: App;
    plugin: BinderPlugin;
}