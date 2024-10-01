import { App, Plugin, PluginSettingTab, Setting, TFolder, WorkspaceLeaf } from 'obsidian';
import { frontMatter } from './FrontMatter.js';
import { BinderIntegrationView } from './BinderView.js';

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

		this.registerView(
			"binder-view",
			(leaf) => new BinderIntegrationView(leaf, this)
		);

		this.addSettingTab(new BinderSettingTab(this.app, this));
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file, view) => {
				if (file instanceof TFolder) {
					menu.addSeparator();
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

					menu.addItem((item) => {
						item
							.setTitle("Add Front/Back Matter")
							.setIcon("plus");

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
									.setIcon("plus")
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
									.setIcon("plus")
									.onClick(async () => {
										await template(this.app, file as TFolder);
									});
							});
						}
					});
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