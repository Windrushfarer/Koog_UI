import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'

import './styles.css'
import reportWebVitals from './reportWebVitals.ts'

import App from './App.tsx'
import CanvasPage from './components/CanvasPage.tsx'
import { FormProvider } from '@/context/FormContext.tsx'

const rootRoute = createRootRoute({
  component: () => (
    <FormProvider>
      <Outlet />
    </FormProvider>
  ),
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (search.tab as string) || 'trigger',
    agentStrategy: (search.agentStrategy as string) || undefined
  }),
  component: App,
})

const canvasRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/canvas',
  component: CanvasPage,
})

const routeTree = rootRoute.addChildren([indexRoute, canvasRoute])

const router = createRouter({
  routeTree,
  context: {},
  defaultPreload: 'intent',
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 0,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('app')
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()
