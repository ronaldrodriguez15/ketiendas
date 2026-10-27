import React from "react";
import { QueryCache, MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Notifications from './components/ui/Notifications';
import { notify } from './services/notifications';
import 'react-toastify/dist/ReactToastify.css';
import { retry } from './services/http';
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import App from "./App";
import "./styles/index.css";

const client = new QueryClient({
  queryCache: new QueryCache({ onError: (error, query) => { if (query.getObserversCount()) notify.error(error); } }),
  mutationCache: new MutationCache({ onError: notify.error }),
  defaultOptions: { queries: { retry } },
});
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={client}><AuthProvider>
        <App />
        <Notifications />
      </AuthProvider></QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);
