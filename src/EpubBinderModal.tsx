import React, { useState, useCallback } from 'react';
import { App, FileSystemAdapter, MarkdownRenderer, Modal, Notice, TAbstractFile, TFile, TFolder, requestUrl } from 'obsidian';
import { createRoot } from 'react-dom/client';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Tooltip } from 'react-tooltip';
import yaml from 'js-yaml';
import { v4 as uuid } from 'uuid';
import fs from 'fs';
import path from 'path';

import Epub, { Metadata, Resource, Section } from 'nodepub';

import LanguageSelect from './LanguageSelect.js';
import HelperTooltip from './HelperTooltip.js';
import BinderPlugin from './main.js';
import { BinderModalProps, BookChapter, BookData, BookMetadata, BookStoredChapter } from './BookStructure.js';

interface EpubMetadata extends BookMetadata {
    cover: string;
    author: string;
    identifier: string;
    language: string;

    description: string;
    series: string;
    sequence: number;
    fileAs: string;
    genre: string;
    tags: string;
    copyright: string;
    publisher: string;
    published: string;
    transcriptionSource: string;

    showContents: boolean;
    tocTitle: string;
    startReading: boolean;
}

export class BinderEpubIntegrationModal extends Modal {
    folder: TAbstractFile;
    plugin: BinderPlugin;
    reactRoot: ReturnType<typeof createRoot> | null = null;

    constructor(app: App, folder: TAbstractFile, plugin: BinderPlugin) {
        super(app);
        this.folder = folder;
        this.plugin = plugin;
    }

    onOpen() {
        const { contentEl } = this;

        // this.modalEl.addClass('binder-modal');

        const reactContainer = contentEl.createDiv();
        this.reactRoot = createRoot(reactContainer);
        this.reactRoot.render(<EpubBinderModal app={this.app} folder={this.folder} plugin={this.plugin} />);
    }

    onClose() {
        if (this.reactRoot) {
            this.reactRoot.unmount();
        }
    }
}

const TEMP_FOLDER_NAME = 'obsidian-binder-epub-temp';
const SAVE_FILE_NAME = 'obsidian-binder-epub-last-save.yaml';

