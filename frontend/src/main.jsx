import { createRoot } from 'react-dom/client'
import './app/App.css'
import { store } from './app/App.Store'
import { Provider } from 'react-redux'
import App from './app/App'

createRoot(document.getElementById('root')).render(
    <Provider store={store}>
      <App />
    </Provider>
)
