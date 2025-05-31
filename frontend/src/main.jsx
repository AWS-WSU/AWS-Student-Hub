import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Auth0Provider } from '@auth0/auth0-react'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Auth0Provider
      domain="dev-3cub4xczdiiecs8d.us.auth0.com"
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: `${window.location.origin}`,
        scope: "openid profile email",
        response_type: "code",
        code_challenge_method: "S256"
      }}
      cacheLocation="localstorage"
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Auth0Provider>
  </StrictMode>,
)
