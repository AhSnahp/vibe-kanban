# Component Map

## Application Shell

```mermaid
graph TB
    subgraph "Entry (local-web)"
        BOOTSTRAP["Bootstrap.tsx<br/>Sentry, PostHog, QueryClient"]
        APP["App.tsx<br/>Providers stack"]
        BOOTSTRAP --> APP
    end

    subgraph "Provider Stack"
        ARP["AppRuntimeProvider"]
        USP["UserSystemProvider"]
        LAP["LocalAuthProvider"]
        HKP["HotkeysProvider"]
        TRP["RouterProvider"]
        APP --> ARP --> USP --> LAP --> HKP --> TRP
    end

    subgraph "Root Layout (_app.tsx)"
        UP["UserProvider"]
        STP["SequenceTrackerProvider"]
        TP["TerminalProvider"]
        SAL["SharedAppLayout"]
        UP --> STP --> TP --> SAL
    end

    subgraph "SharedAppLayout"
        APPBAR["AppBar<br/>Projects, orgs, user"]
        NAVBAR["NavbarContainer<br/>Top bar, breadcrumbs"]
        OUTLET["Outlet<br/>Page content"]
        MOBILE["MobileDrawer<br/>Project list"]
    end

    TRP --> UP
    SAL --> APPBAR
    SAL --> NAVBAR
    SAL --> OUTLET
    SAL --> MOBILE
```

## Route Structure

```mermaid
graph TB
    ROOT["__root.tsx"]
    APP["_app.tsx (layout)"]
    ROOT --> APP

    APP --> WORKSPACES["_app.workspaces.tsx<br/>Workspace list"]
    APP --> WS_DETAIL["_app.workspaces_.$workspaceId.tsx<br/>Workspace detail"]
    APP --> WS_CREATE["_app.workspaces_.create.tsx"]
    APP --> PROJECT["_app.projects.$projectId.tsx<br/>Kanban board"]
    APP --> BRAINSTORM["_app.brainstorm.tsx<br/>Brainstorm terminal"]
    APP --> MIGRATE["_app.migrate.tsx<br/>Migration flow"]

    PROJECT --> ISSUE["$projectId_.issues.$issueId.tsx<br/>Issue detail"]
    PROJECT --> NEW_ISSUE["$projectId_.issues.new.tsx"]
    ISSUE --> ISSUE_WS["$issueId_.workspaces.$workspaceId.tsx<br/>Workspace in issue"]
    ISSUE --> ISSUE_WS_CREATE["$issueId_.workspaces.create.$draftId.tsx"]

    ROOT --> ONBOARD["onboarding.tsx"]
    ONBOARD --> SIGNIN["onboarding_.sign-in.tsx"]
    ROOT --> VSCODE["workspaces.$workspaceId.vscode.tsx"]
```

## Feature Modules

```mermaid
graph TB
    subgraph "packages/web-core/src/features/"
        KANBAN["kanban/<br/>KanbanContainer, useKanbanFilters"]
        WS_FEAT["workspace/<br/>useWorkspaceNotes, usePreviewDevServer"]
        WS_CHAT["workspace-chat/<br/>ConversationList, SessionChatBox,<br/>SessionSend, Approvals, Retry"]
        ONBOARD_F["onboarding/<br/>LandingPage, SignInPage"]
        BRAINSTORM_F["brainstorm/<br/>BrainstormTerminal, Sidebar,<br/>Input, PlanReview, PushDialog"]
        MIGRATE_F["migration/<br/>MigrateLayout, 4 step containers"]
    end
```

## Brainstorm Feature

```mermaid
graph TB
    subgraph "brainstorm/ui/"
        BS_TERMINAL["BrainstormTerminal"]
        BS_SIDEBAR["BrainstormSidebar<br/>Session list + context"]
        BS_INPUT["BrainstormInput<br/>Message + Extract Plan + Thinking budget"]
        BS_MSG_LIST["BrainstormMessageList"]
        BS_MSG["BrainstormMessage"]
        BS_THINKING["BrainstormThinking"]
        BS_PLAN["BrainstormPlanReview<br/>Structured plan viewer"]
        BS_PUSH["BrainstormPushDialog<br/>Push to kanban board"]
        BS_CONTEXT["BrainstormContextPanel"]
    end

    subgraph "brainstorm/model/hooks/"
        USE_BS_SESSIONS["useBrainstormSessions"]
        USE_BS_SESSION["useBrainstormSession"]
        USE_BS_SEND["useBrainstormSend<br/>WebSocket streaming"]
        USE_BS_PLAN["useExtractPlan<br/>Non-streaming Opus"]
        USE_BS_PUSH["usePushPlan<br/>Create kanban issues"]
        USE_BS_STATUS["useBrainstormStatus"]
    end

    subgraph "brainstorm/model/stores/"
        BS_STORE["useBrainstormStore<br/>Zustand"]
    end

    BS_TERMINAL --> BS_SIDEBAR
    BS_TERMINAL --> BS_MSG_LIST
    BS_TERMINAL --> BS_INPUT
    BS_TERMINAL --> BS_PLAN
    BS_MSG_LIST --> BS_MSG
    BS_MSG_LIST --> BS_THINKING
    BS_INPUT --> USE_BS_SEND
    BS_INPUT --> USE_BS_PLAN
    BS_PLAN --> BS_PUSH
    BS_PUSH --> USE_BS_PUSH
    USE_BS_SEND --> BS_STORE
    USE_BS_PLAN --> BS_STORE
```

