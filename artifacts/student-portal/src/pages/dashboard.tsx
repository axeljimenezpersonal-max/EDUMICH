import { useGetDashboardSummary, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, FileText, Bell, BookOpen, AlertCircle, Clock, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { data: summary, isLoading, error } = useGetDashboardSummary({
    query: {
      queryKey: getGetDashboardSummaryQueryKey(),
    }
  });

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Error al cargar el tablero</h2>
        <p className="text-gray-600">Por favor, intente recargar la página.</p>
      </div>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'normal': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'low': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'Urgente';
      case 'high': return 'Alta';
      case 'normal': return 'Normal';
      case 'low': return 'Baja';
      default: return priority;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'approved': return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'approved': return 'Aprobado';
      case 'rejected': return 'Rechazado';
      default: return status;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Inicio</h1>
        <p className="text-muted-foreground mt-2">Bienvenido al Portal Estudiantil TEC. Aquí tienes un resumen de tu información académica.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estudiantes Activos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{summary?.activeStudents}</div>
                <p className="text-xs text-muted-foreground">
                  de {summary?.totalStudents} inscritos
                </p>
              </>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cursos Activos</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{summary?.totalCourses}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documentos Pendientes</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{summary?.pendingDocuments}</div>
                <p className="text-xs text-muted-foreground">
                  de {summary?.totalDocuments} totales
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className={summary?.urgentAnnouncements ? "border-red-200 bg-red-50/30" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Anuncios Urgentes</CardTitle>
            <Bell className={`h-4 w-4 ${summary?.urgentAnnouncements ? "text-red-500" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className={`text-2xl font-bold ${summary?.urgentAnnouncements ? "text-red-600" : ""}`}>
                  {summary?.urgentAnnouncements}
                </div>
                <p className="text-xs text-muted-foreground">
                  {summary?.totalAnnouncements} anuncios en total
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Announcements */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between bg-gray-50/50 border-b border-gray-100">
            <div>
              <CardTitle>Anuncios Recientes</CardTitle>
              <CardDescription>Últimos comunicados institucionales</CardDescription>
            </div>
            <Link href="/anuncios">
              <Button variant="outline" size="sm" className="h-8 text-xs">
                Ver todos
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            ) : summary?.recentAnnouncements?.length ? (
              <div className="divide-y divide-gray-100">
                {summary.recentAnnouncements.map((announcement) => (
                  <Link key={announcement.id} href={`/anuncios/${announcement.id}`}>
                    <div className="p-4 hover:bg-gray-50 transition-colors cursor-pointer group flex items-start gap-4">
                      <div className="mt-1">
                        <Badge variant="outline" className={`${getPriorityColor(announcement.priority)}`}>
                          {getPriorityLabel(announcement.priority)}
                        </Badge>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate group-hover:text-[#2672EC] transition-colors">
                          {announcement.title}
                        </p>
                        <div className="flex items-center text-xs text-gray-500 mt-1 gap-2">
                          <span className="truncate">{announcement.category}</span>
                          <span>•</span>
                          <span className="flex items-center">
                            <Clock className="mr-1 h-3 w-3" />
                            {new Date(announcement.createdAt).toLocaleDateString('es-MX')}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-[#2672EC] transition-colors shrink-0 self-center" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                No hay anuncios recientes
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Documents */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between bg-gray-50/50 border-b border-gray-100">
            <div>
              <CardTitle>Documentos Recientes</CardTitle>
              <CardDescription>Actividad reciente de trámites</CardDescription>
            </div>
            <Link href="/documentos">
              <Button variant="outline" size="sm" className="h-8 text-xs">
                Ir a Documentos
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-md" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : summary?.recentDocuments?.length ? (
              <div className="divide-y divide-gray-100">
                {summary.recentDocuments.map((doc) => (
                  <div key={doc.id} className="p-4 flex items-start gap-4">
                    <div className="h-10 w-10 rounded bg-blue-50 flex items-center justify-center text-[#2672EC] shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {doc.fileName}
                      </p>
                      <div className="flex items-center text-xs text-gray-500 mt-1 justify-between">
                        <span className="truncate">{doc.studentName}</span>
                        <span>{new Date(doc.createdAt).toLocaleDateString('es-MX')}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className={`${getStatusColor(doc.status)} shrink-0`}>
                      {getStatusLabel(doc.status)}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                No hay documentos recientes
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
