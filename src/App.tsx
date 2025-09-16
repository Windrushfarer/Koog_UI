import MultiNavigationMenu from './components/menuContent/header/MultiNavigationMenu'
import Header from './components/Header'
import FloatingNextButton from './components/ui/FloatingNextButton'

function App() {
  return (
    <div className="h-screen bg-neutral-900/60 backdrop-blur">
      <Header />
      <MultiNavigationMenu />
      <FloatingNextButton />
    </div>
  )
}

export default App