## Workspace-Chat Feature (Core)

```mermaid
graph TB
    subgraph "workspace-chat/ui/"
        CONV_LIST["ConversationListContainer"]
        NEW_ENTRY["NewDisplayConversationEntry"]
        CHATBOX["SessionChatBoxContainer"]
    end

    subgraph "workspace-chat/model/hooks/"
        USE_SEND["useSessionSend"]
        USE_HIST["useConversationHistory"]
        USE_APPROVAL["useApprovalMutation"]
        USE_RETRY["useMessageEditRetry"]
        USE_RESET["useResetProcess"]
        USE_QUEUE["useSessionQueueInteraction"]
        USE_CREATE_S["useCreateSession"]
        USE_ATTACH["useSessionAttachments"]
        USE_EDITOR["useSessionMessageEditor"]
        USE_TODOS["useTodos"]
    end

    subgraph "workspace-chat/model/contexts/"
        CTX_ENTRIES["EntriesContext"]
        CTX_APPROVAL["ApprovalFeedbackContext"]
        CTX_EDIT["MessageEditContext"]
        CTX_RETRY["RetryUiContext"]
    end

    CHATBOX --> USE_SEND
    CHATBOX --> USE_EDITOR
    CONV_LIST --> USE_HIST
    CONV_LIST --> CTX_ENTRIES
```

## Zustand Stores

| Store | Key State | Persisted |
|-------|-----------|-----------|
| `useOrganizationStore` | selectedOrgId | Yes |
| `useUiPreferencesStore` | layoutMode, paneSizes, kanbanViewMode, workspaceFilters, mobileFontScale, collapsedPaths | Yes |
| `useDiffViewStore` | mode (unified/split), ignoreWhitespace, wrapText | Yes |
| `useExpandableStore` | expanded (key-value toggle) | No |
| `useInspectModeStore` | inspect mode for workspace-chat | No |
| `useBrainstormStore` | activeSessionId, isStreaming, streamingText, streamingThinking, extractedPlan, thinkingBudget | No |

## Key Hooks by Category

### State & Context
- `useAuth()`, `useCurrentUser()`, `useAuthMutations()`
- `useWorkspaceContext()`, `useWorkspaces()`, `useWorkspaceSessions()`
- `useProjectContext()`, `useOrgContext()`
- `useIssueContext()`, `useIssueContextOptional()`

### Chat & Sessions
- `useSessionSend()` - send message to agent
- `useConversationHistory()` - load turns
- `useCreateSession()` - new agent session
- `useApprovals()` - approval flow
- `useTodos()` - task management

### Execution
- `useAttempt()`, `useTaskAttempts()` - workspace data
- `useExecutionProcesses()` - running processes
- `useRetryProcess()` - retry/reset execution

### Git
- `useGitOperations()`, `useBranchStatus()`
- `usePush()`, `useMerge()`, `useRebase()`, `useForcePush()`
- `useChangeTargetBranch()`, `useRenameBranch()`
- `useDiffStream()`, `useDiffSummary()`

### UI
- `useIsMobile()`, `useTheme()`
- `useKanbanNavigation()`, `useCommandBarShortcut()`
- `useTerminal()`, `useLogStream()`
- `useOpenInEditor()`

### Brainstorm
- `useBrainstormSessions()`, `useBrainstormSession()` - session list/detail
- `useBrainstormSend()` - WebSocket streaming to Opus
- `useExtractPlan()` - non-streaming plan extraction via tool_use
- `usePushPlan()` - push plan items as kanban issues
- `useBrainstormStatus()` - check API key availability

### Forms & Config
- `useCreateWorkspace()`, `useProjectWorkspaceCreateDraft()`
- `useExecutorConfig()`, `usePresetOptions()`, `useProfiles()`

## API Client (`shared/lib/api.ts`)

Organized by domain:
- `sessionsApi` - Session CRUD + follow-up
- `attemptsApi` - Workspace CRUD + git ops + PR
- `executionProcessesApi` - Process lifecycle
- `fileSystemApi` - Directory browsing
- `repoApi` - Repo registration + branches + search
- `configApi` - App config + MCP + profiles
- `tagsApi` - Tag management
- `imagesApi` - Image upload/serve
- `approvalsApi` - Approval responses
- `oauthApi` - Auth flow
- `organizationsApi` - Org CRUD + members
- `remoteProjectsApi` - Cloud project/issue/status
- `scratchApi` - Scratch pad CRUD
- `agentsApi` - Agent availability + discovery
- `queueApi` - Message queue
- `migrationApi` - Data migration
- `searchApi` - File search
- `brainstormApi` - Brainstorm sessions, streaming, plan extraction, push-to-kanban

