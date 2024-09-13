import React, { useState, useCallback } from 'react';
import { App, FileSystemAdapter, MarkdownRenderer, Modal, Notice, TAbstractFile, TFile, TFolder } from 'obsidian';
import { createRoot } from 'react-dom/client';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Tooltip } from 'react-tooltip';
import yaml from 'js-yaml';
import fs from 'fs';
import path from 'path';

import { makeStylesheet, defaultStyle } from './Bookstyle.js';

import HelperTooltip from './HelperTooltip.js';
import BinderPlugin from './main.js';
import { BinderModalProps, BookChapter, BookData, BookMetadata, BookStoredChapter } from './BookStructure.js';

interface PdfMetadata extends BookMetadata {

}

export class BinderPdfIntegrationModal extends Modal {
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
        this.reactRoot.render(<PdfBinderModal app={this.app} folder={this.folder} plugin={this.plugin} />);
    }

    onClose() {
        if (this.reactRoot) {
            this.reactRoot.unmount();
        }
    }
}

const TEMP_FOLDER_NAME = 'obsidian-binder-pdf-temp';
const TEMP_SITE_NAME = 'obsidian-binder-pdf-temp.html';
const SAVE_FILE_NAME = 'obsidian-binder-pdf-last-save.yaml';

const PdfBinderModal: React.FC<BinderModalProps> = ({ app, folder, plugin }) => {
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

    const saveToYaml = (metadata: PdfMetadata, chapters: BookChapter[]) => {
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
                identifier: '0',
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
                showContents: true,
                tocTitle: '',
                transcriptionSource: '',

                images: []
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
                metadata: data.metadata as PdfMetadata,
                chapters: chapters as BookChapter[],
            };
        } catch (error) {
            new Notice('Error reading or parsing YAML file:', error);
            return defaultBookData;
        }
    };

    const loadedData = loadFromYaml();

    const useMetadata = () => {
        const [metadata, setMetadata] = useState<PdfMetadata>(loadedData.metadata);

        const updateMetadata = useCallback((field: keyof PdfMetadata, value: string) => {
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
        updateMetadata(id as keyof BookMetadata, value);
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

    const makeHTML = async (markdown: string, chapterName: string, filePath: string) => {
        const section = document.createElement('section');
        document.body.appendChild(section);

        const chapterTitle = document.createElement('h1');
        chapterTitle.innerText = chapterName;
        section.appendChild(chapterTitle);

        await MarkdownRenderer.render(app, markdown, section, filePath, plugin);
        section.querySelector('p')?.addClass('dropcap');

        return { section };
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

        const styleString = makeStylesheet(defaultStyle);

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
                    const renderPath = path.join(filePath, `${metadata.title}.pdf`);
                    fs.writeFile(renderPath, data, (error) => {
                        if (error) {
                            console.error(error);
                        } else {
                            console.log('PDF has been saved to', filePath);
                        }

                        win.destroy();
                    });
                });
            });
        });
    }

    const createPdf = async () => {
        if (!metadata.title) {
            new Notice('Title is required.');
            return;
        }

        const dialog = window.electron.remote.dialog;
        const getDirectory = await dialog.showOpenDialog({
            properties: ['openDirectory']
        });
        const folderPath = getDirectory.filePaths[0];

        if (!folderPath) {
            new Notice('Select a folder.');
            return;
        }

        // this.createWindowAndPrint(chunker, path);
        const wrapper = document.createElement('template');
        wrapper.id = 'html';

        for (const chapter of chapters) {
            if (!chapter.include) continue;

            const readFile = await app.vault.cachedRead(chapter.file);
            const { section } = await makeHTML(readFile, chapter.title, chapter.file.path);
            wrapper.content.appendChild(section);
        }

        createWindowAndPrint(wrapper.outerHTML, folderPath);

        // clean up images
        const tempFolder = path.join(getBasePath(), folder.path, TEMP_FOLDER_NAME);
        if (fs.existsSync(tempFolder)) {
            fs.rmdirSync(tempFolder, { recursive: true });
        }

        new Notice('PDF generated at: ' + folderPath + '/' + metadata.title + '.pdf');
    }

    return (
        <div className="modal-content">
            <Tooltip id="helper-tooltip" style={{ zIndex: 100, maxWidth: 600 }} />

            <h1>Binder</h1>
            <div>
                <button onClick={createPdf} className="mod-cta">Bind to PDF</button>
            </div>
            <div id="previewer"></div>

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

export default PdfBinderModal;