# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Building and Testing
npm run build            # Build for production (runs vite build && tsc)
npm run test             # Run Vitest tests

# Code Quality
npm run lint             # Run ESLint
npm run format           # Run Prettier
npm run check            # Run Prettier write + ESLint fix
npx tsc --noEmit         # TypeScript type checking (no typecheck script exists)
```

## Architecture Overview

This is a React + TypeScript application built with Vite, using TanStack Router for routing and Tailwind CSS for styling. The app implements a multi-step workflow form with global state management.

### Core Application Structure

**Two-Page Application:**

- `/` - Main form page with multi-step wizard (trigger → setup → agent → output)
- `/canvas` - Visual flow editor using canvas-based interface

**State Management Architecture:**

- `FormContext` (src/context/FormContext.tsx) - Global form state using React Context + useReducer
- `NavigationContext` (src/context/NavigationContext.tsx) - Navigation state for form progression
- Both contexts work together to manage form validation and step-by-step navigation

**Form Validation System:**

- Form progression is controlled by validation rules in FormContext
- Each step must be valid before proceeding to the next
- FloatingNextButton is disabled when current form step is incomplete
- Navigation tabs are disabled until prerequisite steps are valid

### Key Components

**NavigationManager** (src/components/NavigationManager.tsx):

- Central coordinator that manages form progression
- Integrates with TanStack Router for URL-based tab state
- Wraps MultiNavigationMenu and FloatingNextButton with NavigationProvider

**MultiNavigationMenu** (src/components/menuContent/header/MultiNavigationMenu.tsx):

- Tab-based navigation with URL query parameter integration (`/?tab=trigger`)
- Renders different content components based on active tab
- Enforces navigation constraints based on form validation

**Form Steps:**

- **Trigger**: Select workflow trigger (YouTrack, GitHub, Slack, Google Calendar, Telegram)
- **Setup**: Choose LLM provider (OpenAI, Anthropic, Google, etc.) and model version
- **Agent**: Agent configuration (component exists but not fully implemented)
- **Output**: Output configuration (component exists but not fully implemented)

### Routing Integration

The application uses TanStack Router with code-based routing defined in `src/main.tsx`:

- Main page supports `tab` query parameter for deep-linking to specific form steps
- Default tab is `trigger` if no query parameter provided
- Navigation updates URL automatically when switching tabs
- Router state is integrated with form navigation logic

### TypeScript Configuration

- Uses `@/*` path alias for src directory imports
- Strict TypeScript configuration with `verbatimModuleSyntax` enabled
- Type-only imports must use `import type { }` syntax
- ESLint enforces TanStack's strict typing rules

### Styling and UI

- Tailwind CSS with custom color scheme (purple/neutral theme)
- Uses `#B191FF` as primary brand color
- Responsive design with mobile-first approach
- Custom backdrop blur and glassmorphic effects

## Common Development Patterns

**Adding New Form Steps:**

1. Update `defaultNavigation` array in NavigationManager
2. Add validation logic to `canProceedToNext` in FormContext
3. Add new content component and import in MultiNavigationMenu
4. Update form state types and actions in FormContext if needed

**Working with Router:**

- Use `useNavigate()` and `useSearch()` from `@tanstack/react-router`
- Always use `void navigate()` to satisfy ESLint rules about ignored promises
- Query parameters are strongly typed through route validation

**Context Usage:**

- `useForm()` for global form state and validation
- `useNavigation()` for form progression and navigation state
- Both hooks throw errors if used outside their respective providers

## Code Quality Standards

- ESLint uses TanStack's configuration with strict rules
- Array types must use `Array<T>` syntax instead of `T[]`
- Unnecessary optional chaining and conditionals are flagged
- Import order is enforced
- Unused variables must be prefixed with underscore or removed
- After done task ALWAYS RUN linter, tsc and `npm run check` to format and fix code
