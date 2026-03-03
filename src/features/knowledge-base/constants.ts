import type { TreeNodeData, TagItem } from './types';

export const SAMPLE_TREE: TreeNodeData[] = [
    {
        id: 'general',
        label: 'General Knowledge',
        children: [
            {
                id: 'onboarding',
                label: 'Onboarding',
                children: [
                    { id: 'sub1', label: 'Subfolder 1', badge: 3 },
                    { id: 'sub2', label: 'Subfolder 2', badge: 5 },
                ],
            },
            { id: 'integrations', label: 'Integrations', badge: 8 },
            { id: 'documents', label: 'Documents', badge: 12 },
        ],
    },
    { id: 'onboarding-design', label: 'Onboarding Design', badge: 4 },
    { id: 'team-interviews', label: 'Team Interviews', badge: 7 },
];

export const SAMPLE_TAGS: TagItem[] = [
    { id: 'important', label: 'Important', color: 'red', count: 5 },
    { id: 'review', label: 'Review', color: 'amber', count: 3 },
    { id: 'approved', label: 'Approved', color: 'green', count: 12 },
    { id: 'draft', label: 'Draft', color: 'zinc', count: 8 },
    { id: 'archived', label: 'Archived', color: 'violet', count: 2 },
];
