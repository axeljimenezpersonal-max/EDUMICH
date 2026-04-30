import { useGetAnnouncement, getGetAnnouncementQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, ArrowLeft, Clock, User, Tag } from "lucide-react";
import { Link } from "wouter";

interface AnuncioDetailProps {
  id: number;
}

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

export default function AnuncioDetail({ id }: AnuncioDetailProps) {
  const { data: announcement, isLoading, error } = useGetAnnouncement(id, {
    query: { enabled: !!id, queryKey: getGetAnnouncementQueryKey(id) }
  });

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Anuncio no encontrado</h2>
        <p className="text-gray-600 mb-6">El anuncio que buscas no existe o ha sido eliminado.</p>
        <Link href="/anuncios">
          <Button className="bg-[#2672EC] hover:bg-[#1f5dc2]">Volver a Anuncios</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div>
        <Link href="/anuncios">
          <Button variant="ghost" size="sm" className="text-gray-600 hover:text-[#2672EC] -ml-2" data-testid="button-back-announcements">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Anuncios
          </Button>
        </Link>
      </div>

      <Card>
        {isLoading ? (
          <CardContent className="p-8 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <div className="pt-4 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </CardContent>
        ) : announcement ? (
          <>
            <CardHeader className="border-b border-gray-100 bg-gray-50/50">
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge variant="outline" className={getPriorityColor(announcement.priority)}>
                  {getPriorityLabel(announcement.priority)}
                </Badge>
                <Badge variant="outline" className="text-gray-600">
                  <Tag className="mr-1 h-3 w-3" />
                  {announcement.category}
                </Badge>
              </div>
              <CardTitle className="text-2xl font-bold text-gray-900 leading-tight">
                {announcement.title}
              </CardTitle>
              <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {announcement.authorName}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {new Date(announcement.createdAt).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <div className="prose max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
                {announcement.content}
              </div>
            </CardContent>
          </>
        ) : null}
      </Card>
    </div>
  );
}
