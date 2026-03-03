export interface TreeNodeData {
    id: string;
    label: string;
    children?: TreeNodeData[];
    badge?: number;
    type?: 'folder' | 'file';
}

export type SidebarTab = 'folders' | 'tags';

export interface TagItem {
    id: string;
    label: string;
    color: string;
    count: number;
}
