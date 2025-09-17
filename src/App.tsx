import Header from './components/Header'
import NavigationManager from './components/NavigationManager'
import { FormProvider } from './context/FormContext'

function App() {
  return (
    <FormProvider>
      <div className="bg-neutral-900/60 backdrop-blur">
        <Header />
        <NavigationManager />
      </div>
    </FormProvider>
  )
}

export default App
