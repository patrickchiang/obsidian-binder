import { App, Plugin, PluginSettingTab, Setting, TFolder } from 'obsidian';
import { BinderEpubIntegrationModal } from './EpubBinderModal.js';
// import { BinderPdfIntegrationModal } from './PdfBinderModal.js';
import { frontMatter } from './FrontMatter.js';

interface BinderPluginSettings {
	persistSettings: boolean;
}

const DEFAULT_SETTINGS: BinderPluginSettings = {
	persistSettings: true
}

export default class BinderPlugin extends Plugin {
	settings: BinderPluginSettings;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new BinderSettingTab(this.app, this));
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file, view) => {
				if (file instanceof TFolder) {
					menu.addSeparator();
					menu.addItem((item) => {
						item
							.setTitle("Bind to EPUB")
							.setIcon("book-open-text")
							.onClick(async () => {
								new BinderEpubIntegrationModal(this.app, file, this).open();
							});
					});

					menu.addItem((item) => {
						item
							.setTitle("Add Front/Back Matter")
							.setIcon("book-open-text");

						const subMenu = item.setSubmenu();

						const frontMatterTemplates = [
							{
								title: "Find Me Online Page",
								template: frontMatter.createFindMe
							},
							{
								title: "Copyright Page",
								template: frontMatter.createCopyright
							}
						];

						for (const { title, template } of frontMatterTemplates) {
							subMenu.addItem((subItem) => {
								subItem
									.setTitle(title)
									.setIcon("book-open-text")
									.onClick(async () => {
										await template(this.app, file as TFolder);
									});
							});
						}

						subMenu.addSeparator();

						const backMatterTemplates = [
							{
								title: "Other Books Page",
								template: frontMatter.createOtherBooks
							},
							{
								title: "Preview Book Page",
								template: frontMatter.createPreviewBook
							},
							{
								title: "About the Author Page",
								template: frontMatter.createAboutAuthor
							}
						];

						for (const { title, template } of backMatterTemplates) {
							subMenu.addItem((subItem) => {
								subItem
									.setTitle(title)
									.setIcon("book-open-text")
									.onClick(async () => {
										await template(this.app, file as TFolder);
									});
							});
						}
					});

					// menu.addItem((item) => {
					// 	item
					// 		.setTitle("Bind to PDF")
					// 		.setIcon("book-open-text")
					// 		.onClick(async () => {
					// 			new BinderPdfIntegrationModal(this.app, file, this).open();
					// 		});
					// });
					menu.addSeparator();
				}
			})
		);
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