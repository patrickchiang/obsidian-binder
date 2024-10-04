import { icon } from '@fortawesome/fontawesome-svg-core';
import { faAmazon, faApple, faAudible, faFacebook, faPatreon, faTwitter } from '@fortawesome/free-brands-svg-icons';
import { faCrown, faGlobe } from '@fortawesome/free-solid-svg-icons';
import { DragDropContext, Draggable, DraggingStyle, DropResult, Droppable } from '@hello-pangea/dnd';
import ePub from 'epubjs';
import fs from 'fs';
import yaml from 'js-yaml';
import Epub, { Metadata, Resource, Section } from 'nodepub';
import numWords from 'num-words';
import { FileSystemAdapter, ItemView, LocalFile, MarkdownRenderer, Notice, TAbstractFile, TFile, TFolder, WorkspaceLeaf, requestUrl } from 'obsidian';
import path from 'path';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { v4 as uuid } from 'uuid';

import { BinderModalProps, BookChapter, BookData, BookMetadata, BookStoredChapter } from './BookStructure.js';
import { BookStyle, makeStylesheet } from './Bookstyle.js';
import HelperTooltip from './HelperTooltip.js';
import LanguageSelect from './LanguageSelect.js';
import PreviewColorSelect from './PreviewColorSelect.js';
import StyleOverrideSelect, { calculateStyleOverrides, dropcaps, horizontalRules, indents, styleOverrideDefaults, toc, tocBm, tocFm } from './StyleOverrideSelect.js';
import ThemeSelect, { getStyleForTheme } from './ThemeSelect.js';
import { backmatters, convertToPage, frontmatters } from './templates/bookmatter.js';

import BinderPlugin from './main.js';

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
    theme: string;
    components: string[];
}

export const defaultStyle: BookStyle = {
    width: "5in",
    height: "8in",

    insideMargin: "0.875in",
    outsideMargin: "0.25in",
    verticalMargin: "0.5in",

    fontSize: "12px",
    fontFamily: "Bookerly, sans-serif",

    lineHeight: "22px"
}

export class BinderIntegrationView extends ItemView {
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
        const { contentEl, plugin } = this;

        class CalmResizeObserver extends ResizeObserver {
            constructor(callback: ResizeObserverCallback) {
                super(callback);

                if (!plugin.binderObservers) {
                    plugin.binderObservers = [];
                }
                plugin.binderObservers.push(this);
            }
        }

        window.ResizeObserver = CalmResizeObserver;

        const reactContainer = contentEl.createDiv();
        this.reactRoot = createRoot(reactContainer);
        this.reactRoot.render(
            <div>
                <h1>Obsidian Binder</h1>
                <p>Open a folder to start creating your book.</p>
                <p>Right click on a folder &gt; Binder</p>
            </div>
        );
    }

    startRender(folder: TAbstractFile) {
        this.folder = folder;
        this.leaf.updateHeader();

        this.cleanup();

        const { contentEl } = this;

        const reactContainer = contentEl.createDiv();
        this.reactRoot = createRoot(reactContainer);
        this.reactRoot.render(<BinderView app={this.app} folder={this.folder} plugin={this.plugin} />);
    }

    cleanup() {
        const { plugin, contentEl, reactRoot } = this;
        contentEl.empty();
        if (reactRoot) {
            reactRoot.unmount();
        }
        plugin.cleanBinder();
    }

    async onClose() {
        this.cleanup();
    }
}

const TEMP_FOLDER_NAME = 'binder-temp';
const TEMP_SITE_NAME = 'binder-temp.html';
const SAVE_FILE_NAME = 'binder-save.yaml';