const EpubBinderModal: React.FC<BinderModalProps> = ({ app, folder, plugin }) => {
    const getBasePath = () => {
        const adapter = app.vault.adapter;
        if (adapter instanceof FileSystemAdapter) {
            return adapter.getBasePath();
        }
        return "";
    }

    const getYamlPath = () => {
        return path.join(getBasePath(), folder.path, SAVE_FILE_NAME);
    }

    const naturalSort = (a: string, b: string): number => {
        return a.localeCompare(b, undefined, {
            numeric: true,
            sensitivity: 'base'
        });
    }

    const saveToYaml = (metadata: EpubMetadata, chapters: BookChapter[]) => {
        if (plugin.settings.persistSettings === false) return;

        const data: BookData = {
            metadata: metadata,
            chapters: chapters.map(chapter => ({
                title: chapter.title,
                file: chapter.file.path,
                include: chapter.include,
                excludeFromContents: chapter.excludeFromContents,
                isFrontMatter: chapter.isFrontMatter
            }))
        };

        const yamlStr = yaml.dump(data);
        const filePath = getYamlPath();
        fs.writeFileSync(filePath, yamlStr, 'utf8');
    };

    const getFilesInFolder = (folder: TFolder): TFile[] => {
        const markdownFiles: TFile[] = [];

        const scanFolder = (currentFolder: TFolder) => {
            const children = currentFolder.children;
            for (const child of children) {
                if (child instanceof TFile && child.extension === 'md') {
                    markdownFiles.push(child);
                } else if (child instanceof TFolder) {
                    scanFolder(child);
                }
            }
        };

        scanFolder(folder);

        return markdownFiles.sort((a, b) => naturalSort(a.basename, b.basename));
    }

    const files = getFilesInFolder(folder as TFolder);

    const loadFromYaml = () => {
        const defaultBookData = {
            metadata: {
                title: app.vault.getName(),
                cover: '',
                author: '',
                identifier: '',
                language: 'en',

                description: '',
                series: '',
                sequence: -1,
                fileAs: '',
                genre: '',
                tags: '',
                copyright: '',
                publisher: '',
                published: '',
                transcriptionSource: '',


                showContents: true,
                tocTitle: '',
                startReading: true,
            },
            chapters: files.map(file => ({
                title: file.basename,
                file,
                include: true,
                excludeFromContents: false,
                isFrontMatter: false,
            }))
        };

        if (plugin.settings.persistSettings === false) return defaultBookData;

        try {
            const filePath = getYamlPath();
            if (fs.existsSync(filePath) === false) {
                return defaultBookData;
            }

            const yamlStr = fs.readFileSync(filePath, 'utf8');
            const data = yaml.load(yamlStr) as BookData;

            let chapters: BookChapter[];
            if (data.chapters.length === files.length &&
                data.chapters.every(chapter => files.some(file => file.path === chapter.file))) {
                chapters = data.chapters.map((chapter: BookStoredChapter) => {
                    const file = files.find(file => file.path === chapter.file) as TFile;
                    return {
                        title: chapter.title,
                        file: file,
                        include: chapter.include,
                        excludeFromContents: chapter.excludeFromContents,
                        isFrontMatter: chapter.isFrontMatter,
                    };
                });
            } else {
                chapters = files.map(file => {
                    const storedChapter = data.chapters.find((chapter: BookStoredChapter) => chapter.file === file.path);
                    return {
                        title: storedChapter?.title || file.basename,
                        file,
                        include: storedChapter?.include || true,
                        excludeFromContents: storedChapter?.excludeFromContents || false,
                        isFrontMatter: storedChapter?.isFrontMatter || false,
                    };
                });
            }

            return {
                metadata: data.metadata as EpubMetadata,
                chapters: chapters as BookChapter[],
            };
        } catch (error) {
            new Notice('Error reading or parsing YAML file:', error);
            return defaultBookData;
        }
    };

    const loadedData = loadFromYaml();

    const useMetadata = () => {
        const [metadata, setMetadata] = useState<EpubMetadata>(loadedData.metadata);

        const updateMetadata = useCallback((field: keyof EpubMetadata, value: string | number | boolean) => {
            setMetadata(prev => {
                const newMetadata = ({ ...prev, [field]: value });
                saveToYaml(newMetadata, chapters);
                return newMetadata;
            });
        }, []);

        return { metadata, updateMetadata };
    };

    const useChapters = () => {
        const [chapters, setChapters] = useState<BookChapter[]>(loadedData.chapters);

        const updateChapters = (updateFn: (prevChapters: BookChapter[]) => BookChapter[]) => {
            setChapters(prevChapters => {
                const newChapters = updateFn(prevChapters);
                saveToYaml(metadata, newChapters);
                return newChapters;
            });
        };

        const reorderChapters = useCallback((sourceIndex: number, targetIndex: number) => {
            if (sourceIndex === targetIndex) return;
            updateChapters(prevChapters => {
                const newChapters = [...prevChapters];
                const [reorderedItem] = newChapters.splice(sourceIndex, 1);
                newChapters.splice(targetIndex, 0, reorderedItem);
                return newChapters;
            });
        }, []);

        const onDragEnd = useCallback((result: DropResult) => {
            if (!result.destination) return;
            reorderChapters(result.source.index, result.destination.index);
        }, [reorderChapters]);

        const toggleChapterProperty = useCallback((index: number, property: keyof BookChapter, value: boolean) => {
            updateChapters(prevChapters => prevChapters.map((chapter, i) =>
                i === index ? { ...chapter, [property]: value } : chapter
            ));
        }, []);

        const changeChapterTitle = useCallback((index: number, title: string) => {
            updateChapters(prevChapters => prevChapters.map((chapter, i) =>
                i === index ? { ...chapter, title } : chapter
            ));
        }, []);

        const selectAllChapters = useCallback(() => {
            updateChapters(prevChapters => prevChapters.map(chapter => ({ ...chapter, include: true })));
        }, []);

        const selectNoneChapters = useCallback(() => {
            updateChapters(prevChapters => prevChapters.map(chapter => ({ ...chapter, include: false })));
        }, []);

        const removeChapterNumbers = useCallback(() => {
            updateChapters(prevChapters => prevChapters.map(chapter => ({
                ...chapter,
                title: chapter.title.replace(/^\d*/, '').trim()
            })));
        }, []);

        const removeFirstChapterWord = useCallback(() => {
            updateChapters(prevChapters => prevChapters.map(chapter => ({
                ...chapter,
                title: chapter.title.replace(/^\S+/, '').trim()
            })));
        }, []);

        const restoreChapterTitle = useCallback(() => {
            updateChapters(prevChapters => prevChapters.map(chapter => ({
                ...chapter,
                title: chapter.file.basename
            })));
        }, []);

        const setNumberedChapters = useCallback(() => {
            updateChapters(prevChapters => {
                return prevChapters.reduce((acc, chapter) => {
                    if (!chapter.include || chapter.isFrontMatter) {
                        acc.updatedChapters.push(chapter);
                    } else {
                        acc.i++;
                        acc.updatedChapters.push({ ...chapter, title: acc.i.toString() });
                    }
                    return acc;
                }, { i: 0, updatedChapters: [] as typeof prevChapters }).updatedChapters
            });
        }, []);

        const sortChapterByTitle = useCallback(() => {
            updateChapters(prevChapters => prevChapters.slice().sort((a, b) => a.title.localeCompare(b.title)));
        }, []);

        const reverseChapterOrder = useCallback(() => {
            updateChapters(prevChapters => prevChapters.slice().reverse());
        }, []);

        const restoreChapterOrder = useCallback(() => {
            updateChapters(prevChapters => prevChapters.slice().sort((a, b) => files.indexOf(a.file) - files.indexOf(b.file)));
        }, []);

        return {
            chapters,

            onDragEnd,

            toggleChapterProperty,
            changeChapterTitle,

            selectAllChapters,
            selectNoneChapters,

            removeChapterNumbers,
            removeFirstChapterWord,
            restoreChapterTitle,
            setNumberedChapters,

            sortChapterByTitle,
            reverseChapterOrder,
            restoreChapterOrder
        };
    };

    const {
        chapters,
        onDragEnd,
        toggleChapterProperty, changeChapterTitle,
        selectAllChapters, selectNoneChapters,
        removeChapterNumbers, removeFirstChapterWord, restoreChapterTitle, setNumberedChapters,
        sortChapterByTitle, reverseChapterOrder, restoreChapterOrder
    } = useChapters();
    const { metadata, updateMetadata } = useMetadata();

    const handleTextInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = event.target;
        updateMetadata(id as keyof EpubMetadata, value);
    }, [updateMetadata]);

    const handleCheckedChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const { id, checked } = event.target;
        updateMetadata(id as keyof EpubMetadata, checked);
    }, [updateMetadata]);

    const handleNumberChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = event.target;
        updateMetadata(id as keyof EpubMetadata, value === '' ? -1 : parseInt(value, 10));
    }, [updateMetadata]);

    const handleLanguageChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        const { value } = event.target;
        updateMetadata('language', value);
    }, [updateMetadata]);

    const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] as LocalFile;
        event.target.value = '';
        if (file) {
            updateMetadata('cover', file?.path);
        }
    }, [updateMetadata]);

    const [chaptersCollapsed, setChaptersCollapsed] = useState(false);

    const renderChapter = (chapter: BookChapter, index: number) => (
        <Draggable key={index} draggableId={index.toString()} index={index}>
            {(provided, snapshot) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={chaptersCollapsed ? 'draggable-setting chapters-collapsed' : 'draggable-setting chapters-expanded'}
                >
                    <div className="chapter-header">
                        <label htmlFor={`include-chapter-${index}`} className="chapter-file">
                            {chapter.file.basename}.md
                        </label>
                        <div className="include-chapter">
                            <HelperTooltip>
                                Include chapter in book. Uncheck to exclude.
                            </HelperTooltip>
                            <input
                                type="checkbox"
                                id={`include-chapter-${index}`}
                                checked={chapter.include}
                                onChange={e => toggleChapterProperty(index, 'include', e.target.checked)}
                            />
                        </div>

                    </div>

                    {!chaptersCollapsed &&
                        <>
                            <input
                                type="text"
                                className="chapter-title"
                                value={chapter.title}
                                placeholder="Insert chapter title (required)"
                                onChange={e => changeChapterTitle(index, e.target.value)}
                                disabled={!chapter.include}
                            />

                            <div className="chapter-controls">
                                <input
                                    type="checkbox"
                                    id={`exclude-from-contents-${index}`}
                                    checked={chapter.excludeFromContents}
                                    onChange={e => toggleChapterProperty(index, 'excludeFromContents', e.target.checked)}
                                    disabled={!chapter.include}
                                />
                                <label htmlFor={`exclude-from-contents-${index}`}>
                                    <span>Exclude from TOC</span>
                                    <HelperTooltip>
                                        Table of contents will not include this chapter, but it will still be included in the contents.
                                    </HelperTooltip>
                                </label>

                                <input
                                    type="checkbox"
                                    id={`is-front-matter-${index}`}
                                    checked={chapter.isFrontMatter}
                                    onChange={e => toggleChapterProperty(index, 'isFrontMatter', e.target.checked)}
                                    disabled={!chapter.include}
                                />
                                <label htmlFor={`is-front-matter-${index}`}>
                                    <span>Front matter</span>
                                    <HelperTooltip>
                                        Front matter content is included. Will appear in your book ahead of the contents page.
                                        Mostly used for copyright, dedication pages. Will not be included in table of contents by default.
                                    </HelperTooltip>
                                </label>
                            </div>
                        </>
                    }
                </div>
            )}
        </Draggable>
    );

    const downloadImage = async (url: string, localPath: string): Promise<void> => {
        try {
            const response = await requestUrl({ url, method: 'GET' });
            await app.vault.adapter.writeBinary(localPath, new Uint8Array(response.arrayBuffer));
        } catch (error) {
            new Notice(`Failed to download ${url}: ${error}`);
        }
    };

    const processImage = async (image: HTMLImageElement, section: Element) => {
        const url = image.src;
        if (url.startsWith('http://') || url.startsWith('https://')) {
            const filename = path.basename(new URL(url).pathname);
            const tempFolder = path.join(getBasePath(), folder.path, TEMP_FOLDER_NAME);
            if (!fs.existsSync(tempFolder)) {
                fs.mkdirSync(tempFolder);
            }
            const localPath = path.join(folder.path, TEMP_FOLDER_NAME, filename);

            await downloadImage(url, localPath);
            return path.join(getBasePath(), localPath);
        } else {
            return path.join(getBasePath(), url);
        }
    };

    const makeHTML = async (markdown: string, chapterName: string, filePath: string) => {
        const section = document.createElement('section');
        document.body.appendChild(section);

        const chapterTitle = document.createElement('h1');
        chapterTitle.innerText = chapterName;
        section.appendChild(chapterTitle);

        await MarkdownRenderer.render(app, markdown, section, filePath, plugin);
        section.querySelector('p')?.addClass('dropcap');

        const imageSources = Array.from(section.querySelectorAll('img')).map(async image => {
            const newImagePath = await processImage(image, section);
            const filename = path.basename(new URL(newImagePath).pathname);
            const relativePath = '../images/' + filename;
            // this gives a console GET error, that's normal
            image.src = relativePath;
            return newImagePath;
        });

        const images = await Promise.all(imageSources);

        return { section, images };
    }

    const createEpub = async () => {
        if (!metadata.title) {
            new Notice('Title is required.');
            return;
        }

        if (!metadata.cover) {
            new Notice('Cover image is required.');
            return;
        }

        if (!metadata.author) {
            new Notice('Author name is required.');
            return;
        }

        if (!metadata.language) {
            new Notice('Language is required.');
            return;
        }

        if (!chapters.some(chapter => chapter.include)) {
            new Notice('No chapters selected.');
            return;
        }

        type MetadataValue = string | number | boolean | undefined;
        const addIfValid = (key: string, value: MetadataValue, invalidValues: MetadataValue[]): Partial<Metadata> => {
            return invalidValues.includes(value) ? {} : { [key]: value };
        }

        const bookId = metadata.identifier || uuid();

        const epubMetadata: Metadata = {
            title: metadata.title,
            cover: {
                name: metadata.cover,
                data: fs.readFileSync(metadata.cover),
            },
            author: metadata.author,
            id: bookId,
            language: metadata.language,
            ...addIfValid('description', metadata.description, ['']),
            ...addIfValid('series', metadata.series, ['']),
            ...addIfValid('sequence', metadata.sequence, [-1]),
            ...addIfValid('fileAs', metadata.fileAs, ['']),
            ...addIfValid('genre', metadata.genre, ['']),
            ...addIfValid('tags', metadata.tags, ['']),
            ...addIfValid('copyright', metadata.copyright, ['']),
            ...addIfValid('publisher', metadata.publisher, ['']),
            ...addIfValid('published', metadata.published, ['']),
            ...addIfValid('showContents', metadata.showContents, [undefined]),
            ...addIfValid('contents', metadata.tocTitle, ['']),
            ...addIfValid('source', metadata.transcriptionSource, ['']),
        };

        const sections: Section[] = [];
        const resources: Resource[] = [];

        for (const chapter of chapters) {
            if (!chapter.include) continue;
            if (!chapter.title) {
                new Notice('Chapter title is required for file: ' + chapter.file.basename + '.md');
                return;
            }

            const readFile = await app.vault.cachedRead(chapter.file);
            const html = await makeHTML(readFile, chapter.title, chapter.file.path);

            sections.push({
                title: chapter.title,
                content: html.section.innerHTML,
                excludeFromContents: chapter.excludeFromContents,
                isFrontMatter: chapter.isFrontMatter
            });

            html.images.forEach(image => {
                resources.push({
                    name: image,
                    data: fs.readFileSync(image),
                });
            });
        }

        const epub = new Epub({
            css: '',
            metadata: epubMetadata,
            options: {
                startReading: metadata.startReading,
            },
            resources: resources,
            sections: sections
        });

        // epub.addCSS(epubstyle.STYLE);

        const dialog = window.electron.remote.dialog;
        const getDirectory = await dialog.showOpenDialog({
            properties: ['openDirectory']
        });
        const folderPath = getDirectory.filePaths[0];

        if (!folderPath) {
            new Notice('Select a folder.');
            return;
        }

        const sanitizeFilename = (filename: string) => {
            const invalidChars = /[/\\:*?"<>|]/g;
            return filename.replace(invalidChars, '');
        };

        await epub.write(folderPath, sanitizeFilename(metadata.title));

        // clean up images
        const tempFolder = path.join(getBasePath(), folder.path, TEMP_FOLDER_NAME);
        if (fs.existsSync(tempFolder)) {
            fs.rmdirSync(tempFolder, { recursive: true });
        }

        new Notice('EPUB generated at: ' + folderPath + '/' + metadata.title + '.epub');
    }

    return (
        <div className="modal-content">
            <Tooltip id="helper-tooltip" style={{ zIndex: 100, maxWidth: 600 }} />

            <h1>Binder</h1>
            <div>
                <button onClick={createEpub} className="mod-cta">Bind to EPUB</button>
            </div>

            <div className="metadata-section">
                <h2>
                    Metadata (Required)
                    <HelperTooltip>
                        All fields in this section are required.
                    </HelperTooltip>
                </h2>
                <div>
                    <div className='metadata-label'>
                        <label htmlFor="title">Title</label>
                        <HelperTooltip>
                            The title of the book.
                        </HelperTooltip>
                    </div>

                    <input
                        type="text"
                        id="title"
                        className="metadata-input"
                        value={metadata.title}
                        onChange={handleTextInputChange}
                    />
                </div>
                <div>
                    <div className='metadata-label'>
                        <label htmlFor="cover">Cover Image</label>
                        <HelperTooltip>
                            The cover image of the book. Supported formats: SVG, PNG, JPG, JPEG, GIF, TIF, TIFF.
                        </HelperTooltip>
                    </div>

                    <input
                        type="file"
                        id="cover"
                        className="metadata-input upload-file"
                        accept=".svg, .png, .jpg, .jpeg, .gif, .tif, .tiff"
                        onChange={handleFileChange}
                    />
                    <button className="select-cover" onClick={() => document.getElementById('cover')?.click()}>Choose file</button>

                    {metadata.cover && (
                        <span className="select-cover-text">
                            file: {path.basename(metadata.cover)}
                        </span>
                    )}
                </div>
                <div>
                    <div className='metadata-label'>
                        <label htmlFor="author">Author</label>
                        <HelperTooltip>
                            The author of the book.
                        </HelperTooltip>
                    </div>

                    <input
                        type="text"
                        id="author"
                        className="metadata-input"
                        value={metadata.author}
                        onChange={handleTextInputChange}
                    />
                </div>
                <div>
                    <div className='metadata-label'>
                        <label htmlFor="language">Language</label>
                        <HelperTooltip>
                            The language of the book for e-reader identification.
                        </HelperTooltip>
                    </div>

                    <LanguageSelect value={metadata.language} onChange={handleLanguageChange} />
                </div>

                <h2>
                    Options
                    <HelperTooltip>
                        Metadata fields in this section are optional. These fields may not be shown to all e-readers.
                    </HelperTooltip>
                </h2>

                <div>
                    <div className='metadata-label'>
                        <label htmlFor="identifier">Identifier</label>
                        <HelperTooltip>
                            The identifier of the book. This can be an ISBN, or any number you want to use to identify it.
                        </HelperTooltip>
                    </div>

                    <input
                        type="text"
                        id="identifier"
                        className="metadata-input"
                        value={metadata.identifier}
                        onChange={handleTextInputChange}
                    />
                </div>
                <div>
                    <div className='metadata-label'>
                        <label htmlFor="description">Description</label>
                        <HelperTooltip>
                            A short description of the book.
                            Should be a single, complete sentence ending in a period, not restate the title, be typogrified, and summarize the main theme or plot thread.
                        </HelperTooltip>
                    </div>
                    <input
                        type="text"
                        id="description"
                        className="metadata-input"
                        value={metadata.description}
                        onChange={handleTextInputChange}
                    />
                </div>
                <div>
                    <div className='metadata-label'>
                        <label htmlFor="series">Series</label>
                        <HelperTooltip>
                            The series the book belongs to.
                        </HelperTooltip>
                    </div>
                    <input
                        type="text"
                        id="series"
                        className="metadata-input"
                        value={metadata.series}
                        onChange={handleTextInputChange}
                    />
                </div>
                <div>
                    <div className='metadata-label'>
                        <label htmlFor="sequence">Sequence</label>
                        <HelperTooltip>
                            The sequence number of the book in the series.
                        </HelperTooltip>
                    </div>
                    <input
                        type="number"
                        id="sequence"
                        className="metadata-input"
                        value={metadata.sequence != undefined && metadata.sequence >= 0 ? metadata.sequence : ''}
                        onChange={handleNumberChange}
                    />
                </div>
                <div>
                    <div className='metadata-label'>
                        <label htmlFor="fileAs">File As</label>
                        <HelperTooltip>
                            The sortable version of the author's name for overriding the name. Last name, First.
                        </HelperTooltip>
                    </div>
                    <input
                        type="text"
                        id="fileAs"
                        className="metadata-input"
                        value={metadata.fileAs}
                        onChange={handleTextInputChange}
                    />
                </div>
                <div>
                    <div className='metadata-label'>
                        <label htmlFor="genre">Genre</label>
                        <HelperTooltip>
                            The genre of the book. (e.g. Fiction, Non-Fiction, Fantasy, Mystery, etc.)
                        </HelperTooltip>
                    </div>
                    <input
                        type="text"
                        id="genre"
                        className="metadata-input"
                        value={metadata.genre}
                        onChange={handleTextInputChange}
                    />
                </div>
                <div>
                    <div className='metadata-label'>
                        <label htmlFor="tags">Tags</label>
                        <HelperTooltip>
                            A comma-separated list of tags for the book.
                        </HelperTooltip>
                    </div>
                    <input
                        type="text"
                        id="tags"
                        className="metadata-input"
                        value={metadata.tags}
                        onChange={handleTextInputChange}
                    />
                </div>
                <div>
                    <div className='metadata-label'>
                        <label htmlFor="copyright">Copyright</label>
                        <HelperTooltip>
                            The copyright information. (e.g. © 2024 Author Name)
                        </HelperTooltip>
                    </div>
                    <input
                        type="text"
                        id="copyright"
                        className="metadata-input"
                        value={metadata.copyright}
                        onChange={handleTextInputChange}
                    />
                </div>
                <div>
                    <div className='metadata-label'>
                        <label htmlFor="publisher">Publisher</label>
                        <HelperTooltip>
                            The publisher of the book.
                        </HelperTooltip>
                    </div>
                    <input
                        type="text"
                        id="publisher"
                        className="metadata-input"
                        value={metadata.publisher}
                        onChange={handleTextInputChange}
                    />
                </div>
                <div>
                    <div className='metadata-label'>
                        <label htmlFor="published">Published</label>
                        <HelperTooltip>
                            The published date of the book. (e.g. 2024-01-01)
                        </HelperTooltip>
                    </div>
                    <input
                        type="text"
                        id="published"
                        className="metadata-input"
                        value={metadata.published}
                        onChange={handleTextInputChange}
                    />
                </div>
                <div>
                    <div className='metadata-label'>
                        <label htmlFor="transcriptionSource">Transcription Source</label>
                        <HelperTooltip>
                            The source of the transcription.
                        </HelperTooltip>
                    </div>
                    <input
                        type="text"
                        id="transcriptionSource"
                        className="metadata-input"
                        value={metadata.transcriptionSource}
                        onChange={handleTextInputChange}
                    />
                </div>

                <h2>
                    Table of Contents Options
                    <HelperTooltip>
                        Optional fields for handing table of contents.
                    </HelperTooltip>
                </h2>

                <div>
                    <div className='metadata-label'>
                        <label htmlFor="tocTitle">Table of Contents</label>
                        <HelperTooltip>
                            The title to override for the table of contents. Leave blank for: Table of Contents.
                        </HelperTooltip>
                    </div>
                    <input
                        type="text"
                        id="tocTitle"
                        className="metadata-input"
                        value={metadata.tocTitle}
                        onChange={handleTextInputChange}
                    />
                </div>
                <div>
                    <div className='metadata-label'>
                        <label htmlFor="showContents">Show Table of Contents</label>
                        <HelperTooltip>
                            Show the table of contents in the book. Default: true. Uncheck to hide the table of contents.
                        </HelperTooltip>
                    </div>
                    <input
                        type="checkbox"
                        id="showContents"
                        checked={metadata.showContents}
                        onChange={handleCheckedChange}
                    />
                </div>
                <div>
                    <div className='metadata-label'>
                        <label htmlFor="startReading">Start Reading</label>
                        <HelperTooltip>
                            Start reading the book from after the table of contents. Default: true. Uncheck to start reading from cover page.
                        </HelperTooltip>
                    </div>
                    <input
                        type="checkbox"
                        id="startReading"
                        checked={metadata.startReading}
                        onChange={handleCheckedChange}
                    />
                </div>
            </div>

            <h2>Contents</h2>
            <div className="bulk-actions">
                <div>
                    <div className='bulk-action-category'>Selection</div>
                    <button onClick={selectAllChapters}>
                        Select all
                        <HelperTooltip>
                            Include all chapters in selection.
                        </HelperTooltip>
                    </button>
                    <button onClick={selectNoneChapters}>
                        Select none
                        <HelperTooltip>
                            Remove all chapters from selection.
                        </HelperTooltip>
                    </button>
                </div>
                <div>
                    <div className='bulk-action-category'>Bulk title actions</div>
                    <button onClick={removeChapterNumbers}>
                        Remove chapter numbers
                        <HelperTooltip>
                            Remove any numbers at the start of the chapter titles.
                        </HelperTooltip>
                    </button>
                    <button onClick={removeFirstChapterWord}>
                        Remove first word
                        <HelperTooltip>
                            Remove the first word of each chapter title.
                        </HelperTooltip>
                    </button>
                    <button onClick={restoreChapterTitle}>
                        Restore original titles
                        <HelperTooltip>
                            Restore the original chapter titles based on the file names.
                        </HelperTooltip>
                    </button>
                    <button onClick={setNumberedChapters}>
                        Set numbered chapters
                        <HelperTooltip>
                            Set included chapter titles to the order they are listed.
                        </HelperTooltip>
                    </button>
                </div>
                <div>
                    <div className='bulk-action-category'>Chapter sorting</div>
                    <button onClick={sortChapterByTitle}>
                        Sort by title
                        <HelperTooltip>
                            Sort based on the title names of the chapters.
                        </HelperTooltip>
                    </button>
                    <button onClick={reverseChapterOrder}>
                        Reverse order
                        <HelperTooltip>
                            Reverse the order of the chapters.
                        </HelperTooltip>
                    </button>
                    <button onClick={restoreChapterOrder}>
                        Restore original order
                        <HelperTooltip>
                            Restore the original order of the chapters, sort based on the file names.
                        </HelperTooltip>
                    </button>
                    {chaptersCollapsed ?
                        <button onClick={() => setChaptersCollapsed(false)}>
                            Show chapter details
                            <HelperTooltip>
                                Show title, exclude from contents, and front matter settings for each chapter.
                            </HelperTooltip>
                        </button> :
                        <button onClick={() => setChaptersCollapsed(true)}>
                            Collapse chapter details
                            <HelperTooltip>
                                Hide title, exclude from contents, and front matter settings for each chapter.
                            </HelperTooltip>
                        </button>
                    }
                </div>
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="chapters">
                    {(provided) => (

                        <div
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            className="chapter-list"
                        >
                            {chapters.map(renderChapter)}
                            {provided.placeholder}
                        </div>
                    )}
                </Droppable>
            </DragDropContext>
        </div>
    );
};

export default EpubBinderModal;