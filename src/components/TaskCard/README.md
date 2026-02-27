# TaskCard Component

A reusable task card component with smooth animations and flexible configuration.

## Features

- **Smooth Animation**: Includes the `task-card-leave` animation that slides the card down when focused
- **Dynamic Icons**: Automatically selects appropriate icons based on task type and AI model
- **Status Indicators**: Shows completion status with visual indicators
- **Priority Badges**: Displays task priority with color-coded badges
- **Hide/Show Animation**: Smooth fade and scale animation when hiding other cards
- **Responsive Design**: Adapts to different screen sizes and states

## Props

| Prop | Type | Description |
|------|------|-------------|
| `task` | `TaskItem` | The task object containing title, description, priority, etc. |
| `index` | `number` | The task index (used for numbering) |
| `isDone` | `boolean` | Whether the task is completed |
| `isExpanded` | `boolean` | Whether the task is in expanded state |
| `isFocused` | `boolean` | Whether the task is focused (triggers animation) |
| `isAI` | `boolean` | Whether the task is executable by AI |
| `onClick` | `() => void` | Click handler for the card |
| `aiModel` | `string` (optional) | AI model used for icon selection |
| `children` | `ReactNode` (optional) | Additional content to render below the card |
| `shouldHide` | `boolean` (optional) | Whether the card should be hidden with fade animation |

## Usage Example

```tsx
import TaskCard from '@/components/TaskCard';

const MyComponent = () => {
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);

  const handleTaskClick = (taskId: string) => {
    setFocusedTaskId(focusedTaskId === taskId ? null : taskId);
  };

  return (
    <div className="space-y-4">
      {tasks.map((task, index) => (
        <TaskCard
          key={task.id}
          task={task}
          index={index}
          isDone={false}
          isExpanded={focusedTaskId === task.id}
          isFocused={focusedTaskId === task.id}
          isAI={task.executavel_por_ia}
          onClick={() => handleTaskClick(task.id)}
          aiModel="groq"
          shouldHide={focusedTaskId && focusedTaskId !== task.id}
        />
      ))}
    </div>
  );
};
```

## Behavior

- **Click to Focus**: When a task card is clicked, it becomes focused and other cards fade out
- **Click to Unfocus**: Clicking the same focused card or a back button unfocuses all cards
- **Smooth Transitions**: All state changes use smooth CSS transitions
- **Pointer Events**: Hidden cards are non-interactive during focus state

## Animation

The component uses the `task-card-leave` CSS animation defined in `globals.css`:

```css
@keyframes task-card-leave {
  0% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
  40% {
    transform: translateY(24px) scale(0.98);
    opacity: 0.9;
  }
  100% {
    transform: translateY(320px) scale(0.92);
    opacity: 0;
  }
}
```

This animation is triggered when `isFocused` is `true`, creating a smooth slide-down effect.

## Icon Logic

The component automatically selects icons based on:

- **Tool type**: Docs, Sheets, Canva, Excel, Google Search
- **AI model**: Gemini, Groq, OpenRouter logos
- **Task type**: Manual vs AI-executable tasks
- **Completion status**: Checkmark overlay for completed tasks

## Styling

The component uses Tailwind CSS classes and follows the design system:

- Background: `bg-white/[0.03]` with hover states
- Text colors: Adaptive based on state (expanded, focused, done)
- Transitions: Smooth 300ms ease-out transitions
- Border radius: Consistent `rounded-lg` (8px) corners