const BinderView: React.FC<BinderModalProps> = ({ app, folder, plugin }) => {
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

    const isDefaultFrontMatter = (file: TFile) => {
        return frontmatters.some(bookmatter => file.basename === `_binder ${bookmatter.title}`);
    };
    const isDefaultBackMatter = (file: TFile) => {
        return backmatters.some(bookmatter => file.basename === `_binder ${bookmatter.title}`);
    };

    const rearrangeChapters = (chapters: BookChapter[]) => {
        const frontmatter = chapters.filter(chapter => chapter.isFrontMatter);
        const backmatter = chapters.filter(chapter => chapter.isBackMatter);
        const normalChapters = chapters.filter(chapter => !chapter.isFrontMatter && !chapter.isBackMatter);
        return [...frontmatter, ...normalChapters, ...backmatter];
    };

    const getDefaultBookData = () => {
        const defaultValueMetadata = {
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
            theme: 'apex',
            components: ['_dropcap1', '_hrAsterisks3', '_indent1', ...styleOverrideDefaults]
        };

        const defaultValueChapters = files.map(file => ({
            title: file.basename.replace(/^\d*/, '').trim(),
            file,
            include: true,
            excludeFromContents: false,
            isFrontMatter: isDefaultFrontMatter(file),
            isBackMatter: isDefaultBackMatter(file)
        }));

        return {
            metadata: defaultValueMetadata,
            chapters: rearrangeChapters(defaultValueChapters)
        };
    };

    const loadFromYaml = () => {
        if (plugin.settings.persistSettings === false) return getDefaultBookData();

        try {
            const filePath = getYamlPath();
            if (fs.existsSync(filePath) === false) {
                return getDefaultBookData();
            }

            const yamlStr = fs.readFileSync(filePath, 'utf8');
            const data = yaml.load(yamlStr) as BookData;

            let chapters: BookChapter[];
            if (data.chapters.length === files.length &&
                data.chapters.every(chapter => files.some(file => file.path === chapter.file))) {
                // Chapters are intact
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
                chapters: rearrangeChapters(chapters) as BookChapter[],
            };
        } catch (error) {
            new Notice('Error reading or parsing YAML file:', error);
            return getDefaultBookData();
        }
    };

    const loadedData = loadFromYaml();

    const useMetadata = () => {
        const [metadata, setMetadata] = useState<EpubMetadata>(loadedData.metadata);

        const updateMetadata = useCallback((field: keyof EpubMetadata, value: string | number | boolean | string[]) => {
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

    const [currentThemeStyle, setCurrentThemeStyle] = useState(getStyleForTheme(metadata.theme));

    const calculateFinalThemeStyle = () => {
        const comps = calculateStyleOverrides(metadata.components);
        return currentThemeStyle + comps;
    }

    const [finalThemeStyle, setFinalThemeStyle] = useState<string>(calculateFinalThemeStyle());

    useEffect(() => {
        setFinalThemeStyle(calculateFinalThemeStyle());
    }, [setFinalThemeStyle, currentThemeStyle, metadata.components]);

    const handleComponentsChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>, newComponents: string[]) => {
        updateMetadata('components', newComponents);
    }, [updateMetadata]);

    const [previewColorScheme, setPreviewColorScheme] = useState("dark");

    const [bookLocation, setBookLocation] = useState<string | undefined>('');
    const [bookLoading, setBookLoading] = useState<boolean>(false);
    const [rendition, setRendition] = useState<ePub.Rendition | null>(null);
    const renditionRef = useRef(rendition);

    const handleThemeChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>, style: string, newComponents: string[]) => {
        const { value } = event.target;

        setCurrentThemeStyle(style);

        updateMetadata('components', newComponents);
        updateMetadata('theme', value);
    }, [updateMetadata]);

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
    };

    useEffect(() => {
        renditionRef.current = rendition;
    }, [rendition]);

    useEffect(() => {
        if (renditionRef.current && renditionRef.current.manager) {
            renditionRef.current.themes.select(previewColorScheme);
            try {
                renditionRef.current.clear();
                renditionRef.current.start();
            } catch (error) {
                console.error(error);
            }
        }
    }, [previewColorScheme]);

    useEffect(() => {
        previewPub();
    }, [finalThemeStyle]);

    const [styleOverrideCollapsed, setStyleOverrideCollapsed] = useState(false);
    const [tocOptionsCollapsed, setTocOptionsCollapsed] = useState(false);
    const [optionalMetadataCollapsed, setOptionalMetadataCollapsed] = useState(false);
    const [utilitiesCollapsed, setUtilitiesCollapsed] = useState(true);
    const [chaptersCollapsed, setChaptersCollapsed] = useState(false);

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

        const storeLinkers = {
            "Amazon": icon(faAmazon).html[0],
            "Apple": icon(faApple).html[0],
            "Audible": icon(faAudible).html[0],
            "Facebook": icon(faFacebook).html[0],
            "Patreon": icon(faPatreon).html[0],
            "Royal Road": icon(faCrown).html[0],
            "Twitter": icon(faTwitter).html[0],
            "Website": icon(faGlobe).html[0]
        };

        const bookmatters = frontmatters.concat(backmatters);
        for (const bookmatter of bookmatters) {
            if (chapterName === `_binder ${bookmatter.title}`) {
                const page = convertToPage(markdown);

                const bodyResponse = page["Body"];
                let tempPortion = "";
                if (bodyResponse && typeof bodyResponse === 'string') {
                    const tempDom = document.createElement('div');
                    await MarkdownRenderer.render(app, bodyResponse, tempDom, filePath, plugin);
                    tempPortion = tempDom.innerHTML;
                }

                const sectionString = bookmatter.template({
                    data: page,
                    storeLinkers: storeLinkers,
                    bodyText: tempPortion
                });

                const wrapper = document.createElement('section');
                wrapper.innerHTML = sectionString;
                return {
                    section: wrapper,
                    images: [],
                    title: bookmatter.title,
                    increment: false
                };
            }
        }

        const section = document.createElement('section');
        section.addClass('binder-chapter');
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
        const firstParagraph = section.querySelector('p');
        if (firstParagraph) {
            const paragraph = firstParagraph.textContent || "";
            const wordArray = paragraph.split(' ');

            let replacementText = paragraph;
            const wordCount = wordArray.length;
            if (wordCount >= 4) {
                replacementText = renderToStaticMarkup(<>
                    <span className="first-four-words">
                        <span className="first-word">{wordArray?.[0]} </span>
                        {wordArray?.[1]} {wordArray?.[2]} {wordArray?.[3]} </span>
                    {wordArray?.slice(4).join(' ')}
                </>);
            } else if (wordCount > 0) {
                replacementText = renderToStaticMarkup(<>
                    <span className="first-word">{wordArray?.[0]} </span>
                    {wordArray?.slice(1).join(' ')}
                </>);
            }

            const replacementParagraph = document.createElement('p');
            replacementParagraph.innerHTML = replacementText;
            replacementParagraph.addClass('first-paragraph');

            if (chapter.isFrontMatter) {
                replacementParagraph.addClass('front-matter');
            }
            if (chapter.isBackMatter) {
                replacementParagraph.addClass('back-matter');
            }

            firstParagraph.replaceWith(replacementParagraph);
        }

        // replace horizontal rules with asterisks
        const horizontalRules = section.querySelectorAll('hr');
        horizontalRules.forEach(hr => {
            const asterisk = (
                <div className="horizontal-rule"></div>
            );
            hr.outerHTML = renderToStaticMarkup(asterisk);
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

        return { section, images, increment: !chapter.isFrontMatter && !chapter.isBackMatter };
    }

    const createWindowAndPrint = (html: string, filePath: string) => {
        const { BrowserWindow } = window.electron.remote;
        const win = new BrowserWindow({
            show: false,
            width: 1,
            height: 1
        });

        const tempPath = path.join(getBasePath(), folder.path, TEMP_SITE_NAME);

        // Create the HTML content
        const htmlContent = `
				<!DOCTYPE html>
				<html>
				<head>
					<title>Rendered Book</title>
                    <script src="https://unpkg.com/pagedjs/dist/paged.js"></script>
				</head>
				<body>
					${html}
                    <div id="renderTo"></div>
				</body>
				</html>
			`;

        fs.writeFileSync(tempPath, htmlContent, { encoding: 'utf8' });
        win.loadURL(tempPath);

        const styleString = makeStylesheet(defaultStyle) + finalThemeStyle;

        const renderBook = `
            async function renderBook() {
                let html = document.querySelector("#html");
                const renderTo = document.querySelector("#renderTo");

                const polisher = new Paged.Polisher();
                const chunker = new Paged.Chunker();

                polisher.setup();
                Paged.initializeHandlers(chunker, polisher);
                await polisher.add({
                    '': \`${styleString}\`
                });

                await chunker.flow(html.content, document.querySelector("#renderTo"));
            }
            renderBook();   // electron awaits for this call
        `;

        const wc = win.webContents;
        wc.on('dom-ready', () => {
            wc.executeJavaScript(renderBook).then(() => {
                wc.printToPDF({ preferCSSPageSize: true }).then((data: Buffer) => {
                    const renderPath = filePath;
                    fs.writeFile(renderPath, data, (error) => {
                        if (error) {
                            console.error(error);
                        }

                        win.destroy();
                    });
                });
            });
        });
    }

    const validateMetadata = async () => {
        if (!metadata.title) {
            new Notice('Title is required.');
            return false;
        }

        if (!metadata.cover) {
            new Notice('Cover image is required.');
            return false;
        }

        if (!metadata.author) {
            new Notice('Author name is required.');
            return false;
        }

        if (!metadata.language) {
            new Notice('Language is required.');
            return false;
        }

        if (!chapters.some(chapter => chapter.include)) {
            new Notice('No chapters selected.');
            return false;
        }

        return true;
    };

    const createPdf = async () => {
        const validation = validateMetadata();
        if (!validation) return;

        const dialog = window.electron.remote.dialog;
        const saveDialog = await dialog.showSaveDialog({
            title: 'Save .pdf',
            filters: [
                { name: 'PDF', extensions: ['pdf'] }
            ]
        });

        const filePath = saveDialog.filePath;

        if (!filePath) {
            new Notice('Select a file path.');
            return;
        }

        const wrapper = document.createElement('template');
        wrapper.id = 'html';

        let chapterNumberPdf = 1;
        for (const chapter of chapters) {
            if (!chapter.include) continue;

            const readFile = await app.vault.cachedRead(chapter.file);
            const { section } = await makeHTML(readFile, chapter, chapterNumberPdf);
            wrapper.content.appendChild(section);
            chapterNumberPdf++;
        }

        // clean up images
        const tempFolder = path.join(getBasePath(), folder.path, TEMP_FOLDER_NAME);
        if (fs.existsSync(tempFolder)) {
            fs.rmdirSync(tempFolder, { recursive: true });
        }

        createWindowAndPrint(wrapper.outerHTML, filePath);
        new Notice('PDF generated at: ' + filePath + '.');
    };

    const createEpub = async () => {
        const validation = validateMetadata();
        if (!validation) return;

        type MetadataValue = string | number | boolean | undefined;
        const addIfValid = (key: string, value: MetadataValue, invalidValues: MetadataValue[]): Partial<Metadata> => {
            return invalidValues.includes(value) ? {} : { [key]: value };
        }

        const bookId = metadata.identifier || uuid();

        const useTextCover = (!metadata.cover || metadata.cover === '');
        const coverData = useTextCover ? "No Cover Art" : {
            name: metadata.cover,
            data: fs.readFileSync(metadata.cover)
        };

        const epubMetadata: Metadata = {
            title: metadata.title,
            cover: coverData,
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

        const epub = await constructEpub(epubMetadata, chapters, useTextCover);
        if (!epub) return;

        const dialog = window.electron.remote.dialog;
        const saveDialog = await dialog.showSaveDialog({
            title: 'Save .epub',
            filters: [
                { name: 'EPUB', extensions: ['epub'] }
            ]
        });

        const filePath = saveDialog.filePath;

        if (!filePath) {
            new Notice('Select a file path.');
            return;
        }

        await epub.write(path.dirname(filePath), path.basename(filePath));

        // clean up images
        const tempFolder = path.join(getBasePath(), folder.path, TEMP_FOLDER_NAME);
        if (fs.existsSync(tempFolder)) {
            fs.rmdirSync(tempFolder, { recursive: true });
        }

        new Notice('EPUB generated at: ' + filePath + '.');
    }

    const refreshClick = async () => {
        previewPub();
    };

    const constructEpub = async (epubMetadata: Metadata, chapters: BookChapter[], useTextCover: boolean) => {
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

            if (html.increment) {
                chapterTitle = chapter.title;
                chapterNumber++;
            }
            if (html.title) {
                chapterTitle = html.title;
            }

            sections.push({
                title: chapterTitle,
                content: html.section.innerHTML,
                excludeFromContents: chapter.excludeFromContents,
                isFrontMatter: chapter.isFrontMatter,
                isBackMatter: chapter.isBackMatter
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
            css: finalThemeStyle,
            metadata: epubMetadata,
            options: {
                coverType: useTextCover ? 'text' : 'image',
                startReading: metadata.startReading,
                showContents: metadata.showContents,
            },
            resources: resources,
            sections: sections
        });

        return epub;
    };

    const previewPub = async (url?: string) => {
        setBookLoading(true);

        document.querySelector("#ebook-preview-render")?.empty();
        plugin.cleanBinder();

        const bookId = metadata.identifier || uuid();

        const useTextCover = (!metadata.cover || metadata.cover === '');
        const coverData = useTextCover ? "No Cover Art" : {
            name: metadata.cover,
            data: fs.readFileSync(metadata.cover)
        };

        const epubMetadata: Metadata = {
            title: metadata.title || "Placeholder Title",
            cover: coverData,
            author: metadata.author || "Placeholder Author",
            id: bookId || "placeholder-id",
            language: metadata.language || "en",
            contents: metadata.tocTitle || "Table of Contents"
        };

        const epub = await constructEpub(epubMetadata, chapters, useTextCover);
        if (!epub) return;

        const buffer = await epub.buffer();
        const blob = new Blob([buffer], { type: 'application/epub+zip' });

        // @ts-ignore
        const book = ePub.default(blob);

        const bookRendition = book.renderTo("ebook-preview-render", { width: "100%", height: "100%" });
        setRendition(bookRendition);
        if (!plugin.binderBooks) {
            plugin.binderBooks = [];
        }
        plugin.binderBooks.push(book)

        book.spine.hooks.content.register((doc: Document) => {
            doc.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
                link.remove();
            });

            const injectStyle = document.createElement('style');
            injectStyle.textContent = finalThemeStyle;
            injectStyle.textContent += `
                #toc ol {
                    list-style-type: none;
                    margin: 0;
                    padding: 0;
                }

                html {
                    font-family: "Georgia", "Palatino Linotype", sans-serif;
                }
            `;

            doc.head.appendChild(injectStyle);
        });

        interface ThemeList {
            [key: string]: object;
        }
        const themes: ThemeList = {
            light: {
                body: {
                    "color": '#000000',
                    "background-color": '#ffffff'
                },
                a: {
                    "color": '#0000ee'
                }
            },
            dark: {
                body: {
                    "color": '#acacac',
                    "background-color": '#121212'
                },
                a: {
                    "color": '#8fc0e9'
                }
            },
            sepia: {
                body: {
                    "color": '#5d4232',
                    "background-color": '#e7dec7'
                },
                a: {
                    color: '#0055aa'
                }
            },
            green: {
                body: {
                    "color": '#3a4b43',
                    "background-color": '#c5e7ce'
                },
                a: {
                    "color": '#0055aa'
                }
            }
        };
        for (const [key, value] of Object.entries(themes)) {
            bookRendition.themes.register(key, value);
        }

        bookRendition.themes.select(previewColorScheme);

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

        type Relocation = {
            start: {
                cfi: string;
            };
        };
        bookRendition.on('relocated', (location: Relocation) => {
            setBookLocation(location.start.cfi);
        });
    };

    const previouPage = async () => {
        if (rendition) {
            await rendition.prev();
        } else {
            previewPub();
        }
    };

    const nextPage = async () => {
        if (rendition) {
            await rendition.next();
        } else {
            previewPub();
        }
    };

    const [windowReady, setWindowReady] = useState<boolean>(false);
    useEffect(() => {
        setWindowReady(true);
    }, [])

    return (
        <>
            <h1 className='title'>Binder</h1>
            <div className='action-buttons'>
                <button onClick={createEpub} className="mod-cta bind-to-ebook">Save eBook (.epub)</button>
                <button onClick={createPdf} className="bind-to-pdf" disabled>Save print (.pdf) (WIP)</button>
            </div>
            <div className='binder-container'>
                <div className="ebook-preview">
                    <div className="phone-frame">
                        <div className="preview-title">
                            Preview
                        </div>
                        <div className="phone-toolbar">
                            <button onClick={previouPage} className="toolbar-button" aria-label="Go back one page">🠜</button>
                            <PreviewColorSelect value={previewColorScheme} onChange={handlePreviewColorSchemeChange} />
                            <button onClick={jumpToTOC} className="toolbar-button" aria-label="Go to Table of Contents">Table of Contents</button>
                            <button onClick={refreshClick} className="toolbar-button" disabled={bookLoading} aria-label="Load/refresh preview">↻</button>
                            <button onClick={nextPage} className="toolbar-button" aria-label="Go forward one page">🠞</button>
                        </div>
                        <div id="ebook-preview-render"></div>
                    </div>
                </div>
                <div className="appearance-section modal-content">
                    <h2 className='lineup-helper'>
                        Appearance
                        <HelperTooltip>
                            Theme and styling to apply to chapters.
                        </HelperTooltip>
                    </h2>

                    <div className='lineup-helper'>
                        <div className='metadata-label'>
                            <label>Theme</label>
                            <HelperTooltip>
                                The premade theme to apply to the book.
                            </HelperTooltip>
                        </div>

                        <ThemeSelect value={metadata.theme} onChange={handleThemeChange} />
                    </div>

                    <h3 className='lineup-helper'>
                        <span onClick={() => setStyleOverrideCollapsed(!styleOverrideCollapsed)} className="collapse-metadata-header">
                            <span className="collapse-metadata-icon">{styleOverrideCollapsed ? '▶' : '▼'}</span> Style Overrides
                            <HelperTooltip>
                                Override the default styling for the book.
                            </HelperTooltip>
                        </span>
                    </h3>

                    <div className={styleOverrideCollapsed ? 'section-collapsed' : ''}>
                        <div className='lineup-helper'>
                            <div className='metadata-label'>
                                <label>Dropcaps</label>
                                <HelperTooltip>
                                    Dropcap styling for the first words/letters/line of a chapter.
                                </HelperTooltip>
                            </div>

                            <StyleOverrideSelect value={metadata.components} onChange={handleComponentsChange} styleOverrides={dropcaps} />
                        </div>

                        <div className='lineup-helper'>
                            <div className='metadata-label'>
                                <label>Horizontal Rule</label>
                                <HelperTooltip>
                                    Horizontal rule styling for scene breaks.
                                </HelperTooltip>
                            </div>

                            <StyleOverrideSelect value={metadata.components} onChange={handleComponentsChange} styleOverrides={horizontalRules} />
                        </div>

                        <div className='lineup-helper'>
                            <div className='metadata-label'>
                                <label>Indents</label>
                                <HelperTooltip>
                                    Indent styling for paragraphs.
                                </HelperTooltip>
                            </div>

                            <StyleOverrideSelect value={metadata.components} onChange={handleComponentsChange} styleOverrides={indents} />
                        </div>
                    </div>

                    <h3 className='lineup-helper'>
                        <span onClick={() => setTocOptionsCollapsed(!tocOptionsCollapsed)} className="collapse-metadata-header">
                            <span className="collapse-metadata-icon">{tocOptionsCollapsed ? '▶' : '▼'}</span> Table of Contents Options
                        </span>
                        <HelperTooltip>
                            Optional fields for handing table of contents.
                        </HelperTooltip>
                    </h3>

                    <div className={tocOptionsCollapsed ? 'section-collapsed' : ''}>
                        <div className='lineup-helper'>
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
                        <div className='lineup-helper'>
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
                        <div className='lineup-helper'>
                            <div className='metadata-label'>
                                <label>TOC Styling</label>
                                <HelperTooltip>
                                    Styling for the table of contents.
                                </HelperTooltip>
                            </div>
                            <StyleOverrideSelect value={metadata.components} onChange={handleComponentsChange} styleOverrides={toc} />
                        </div>
                        <div className='lineup-helper'>
                            <div className='metadata-label'>
                                <label>Frontmatter</label>
                                <HelperTooltip>
                                    Styling for the table of contents frontmatter.
                                </HelperTooltip>
                            </div>
                            <StyleOverrideSelect value={metadata.components} onChange={handleComponentsChange} styleOverrides={tocFm} />
                        </div>
                        <div className='lineup-helper'>
                            <div className='metadata-label'>
                                <label>Backmatter</label>
                                <HelperTooltip>
                                    Styling for the table of contents backmatter.
                                </HelperTooltip>
                            </div>
                            <StyleOverrideSelect value={metadata.components} onChange={handleComponentsChange} styleOverrides={tocBm} />
                        </div>
                        <div className='lineup-helper'>
                            <div className='metadata-label'>
                                <label htmlFor="startReading">Start Reading After</label>
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
                </div>

                <div className="metadata-section modal-content">
                    <h2 className='lineup-helper'>
                        Metadata (Required)
                        <HelperTooltip>
                            All fields in this section are required.
                        </HelperTooltip>
                    </h2>
                    <div className='lineup-helper'>
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
                    <div className='lineup-helper'>
                        <div className='metadata-label'>
                            <label htmlFor="author">Author</label>
                            <HelperTooltip>
                                The author of the book. Use regular naming scheme (like "John Doe", not "Doe, John").
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
                    <div className='lineup-helper'>
                        <div className='metadata-label'>
                            <label htmlFor="language">Language</label>
                            <HelperTooltip>
                                The language of the book for e-reader identification.
                            </HelperTooltip>
                        </div>

                        <LanguageSelect value={metadata.language} onChange={handleLanguageChange} />
                    </div>

                    <div className='lineup-helper'>
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
                        <button className="select-cover" onClick={() => document.getElementById('cover')?.click()}>
                            {metadata.cover ? 'file: ' + path.basename(metadata.cover) : 'Select Cover Image'}
                        </button>
                    </div>
                    {metadata.cover && (
                        <div className="select-cover-text">
                            <img src={
                                `data:image/jpeg;base64,${fs.readFileSync(metadata.cover).toString('base64')}`
                            } className="cover-preview"></img>
                        </div>
                    )}
                </div>
                <div className="optional-section modal-content">
                    <h2 className='lineup-helper'>
                        <span onClick={() => setOptionalMetadataCollapsed(!optionalMetadataCollapsed)} className="collapse-metadata-header">
                            <span className="collapse-metadata-icon">{optionalMetadataCollapsed ? '▶' : '▼'}</span> Optional Metadata
                        </span>
                        <HelperTooltip>
                            Metadata fields in this section are optional. These fields may not be shown to all e-readers.
                        </HelperTooltip>
                    </h2>

                    <div className={optionalMetadataCollapsed ? 'section-collapsed' : ''}>
                        <div className='lineup-helper'>
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
                        <div className='lineup-helper'>
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
                        <div className='lineup-helper'>
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
                        <div className='lineup-helper'>
                            <div className='metadata-label'>
                                <label htmlFor="sequence">Sequence</label>
                                <HelperTooltip>
                                    The sequence number of the book in the series. A simple number will do.
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
                        <div className='lineup-helper'>
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
                        <div className='lineup-helper'>
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
                        <div className='lineup-helper'>
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
                        <div className='lineup-helper'>
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
                        <div className='lineup-helper'>
                            <div className='metadata-label'>
                                <label htmlFor="publisher">Publisher</label>
                                <HelperTooltip>
                                    The publisher of the book. Do not reference Amazon (they will reject it).
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
                        <div className='lineup-helper'>
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
                        <div className='lineup-helper'>
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
                </div>
            </div>
            <div className="bulk-actions">
                <h2>Contents</h2>

                <p>
                    <span onClick={() => setUtilitiesCollapsed(!utilitiesCollapsed)} className="collapse-metadata-header">
                        <span className="collapse-metadata-icon">{utilitiesCollapsed ? '▶' : '▼'}</span> Utilities
                    </span>
                    <HelperTooltip>
                        Bulk actions to apply to chapters.
                    </HelperTooltip>
                </p>
                <div className={utilitiesCollapsed ? 'section-collapsed' : ''}>
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
                {windowReady && (<DragDropContext onDragEnd={onDragEnd}>
                    <Droppable droppableId="chapters">
                        {(provided) => (
                            <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className="chapter-list"
                            >
                                {chapters.map(renderChapter)}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>)}
            </div>
        </>
    );
};

export default BinderView;