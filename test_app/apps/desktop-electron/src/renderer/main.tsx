import { createRoot } from 'react-dom/client'
import './styles/base.css'
import './styles/shell.css'
import './styles/views.css'
import './styles/form.css'
import './styles/responsive.css'
import { App } from './App'

const container = document.getElementById('root')!
createRoot(container).render(<App />)
