import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/tokens.css'
import './styles/app.css'
import { connect } from './ws/client'

connect()
createRoot(document.getElementById('root')!).render(<App />)
