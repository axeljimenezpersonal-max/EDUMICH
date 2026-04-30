import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import Anuncios from "@/pages/anuncios";
import AnuncioDetail from "@/pages/anuncios/detail";
import Documentos from "@/pages/documentos";
import Estudiantes from "@/pages/estudiantes";
import Cursos from "@/pages/cursos";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/">
        <Layout>
          <Dashboard />
        </Layout>
      </Route>
      <Route path="/anuncios">
        <Layout>
          <Anuncios />
        </Layout>
      </Route>
      <Route path="/anuncios/:id">
        {params => (
          <Layout>
            <AnuncioDetail id={Number(params.id)} />
          </Layout>
        )}
      </Route>
      <Route path="/documentos">
        <Layout>
          <Documentos />
        </Layout>
      </Route>
      <Route path="/estudiantes">
        <Layout>
          <Estudiantes />
        </Layout>
      </Route>
      <Route path="/cursos">
        <Layout>
          <Cursos />
        </Layout>
      </Route>
      <Route>
        <Layout>
          <NotFound />
        </Layout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
