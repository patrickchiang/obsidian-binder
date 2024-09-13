import "obsidian";

declare module 'obsidian' {
    interface MenuItem {
        setSubmenu: () => Menu;
    }

    interface LocalFile extends File {
        path: string;
    }
}

declare global {
    interface Window {
        electron: any;
    }
}
