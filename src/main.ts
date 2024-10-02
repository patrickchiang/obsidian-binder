import { App, Menu, Notice, Plugin, PluginSettingTab, Setting, TFolder, WorkspaceLeaf } from 'obsidian';
import { BinderIntegrationView } from './BinderView.js';
import { backmatters, frontmatters, Matter } from './templates/bookmatter.js';

interface BinderPluginSettings {
	persistSettings: boolean;
}

const DEFAULT_SETTINGS: BinderPluginSettings = {
	persistSettings: true
}

export default class BinderPlugin extends Plugin {
	settings: BinderPluginSettings;
	binderObservers: ResizeObserver[];
	binderBooks: ePub.Book[];

	cleanBinder() {
		if (this.binderObservers) {
            this.binderObservers.forEach(observer => {
                observer.disconnect();
            });
            this.binderObservers = [];
        }
        if (this.binderBooks) {
            this.binderBooks.forEach(book => {
                book.destroy();
            });
            this.binderBooks = [];
        }

        document.querySelectorAll("section.binder-chapter").forEach(section => {
            section.remove();
        });
	}

	async onload() {
		await this.loadSettings();

		this.registerView(
			"binder-view",
			(leaf) => new BinderIntegrationView(leaf, this)
		);

		this.addSettingTab(new BinderSettingTab(this.app, this));
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file, view) => {
				if (file instanceof TFolder) {
					menu.addSeparator();
					this.createBindIcon(menu, file);

					menu.addItem((item) => {
						item
							.setTitle("Add Front/Back Matter")
							.setIcon("plus");

						const subMenu = item.setSubmenu();

						this.createMatterIcon(subMenu, file, frontmatters);
						subMenu.addSeparator();
						this.createMatterIcon(subMenu, file, backmatters);
					});
					menu.addSeparator();
				}
			})
		);
	}

	createMatterIcon(subMenu: Menu, file: TFolder, matters: Matter[]) {
		for (const { title, yaml } of matters) {
			subMenu.addItem((subItem) => {
				subItem
					.setTitle(title)
					.setIcon("file")
					.onClick(async () => {
						const fileName = `000 ${title}.md`;
						const filePath = file.path + "/" + fileName;

						if (this.app.vault.getFileByPath(filePath)) {
							new Notice(`File ${fileName} already exists in ${file.path}.`);
						} else {
							await this.app.vault.create(filePath, yaml);
						}

						const newFile = this.app.vault.getFileByPath(filePath);
						if (newFile) {
							this.app.workspace.getLeaf("tab").openFile(newFile);
						}
					});
			});
		}
	}

	createBindIcon(menu: Menu, file: TFolder) {
		menu.addItem((item) => {
			item
				.setTitle("Binder")
				.setIcon("book-open-text")
				.onClick(async () => {
					const { workspace } = this.app;
					const leaves = workspace.getLeavesOfType("binder-view");

					let leaf: WorkspaceLeaf | null = null;
					if (leaves.length > 0) {
						leaf = leaves[0];
					} else {
						leaf = workspace.getLeaf(true);
						await leaf.setViewState({ type: "binder-view", active: true });
					}

					if (leaf.view instanceof BinderIntegrationView) {
						workspace.revealLeaf(leaf);
						leaf.view.startRender(file);
					}
				});
		});
	}

	naturalSort(a: string, b: string): number {
		return a.localeCompare(b, undefined, {
			numeric: true,
			sensitivity: 'base'
		});
	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class BinderSettingTab extends PluginSettingTab {
	plugin: BinderPlugin;

	constructor(app: App, plugin: BinderPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		new Setting(containerEl)
			.setName('Persist settings')
			.setDesc('Automatically save settings to the vault')
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.persistSettings)
					.onChange(async (value) => {
						this.plugin.settings.persistSettings = value;
						await this.plugin.saveSettings();
					});
			});
	}
}