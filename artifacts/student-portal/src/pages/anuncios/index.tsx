import { useState } from "react";
import { useListAnnouncements, getListAnnouncementsQueryKey, useGetAnnouncementsSummary, getGetAnnouncementsSummaryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, AlertCircle, Search, Clock, ChevronRight } from "lucide-react";
import { Link } from "wouter";

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case "urgent": return "bg-red-100 text-red-800 border-red-200";
    case "high": return "bg-orange-100 text-orange-800 border-orange-200";
    case "normal": return "bg-blue-100 text-blue-800 border-blue-200";
    case "low": return "bg-gray-100 text-gray-800 border-gray-200";
    default: return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const getPriorityLabel = (priority: string) => {
  switch (priority) {
    case "urgent": return "Urgente";
    case "high": return "Alta";
    case "normal": return "Normal";
    case "low": return "Baja";
    default: return priority;
  }
};

export default function Anuncios() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);

  const { data: announcements, isLoading, error } = useListAnnouncements(
    selectedCategory ? { category: selectedCategory } : {},
    { query: { queryKey: getListAnnouncementsQueryKey(selectedCategory ? { category: selectedCategory } : {}) } }
  );

  const { data: summary } = useGetAnnouncementsSummary({
    query: { queryKey: getGetAnnouncementsSummaryQueryKey() }
  });

  const filtered = announcements?.filter(a =>
    !search || a.title.toLowerCase().includes(search.toLowerCase()) || a.content.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const categories = summary?.byCategory ?? [];

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Error al cargar anuncios</h2>
        <p className="text-gray-600">Por favor, intente recargar la página.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Anuncios</h1>
          <p className="text-muted-foreground mt-1">Comunicados y avisos institucionales</p>
        </div>
        {summary && (
          <div className="flex gap-2 shrink-0">
            {summary.urgent > 0 && (
              <Badge className="bg-red-100 text-red-800 border-red-200 gap-1">
                <Bell className="h-3 w-3" /> {summary.urgent} urgentes
              </Badge>
            )}
            <Badge variant="outline" className="text-gray-600">{summary.total} totales</Badge>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar anuncios..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-announcements"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={!selectedCategory ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(undefined)}
            data-testid="button-filter-all"
            className={!selectedCategory ? "bg-[#2672EC] hover:bg-[#1f5dc2]" : ""}
          >
            Todos
          </Button>
          {categories.map(c => (
            <Button
              key={c.category}
              variant={selectedCategory === c.category ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(c.category === selectedCategory ? undefined : c.category)}
              data-testid={`button-filter-${c.category}`}
              className={selectedCategory === c.category ? "bg-[#2672EC] hover:bg-[#1f5dc2]" : ""}
            >
              {c.category} ({c.count})
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="p-5 space-y-2">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Bell className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No se encontraron anuncios</p>
              <p className="text-sm mt-1">Intente cambiar los filtros de búsqueda</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map(announcement => (
                <Link key={announcement.id} href={`/anuncios/${announcement.id}`}>
                  <div
                    className="p-5 hover:bg-gray-50 transition-colors cursor-pointer group flex items-start gap-4"
                    data-testid={`announcement-item-${announcement.id}`}
                  >
                    <div className="shrink-0 pt-0.5">
                      <Badge variant="outline" className={getPriorityColor(announcement.priority)}>
                        {getPriorityLabel(announcement.priority)}
                      </Badge>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 group-hover:text-[#2672EC] transition-colors">{announcement.title}</p>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{announcement.content}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span className="font-medium text-gray-700">{announcement.category}</span>
                        <span>•</span>
                        <span>{announcement.authorName}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(announcement.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-[#2672EC] transition-colors shrink-0 self-center" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