## Design System

### CSS Variable Tokens

```
Text:       --text-high, --text-normal, --text-low
Background: --bg-primary, --bg-secondary, --bg-panel
Brand:      --brand (orange hsl(25 82% 54%)), --brand-hover, --brand-secondary
Status:     --error, --success, --merged
Border:     --separator-border, --focus-border
On-brand:   --text-on-brand
```

### Tailwind Extensions
- **Spacing**: `p-half` (6px), `p-base` (12px), `p-double` (24px)
- **Font sizes**: xs=8px, sm=10px, base=12px, lg=14px, xl=16px
- **Radius**: `--radius: 0.125rem` (small by default)
- **Focus**: `ring-brand` (orange), inset

### Component Library (@vibe/ui - 143 components)

**Chat**: ChatBoxBase, ChatAssistantMessage, ChatUserMessage, ChatThinkingMessage, ChatMarkdown, ChatToolSummary, ChatApprovalCard, ChatAggregatedDiffEntries

**Kanban**: KanbanBoard, KanbanCardContent, KanbanIssuePanel, KanbanFilterBar, IssueListView, IssueListSection

**Issues**: IssuePropertyRow, IssueCommentsSection, IssueRelationshipsSection, IssueSubIssuesSection, IssueTagsRow, IssueWorkspacesSection

**Forms**: Input, InputField, Textarea, Checkbox, Switch, Select, Toggle, Label

**Data**: DataTable, Badge, ProcessListItem, WorkspaceSummary, SubIssueRow

**Dropdowns**: Dropdown, DropdownMenu, SearchableDropdown, MultiSelectDropdown, CommandBar, TypeaheadMenu

**Dialogs**: Dialog, ConfirmDialog, DeleteWorkspaceDialog, CreateRepoDialog, GuideDialogShell

**File**: FileTree, FileTreeNode, RepoCard, GitPanel, ChangesPanel, DiffPanel

**Terminal**: TerminalPanel, PreviewBrowser, PreviewControls, ContextUsageGauge

**Icons**: StatusDot, PriorityIcon, PrBadge, RelationshipBadge, ToolStatusDot

**Buttons**: Button, PrimaryButton, SplitButton, IconButton, IconButtonGroup

## Command Center Package (`packages/command-center/`)

### Routes
- `/brainstorm` — Brainstorm terminal with "Create Workflow" action
- `/workspaces` — Workspace list
- `/workspaces/$workspaceId` — Workspace detail with conversation/diff/terminal tabs
- `/projects/$projectId` — Kanban board with multi-select + bulk launch
- `/multi?ids=ws1,ws2` — Multi-agent split-pane dashboard (2-4 workspaces)
- `/workflows` — Workflow list
- `/workflows/$workflowId` — Workflow dashboard with phase timeline + sanity check

### Components
- `WorkspaceTerminal` — xterm.js terminal wrapper using web-core's `XTermInstance`
- `WorkspacePane` — Compact workspace view for multi-agent dashboard
- `MultiAgentDashboard` — Split-pane view using `react-resizable-panels` (Group/Panel/Separator)
- `BulkLaunchDialog` — Launch N agents in parallel with shared config
- `SelectionBar` — Floating bar for multi-select kanban actions
- `CreateWorkflowDialog` — Auto-phases tasks by dependency, creates workflow
- `WorkflowDashboard` — Phase timeline + task cards + sanity check panel
- `WorkflowListPage` — Lists workflows with status badges
- `PhaseTimeline` — Horizontal stepper with status-colored phase dots
- `SanityCheckPanel` — Review panel for phase completion (diffs + approve/abort)
- `AggregateDiffView` — Combined diff view across multiple workspaces
- `ShortcutsHelpDialog` — Keyboard shortcuts help modal

### Stores
- `useWorkspaceStore` — Zustand persisted: mode, maxIterations, defaultRepo, executor, runtimes (per-workspace state with issueId linking)
- `useWorkflowStore` — Zustand persisted: workflows with phases/tasks, status transitions

### Hooks
- `use-bulk-launch` — Parallel workspace launch with progress tracking
- `use-multi-agent` — Aggregate status + batch operations (stopAll, continueAll)
- `use-workflow-runner` — Orchestrates workflow phases: launch → monitor → sanity check
- `use-ordered-merge` — Sequential merge respecting dependency order
- `use-cc-shortcuts` — Global keyboard shortcuts (m=mode, g+b/w/d/f=navigate, ?=help)
- `use-notifications` — Browser Notification API on agent state transitions

### Utilities
- `plan-to-workflow.ts` — Topological sort on plan item dependencies → execution phases
