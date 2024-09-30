import "obsidian";

declare module 'obsidian' {
    interface MenuItem {
        setSubmenu: () => Menu;
    }

    interface LocalFile extends File {
        path: string;
    }

    interface WorkspaceLeaf {
        updateHeader: () => void;
    }
}

declare global {
    interface Window {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        electron: any;
    }
}
