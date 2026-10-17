import { BrowserRouter } from 'react-router-dom'
import AppRoutes from './routes/AppRoutes'
import { AuthProvider } from './context/AuthContext'
import { PlayerProvider } from './context/PlayerContext'
import { ConnectProvider } from './context/ConnectContext'

const App = () => {
  return (
    <BrowserRouter>
      <PlayerProvider>
        <AuthProvider>
          <ConnectProvider>
            <AppRoutes />
          </ConnectProvider>
        </AuthProvider>
      </PlayerProvider>
    </BrowserRouter>
  )
}

export default App
