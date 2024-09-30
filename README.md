# Obsidian Binder

Obsidian Binder is an Obsidian plugin that allows users to effortlessly turn their files into a professional-quality, well-formatted, beautiful eBooks. This plugin also includes pre-made templates for front and back matter to streamline the export process.

The format is ePub 3.0, targeted for export to the Amazon Kindle store.

## Usage

### Binding

1. Right click on folder to bind, select Bind.
2. Fill in the options (some metadata are required).
3. Arrange and customize chapters.
4. Press Bind button at the top.
5. Select directory to export to.

You can check your output file with Kindle Previewer 3 or Calibre.

### Formatting Customization

#### Templates

1. Right click on folder.
2. Add front/back matter.

These will be created with prefixed numbers. If you're prefixing your chapters with numbers, frontmatter will be added before your chapters and backmatter should be after your chapters.

#### Store Link Icons

You can include link icons to guide users to your store/web pages with this format:

```
[%BINDER AMAZON LINK%](link)
```

Modify the link. The `%BINDER ___ LINK%` tag turns this into an icon.

Store icons included:

* `%BINDER AMAZON LINK%`
* `%BINDER APPLE LINK%`
* `%BINDER AUDIBLE LINK%`
* `%BINDER FACEBOOK LINK%`
* `%BINDER PATREON LINK%`
* `%BINDER ROYALROAD LINK%`
* `%BINDER TWITTER LINK%`
* `%BINDER WEBSITE LINK%`

The "About the Author" template page includes examples.

#### Customize Styling (Advanced CSS)

Customize styling of portions of your book by creating a code element (tab) with your desired CSS, like this:

```
%BINDER CSS% text-align: center;
```

The "Copyright" template page includes an example.

Your style is reset every time the binder encounters one of these. So, in order to reset your formatting, you can simply add an empty one:

```
%BINDER CSS%
```

## Installing

1. **Install the Plugin**:
   - (Recommended) If installing through Obsidian, go to Settings > Community plugins > Browse and search for "Binder".
   - If downloading manually, place the plugin files in your Obsidian plugins folder.
2. **Enable the Plugin**: Go to Settings > Community plugins, find "Binder" and toggle it on.

## Development

If you want to contribute or modify the plugin, follow these steps:

- Clone this repo.
- Make sure your NodeJS is at least v16 (`node --version`).
- `npm i` or `yarn` to install dependencies.
- `npm run dev` to start compilation in watch mode.
- Feel free to file a pull request with any improvements.
