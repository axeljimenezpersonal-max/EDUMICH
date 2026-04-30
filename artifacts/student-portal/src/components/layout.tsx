import { Link, useLocation } from "wouter";
import { 
  Bell, 
  FileText, 
  Users, 
  BookOpen, 
  Home,
  LogOut,
  Settings,
  Menu,
  X
} from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigation = [
    { name: "Inicio", href: "/", icon: Home },
    { name: "Anuncios", href: "/anuncios", icon: Bell },
    { name: "Documentos", href: "/documentos", icon: FileText },
    { name: "Estudiantes", href: "/estudiantes", icon: Users },
    { name: "Cursos", href: "/cursos", icon: BookOpen },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 w-full bg-[#2672EC] text-white shadow-sm">
        <div className="flex h-16 items-center px-4 md:px-6">
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden text-white hover:bg-[#1f5dc2] mr-2"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="h-6 w-6" />
          </Button>
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <span>Portal Estudiantil TEC</span>
          </div>
          
          <div className="ml-auto flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-1">
              {navigation.map((item) => (
                <Link key={item.name} href={item.href}>
                  <Button 
                    variant="ghost" 
                    className={`text-white hover:bg-[#1f5dc2] hover:text-white ${location === item.href || (location.startsWith(item.href) && item.href !== '/') ? 'bg-[#1f5dc2]' : ''}`}
                  >
                    {item.name}
                  </Button>
                </Link>
              ))}
            </div>
            <div className="flex items-center border-l border-[#1f5dc2] pl-4 space-x-2">
              <Button variant="ghost" size="icon" className="text-white hover:bg-[#1f5dc2]">
                <Settings className="h-5 w-5" />
              </Button>
              <div className="h-8 w-8 rounded-full bg-white text-[#2672EC] flex items-center justify-center font-bold text-sm">
                AL
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className={`
          fixed md:sticky top-16 z-40 h-[calc(100vh-4rem)] w-64 shrink-0 
          border-r bg-white shadow-sm transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
          md:translate-x-0
        `}>
          <div className="flex h-full flex-col py-4">
            <div className="px-4 py-2">
              <h2 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Navegación
              </h2>
              <nav className="space-y-1">
                {navigation.map((item) => (
                  <Link key={item.name} href={item.href}>
                    <div 
                      onClick={() => setSidebarOpen(false)}
                      className={`
                      flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer
                      ${location === item.href || (location.startsWith(item.href) && item.href !== '/') 
                        ? 'bg-[#2672EC]/10 text-[#2672EC]' 
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
                    `}>
                      <item.icon className={`h-4 w-4 ${location === item.href || (location.startsWith(item.href) && item.href !== '/') ? 'text-[#2672EC]' : 'text-gray-500'}`} />
                      {item.name}
                    </div>
                  </Link>
                ))}
              </nav>
            </div>
            
            <div className="mt-auto px-4 pb-4">
              <Button variant="ghost" className="w-full justify-start text-gray-600 hover:text-red-600 hover:bg-red-50">
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 w-full overflow-y-auto">
          <div className="container mx-auto p-4 md:p-8 max-w-7xl">
            {children}
          </div>
        </main>
        
        {/* Overlay for mobile sidebar */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 top-16 z-30 bg-black/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
