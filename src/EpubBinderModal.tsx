import React, { useState, useCallback, useEffect } from 'react';
import { FileSystemAdapter, ItemView, LocalFile, MarkdownRenderer, Notice, TAbstractFile, TFile, TFolder, WorkspaceLeaf, requestUrl } from 'obsidian';
import { createRoot } from 'react-dom/client';
import { DragDropContext, Droppable, Draggable, DropResult, DraggingStyle } from 'react-beautiful-dnd';
import { icon } from '@fortawesome/fontawesome-svg-core'
import { faCrown, faGlobe } from '@fortawesome/free-solid-svg-icons'
import { faAmazon, faApple, faAudible, faFacebook, faPatreon, faTwitter } from '@fortawesome/free-brands-svg-icons';
import { Tooltip } from 'react-tooltip';
import yaml from 'js-yaml';
import { v4 as uuid } from 'uuid';
import numWords from 'num-words';
import ePub from 'epubjs';
import fs from 'fs';
import path from 'path';

import Epub, { Metadata, Resource, Section } from 'nodepub';

import LanguageSelect from './LanguageSelect.js';
import HelperTooltip from './HelperTooltip.js';
import BinderPlugin from './main.js';
import { BinderModalProps, BookChapter, BookData, BookMetadata, BookStoredChapter } from './BookStructure.js';
import { renderToStaticMarkup } from 'react-dom/server';
import ThemeSelect from './ThemeSelect.js';

import { baseTheme } from './themes/base.js';
import { monoTheme } from './themes/mono.js';
import PreviewColorSelect from './PreviewColorSelect.js';
import Themes from 'epubjs/types/themes.js';

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

export class BinderEpubIntegrationView extends ItemView {
    folder: TAbstractFile;
    plugin: BinderPlugin;
    reactRoot: ReturnType<typeof createRoot> | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: BinderPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType() {
        return "binder-view";
    }

    getDisplayText() {
        return "Binder" + (this.folder ? `: ${this.folder.name}` : '');
    }

    async onOpen() {
        const defaultOnErrorFn = window.onerror;

        window.onerror = (...args) => {
            if (args[0] === 'ResizeObserver loop limit exceeded') {
                return true;
            } else {
                return defaultOnErrorFn?.(...args);
            }
        };
    }

    startRender(folder: TAbstractFile) {
        this.folder = folder;
        this.leaf.updateHeader();

        const { contentEl } = this;

        contentEl.empty();

        const reactContainer = contentEl.createDiv();
        this.reactRoot = createRoot(reactContainer);
        this.reactRoot.render(<EpubBinderModal app={this.app} folder={this.folder} plugin={this.plugin} />);
    }

    async onClose() {
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
                isFrontMatter: chapter.isFrontMatter,
                isBackMatter: chapter.isBackMatter
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

    const hardCodedFrontMatter = [
        "000 Copyright",
        "000 Find Me Online"
    ];

    const hardCodedBackMatter = [
        "999 Other Books",
        "999 Preview Book",
        "999 About the Author"
    ];

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
                title: file.basename.replace(/^\d*/, '').trim(),
                file,
                include: true,
                excludeFromContents: false,
                isFrontMatter: hardCodedFrontMatter.includes(file.basename),
                isBackMatter: hardCodedBackMatter.includes(file.basename)
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
                        isBackMatter: chapter.isBackMatter
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
                        isBackMatter: storedChapter?.isBackMatter || false
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
                    if (!chapter.include || chapter.isFrontMatter || chapter.isBackMatter) {
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

    const [currentTheme, setCurrentTheme] = useState("base");
    const [currentThemeStyle, setCurrentThemeStyle] = useState(baseTheme);

    const [previewColorScheme, setPreviewColorScheme] = useState("light");

    const [bookLocation, setBookLocation] = useState<string | undefined>('');
    const [bookLoading, setBookLoading] = useState<boolean>(false);
    const [rendition, setRendition] = useState<ePub.Rendition | null>(null);

    const handleThemeChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        const { value } = event.target;

        switch (value) {
            case 'base':
                setCurrentThemeStyle(baseTheme);
                break;
            case 'mono':
                setCurrentThemeStyle(monoTheme);
                break;
            default:
        }

        setCurrentTheme(value);
    }, []);

    const handlePreviewColorSchemeChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        const { value } = event.target;
        setPreviewColorScheme(value);
    }, []);

    const jumpToTOC = async () => {
        const location = "content/toc.xhtml";
        if (rendition) {
            rendition.display(location);
        } else {
            await previewPub(location);
        }
        setBookLocation(location);
    };

    useEffect(() => {
        if (rendition) {
            interface ThemeList {
                [key: string]: { color: string, backgroundColor: string };
            }
            const themes: ThemeList = {
                light: {
                    color: '#000000',
                    backgroundColor: '#ffffff'
                },
                dark: {
                    color: '#acacac',
                    backgroundColor: '#121212'
                },
                sepia: {
                    color: '#5d4232',
                    backgroundColor: '#e7dec7'
                },
                green: {
                    color: '#3a4b43',
                    backgroundColor: '#c5e7ce'
                }
            };
            rendition.themes.override("color", themes[previewColorScheme].color);
            rendition.themes.override("background-color", themes[previewColorScheme].backgroundColor);
        }
    }, [previewColorScheme, rendition]);

    const [chaptersCollapsed, setChaptersCollapsed] = useState(false);
    const [optionalMetadataCollapsed, setOptionalMetadataCollapsed] = useState(true);

    const findRelativeParentOffsetTop = (element: HTMLElement | null) => {
        let currentElement = element;

        while (currentElement) {
            const computedStyle = window.getComputedStyle(currentElement);
            if (computedStyle.position === "relative") {
                return currentElement.getBoundingClientRect();
            }
            currentElement = currentElement.offsetParent as HTMLElement;
        }
        return {
            top: 0,
            left: 0
        };
    }

    const renderChapter = (chapter: BookChapter, index: number) => (
        <Draggable key={index} draggableId={index.toString()} index={index}>
            {(provided, snapshot) => {
                if (snapshot.isDragging) {
                    const positionOffset = findRelativeParentOffsetTop(document.querySelector('.chapter-list'));
                    const lastStyle = provided.draggableProps.style as DraggingStyle;
                    const lastTop = lastStyle.top ?? 0;
                    const lastLeft = lastStyle.left ?? 0;
                    provided.draggableProps.style = {
                        ...lastStyle,
                        left: lastLeft - positionOffset.left,
                        top: lastTop - positionOffset.top
                    }
                }
                return (
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
                                    placeholder="Insert chapter title (required, leave numbers out)"
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
                                            This section is front matter content. Will appear in your book ahead of the contents page.
                                            Mostly used for copyright, dedication pages.
                                        </HelperTooltip>
                                    </label>

                                    <input
                                        type="checkbox"
                                        id={`is-back-matter-${index}`}
                                        checked={chapter.isBackMatter}
                                        onChange={e => toggleChapterProperty(index, 'isBackMatter', e.target.checked)}
                                        disabled={!chapter.include}
                                    />
                                    <label htmlFor={`is-back-matter-${index}`}>
                                        <span>Back matter</span>
                                        <HelperTooltip>
                                            This section is back matter content. Mostly used for indice, about the author pages...etc.
                                        </HelperTooltip>
                                    </label>
                                </div>
                            </>
                        }
                    </div>
                )
            }}
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
        } else if (url.startsWith("app://")) {
            const urlPath = new URL(url).pathname.substring(1);
            return decodeURIComponent(urlPath);
        } else {
            return path.join(getBasePath(), url);
        }
    };

    const capitalize = (s: string) => {
        return s.charAt(0).toUpperCase() + s.slice(1);
    };

    const makeHTML = async (markdown: string, chapter: BookChapter, chapterNumber: number) => {
        const chapterName = chapter.title;
        const filePath = chapter.file.path;

        const section = document.createElement('section');
        document.body.appendChild(section);

        if (!chapter.isFrontMatter && !chapter.isBackMatter) {
            const chapterHeader = (
                <>
                    <h1 className="chapter-number">
                        <span className="chapter-word">Chapter </span>
                        <span className="chapter-number-numeric">{chapterNumber}</span>
                        <span className="chapter-number-text">
                            {capitalize(numWords(chapterNumber))}
                        </span>
                    </h1>
                    <div className="chapter-title-divider"></div>
                    <h1 className="chapter-title">{chapterName}</h1>
                </>
            );
            section.insertAdjacentHTML('beforeend', renderToStaticMarkup(chapterHeader));
        }

        await MarkdownRenderer.render(app, markdown, section, filePath, plugin);
        section.querySelector('p')?.addClass('dropcap');

        // replace horizontal rules with asterisks
        const horizontalRules = section.querySelectorAll('hr');
        horizontalRules.forEach(hr => {
            const asterisk = (
                <div className="horizontal-rule"></div>
            );
            hr.outerHTML = renderToStaticMarkup(asterisk);
        });

        // replace store links
        const storeLinkers = {
            "AMAZON": icon(faAmazon).html[0],
            "APPLE": icon(faApple).html[0],
            "AUDIBLE": icon(faAudible).html[0],
            "FACEBOOK": icon(faFacebook).html[0],
            "PATREON": icon(faPatreon).html[0],
            "ROYALROAD": icon(faCrown).html[0],
            "TWITTER": icon(faTwitter).html[0],
            "WEBSITE": icon(faGlobe).html[0],
        };
        const storeLinks = Array.from(section.querySelectorAll('a'));
        storeLinks.forEach(link => {
            const linkUrl = link.href;
            for (const [key, iconSvg] of Object.entries(storeLinkers)) {
                if (link.textContent === "%BINDER " + key + " LINK%") {
                    const parent = link.parentElement;
                    if (!parent?.hasClass('binder-store-link-container')) {
                        parent?.addClass('binder-store-link-container');
                    }

                    const newLink = (
                        <a href={linkUrl} className="binder-store-link">
                            {iconSvg}
                        </a>
                    );

                    link.outerHTML = renderToStaticMarkup(newLink);
                }
            }
        });
        section.querySelectorAll('.binder-store-link-container').forEach(container => {
            const children = Array.from(container.children);

            if (children.length > 3) {
                container.innerHTML = '';

                for (let i = 0; i < children.length; i += 3) {
                    const newContainer = document.createElement('div');
                    newContainer.classList.add('binder-store-link-container');

                    for (let j = i; j < i + 3 && j < children.length; j++) {
                        newContainer.appendChild(children[j]);
                    }
                    container.appendChild(newContainer);
                }
                container.removeClass('binder-store-link-container');
            }
        });

        let rollingStyle = "";
        Array.from(section.children).forEach(child => {
            if (child instanceof HTMLPreElement) {
                if (child.textContent?.startsWith("%BINDER CSS%")) {
                    rollingStyle = child.textContent.replace("%BINDER CSS%", "");
                    child.remove();
                }
            }

            child.setAttribute('style', rollingStyle);
        });

        const imageSources = Array.from(section.querySelectorAll('img')).map(async image => {
            const newImagePath = await processImage(image, section);
            const filename = path.basename(new URL(newImagePath).pathname);
            const relativePath = '../resources/' + filename;
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

        let chapterNumber = 1;
        for (const chapter of chapters) {
            if (!chapter.include) continue;
            if (!chapter.title) {
                new Notice('Chapter title is required for file: ' + chapter.file.basename + '.md');
                return;
            }

            const readFile = await app.vault.cachedRead(chapter.file);
            const html = await makeHTML(readFile, chapter, chapterNumber);
            let chapterTitle = chapter.title;
            if (!chapter.isFrontMatter && !chapter.isBackMatter) {
                chapterTitle = chapterNumber + '. ' + chapter.title;
                chapterNumber++;
            }

            sections.push({
                title: chapterTitle,
                content: html.section.innerHTML,
                excludeFromContents: chapter.excludeFromContents,
                isFrontMatter: chapter.isFrontMatter,
            });

            html.images.forEach(image => {
                const inputImage = fs.readFileSync(image);
                resources.push({
                    name: image,
                    data: inputImage,
                });
            });
        }

        const epub = new Epub({
            css: currentThemeStyle,
            metadata: epubMetadata,
            options: {
                startReading: metadata.startReading,
            },
            resources: resources,
            sections: sections
        });

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

    const refreshClick = async () => {
        previewPub();
    };

    const previewPub = async (url?: string) => {
        setBookLoading(true);

        document.querySelector("#ebook-preview-render")?.empty();
        rendition?.destroy();

        const bookId = metadata.identifier || uuid();

        // Convert base64 string to Buffer
        const epubMetadata: Metadata = {
            title: metadata.title || "Placeholder Title",
            cover: {
                name: metadata.cover,
                data: fs.readFileSync(metadata.cover) || Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/wcAAgEB/eqNlgAAAABJRU5ErkJggg==", 'base64'),
            },
            author: metadata.author || "Placeholder Author",
            id: bookId || "placeholder-id",
            language: metadata.language || "en",
        };

        const sections: Section[] = [];
        const resources: Resource[] = [];

        let chapterNumber = 1;
        for (const chapter of chapters) {
            if (!chapter.include) continue;
            if (!chapter.title) {
                new Notice('Chapter title is required for file: ' + chapter.file.basename + '.md');
                return;
            }

            const readFile = await app.vault.cachedRead(chapter.file);
            const html = await makeHTML(readFile, chapter, chapterNumber);
            let chapterTitle = chapter.title;
            if (!chapter.isFrontMatter && !chapter.isBackMatter) {
                chapterTitle = chapterNumber + '. ' + chapter.title;
                chapterNumber++;
            }

            sections.push({
                title: chapterTitle,
                content: html.section.innerHTML,
                excludeFromContents: chapter.excludeFromContents,
                isFrontMatter: chapter.isFrontMatter,
            });

            html.images.forEach(image => {
                const inputImage = fs.readFileSync(image);
                resources.push({
                    name: image,
                    data: inputImage,
                });
            });
        }

        const epub = new Epub({
            css: currentThemeStyle,
            metadata: epubMetadata,
            options: {
                startReading: metadata.startReading,
            },
            resources: resources,
            sections: sections
        });

        const buffer = await epub.buffer();
        const blob = new Blob([buffer], { type: 'application/epub+zip' });

        // @ts-ignore
        const book = ePub.default(blob);

        const bookRendition = book.renderTo("ebook-preview-render", { width: "100%", height: "100%" });
        setRendition(bookRendition);
        book.spine.hooks.content.register((doc: Document) => {
            doc.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
                link.remove();
            });

            const injectStyle = document.createElement('style');
            injectStyle.textContent = currentThemeStyle;
            injectStyle.textContent += `
                #toc ol {
                    list-style-type: none;
                    margin: 0;
                    padding: 0;
                }
            `;

            doc.head.appendChild(injectStyle);
        });

        if (url) {
            bookRendition?.display(url);
        } else if (bookLocation) {
            bookRendition?.display(bookLocation);
        } else {
            bookRendition?.display();
        }

        bookRendition.hooks.content.register((content: Document) => {
            setBookLoading(false);
        });
    };

    const previouPage = async () => {
        if (rendition) {
            await rendition.prev();
        } else {
            previewPub();
        }
        setBookLocation(rendition?.currentLocation().start.cfi);
    };

    const nextPage = async () => {
        if (rendition) {
            await rendition.next();
        } else {
            previewPub();
        }
        setBookLocation(rendition?.currentLocation().start.cfi);
    };

    return (
        <div className="modal-content">
            <Tooltip id="helper-tooltip" style={{ zIndex: 100, maxWidth: 600 }} />

            <h1>Binder</h1>
            <div>
                <button onClick={createEpub} className="mod-cta">Bind to EPUB</button>
            </div>

            <div className="ebook-preview">
                <div className="phone-frame">
                    <div className="phone-toolbar">
                        <button onClick={previouPage} className="toolbar-button" aria-label="Go back one page">←</button>
                        <PreviewColorSelect value={previewColorScheme} onChange={handlePreviewColorSchemeChange} />
                        <button onClick={jumpToTOC} className="toolbar-button" aria-label="Go to Table of Contents">Table of Contents</button>
                        <button onClick={refreshClick} className="toolbar-button" disabled={bookLoading} aria-label="Load/refresh preview">↻</button>
                        <button onClick={nextPage} className="toolbar-button" aria-label="Go forward one page">→</button>
                    </div>
                    <div id="ebook-preview-render"></div>
                </div>
            </div>

            <div>
                <h2>
                    Themes
                    <HelperTooltip>
                        Theme and styling to apply to chapters.
                    </HelperTooltip>
                </h2>

                <div>
                    <div className='metadata-label'>
                        <label htmlFor="theme-choose">Premade Theme</label>
                        <HelperTooltip>
                            The premade theme to apply to the book.
                        </HelperTooltip>
                    </div>

                    <ThemeSelect value={currentTheme} onChange={handleThemeChange} />
                </div>
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
                    <span onClick={() => setOptionalMetadataCollapsed(!optionalMetadataCollapsed)} className="collapse-metadata-header">
                        <span className="collapse-metadata-icon">{optionalMetadataCollapsed ? '▶' : '▼'}</span> Optional Metadata
                    </span>
                    <HelperTooltip>
                        Metadata fields in this section are optional. These fields may not be shown to all e-readers.
                    </HelperTooltip>
                </h2>

                <div className={optionalMetadataCollapsed ? 'metadata-section-collapsed' : ''}>
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
                            Set included chapter titles to the order they are listed. Avoid.
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